<template>
  <div class="app">
    <MenuBar v-if="!isMac" @menu-event="onMenuBarEvent" />
    <button
      v-if="sourceMode"
      class="source-exit-btn"
      @click="toggleSourceMode"
    >Exit Source Mode</button>
    <main class="editor-container" ref="editorContainerEl">
      <div
        v-for="slot in openFiles"
        :key="slot.id"
        :ref="(el) => setSlotElement(slot.id, el as HTMLElement | null)"
        v-show="slot.id === activeFileId && !sourceMode"
        class="editor-pane"
      />
      <div
        ref="sourceEditorEl"
        v-show="sourceMode"
        class="source-pane"
      />
      <OutlineView v-show="!sourceMode" :editor="activeEditor" :container="editorContainerEl" />
    </main>
    <Sidebar
      :mode="effectiveSidebarMode"
      :open-files="openFiles"
      :active-file-id="activeFileId"
      :active-file-path="activeFile?.filePath ?? ''"
      :root-path="workspaceRoot ?? ''"
      @select-file="switchToFile"
      @close-file="closeFile"
      @open-file="openFileFromTree"
      @open-folder="handleOpenFolder"
    />
    <StatusBar
      :editor="sourceMode ? null : activeEditor"
      :dirty="activeDirty"
      :source-mode="sourceMode"
      @toggle-source="toggleSourceMode"
    />
    <Transition name="toast">
      <div v-if="toast" class="toast" :class="toast.type">{{ toast.message }}</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { createEditor } from './editor/index'
import { createSourceEditor } from './editor/source-editor'
import StatusBar from './ui/StatusBar.vue'
import OutlineView from './ui/OutlineView.vue'
import Sidebar from './ui/Sidebar.vue'
import MenuBar from './ui/MenuBar.vue'
import { fileWrite, saveFileDialog, saveFileDialogWithFilter, fileWriteBinary, openFileDialog, tempSave, listTempFiles, deleteTempFile, fileRead, updateWindowTitle, directoryOpenDialog, openFolderInNewWindow, openFileInNewWindow, toggleFullscreen } from './tauri/commands'
import { exportPDF, exportDOCX, exportJPEG } from './export'
import { arrayBufferToBase64 } from './export/utils'
import type { FileSlot } from './types'

const isMac = navigator.platform.toUpperCase().includes('MAC')

const editorContainerEl = ref<HTMLElement | null>(null)
const openFiles = ref<FileSlot[]>([])
const activeFileId = ref('')
const toast = ref<{ message: string; type: 'error' | 'success' } | null>(null)
const sourceMode = ref(false)
const sourceEditorEl = ref<HTMLElement | null>(null)
let sourceEditor: ReturnType<typeof createSourceEditor> | null = null

// ── Sidebar / workspace state ────────────────────────────────
const workspaceRoot = ref<string | null>(null)

const effectiveSidebarMode = computed(() => {
  if (workspaceRoot.value) return 'tree'
  if (openFiles.value.length > 1) return 'flat'
  return 'hidden'
})

let toastTimeout: ReturnType<typeof setTimeout> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let unlistenMenu: any = null
let idCounter = 0
const slotElements = new Map<string, HTMLElement>()
const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()
const AUTO_SAVE_DELAY = 3000

// ── Computed accessors ─────────────────────────────────────

const activeIndex = computed(() =>
  openFiles.value.findIndex(f => f.id === activeFileId.value)
)

const activeFile = computed(() =>
  openFiles.value.find(f => f.id === activeFileId.value) ?? null
)

const activeEditor = computed(() => activeFile.value?.editor ?? null)
const activeFilename = computed(() => activeFile.value?.filename ?? 'Untitled.md')
const activeDirty = computed(() => activeFile.value?.dirty ?? false)

// Sync filename to native window title
watch(activeFilename, (fn) => {
  updateWindowTitle(fn).catch(() => { /* not in Tauri */ })
}, { immediate: true })

// ── Toast ──────────────────────────────────────────────────

function showToast(message: string, type: 'error' | 'success' = 'error') {
  if (toastTimeout) clearTimeout(toastTimeout)
  toast.value = { message, type }
  toastTimeout = setTimeout(() => { toast.value = null }, 4000)
}

// ── Markdown content ───────────────────────────────────────

function getMarkdownContent(slot: FileSlot): string | null {
  if (!slot.editor) return null
  const md = slot.editor.storage.markdown?.getMarkdown?.()
  if (typeof md === 'string') return md
  showToast('Failed to serialize document as Markdown')
  return null
}

// ── Auto-save ──────────────────────────────────────────────

function clearAutoSaveTimer(slot: FileSlot) {
  const timer = autoSaveTimers.get(slot.id)
  if (timer) {
    clearTimeout(timer)
    autoSaveTimers.delete(slot.id)
  }
}

function clearAllAutoSaveTimers() {
  for (const timer of autoSaveTimers.values()) clearTimeout(timer)
  autoSaveTimers.clear()
}

async function performAutoSave(slot: FileSlot) {
  if (!slot.dirty || !slot.editor) return

  // If in source mode, sync CM → PM
  if (sourceMode.value && sourceEditor && activeFile.value?.id === slot.id) {
    const md = sourceEditor.getContent()
    slot.editor.commands.setContent(md)
  }

  const content = getMarkdownContent(slot)
  if (content === null) return

  try {
    if (slot.filePath) {
      await fileWrite(slot.filePath, content)
      slot.dirty = false
      slot.lastSavedContent = content
    } else {
      await tempSave(slot.filename, content)
      slot.lastSavedContent = content
    }
  } catch {
    // Silent
  }
}

function scheduleAutoSave(slot: FileSlot) {
  clearAutoSaveTimer(slot)
  const timer = setTimeout(() => performAutoSave(slot), AUTO_SAVE_DELAY)
  autoSaveTimers.set(slot.id, timer)
}

// ── Slot management ────────────────────────────────────────

function createFileSlot(content: string = '', fn: string = 'Untitled.md', fp: string | null = null): FileSlot {
  const id = `file-${++idCounter}`
  const slot: FileSlot = {
    id,
    filePath: fp,
    filename: fn,
    dirty: false,
    editor: null,
    element: null,
    lastSavedContent: content,
  }
  openFiles.value.push(slot)
  return slot
}

function setSlotElement(id: string, el: HTMLElement | null) {
  if (!el) return
  const existing = slotElements.get(id)
  if (existing === el) return
  slotElements.set(id, el)

  const slot = openFiles.value.find(f => f.id === id)
  if (slot && !slot.element) {
    slot.element = el
    slot.editor = createEditor(el, slot.lastSavedContent, () => slot.filePath)
    slot.editor.on('update', () => {
      slot.dirty = true
      scheduleAutoSave(slot)
    })
  }
}

function switchToFile(id: string) {
  // If in source mode, save CM content to outgoing slot
  if (sourceMode.value && sourceEditor && activeFile.value?.editor) {
    const md = sourceEditor.getContent()
    activeFile.value.editor.commands.setContent(md)
  }

  activeFileId.value = id

  // Load new file's markdown into CM if in source mode
  if (sourceMode.value && sourceEditor) {
    const slot = openFiles.value.find(f => f.id === id)
    if (slot?.editor) {
      const md = getMarkdownContent(slot)
      if (md !== null) sourceEditor.setContent(md)
    }
  }

  nextTick(() => {
    if (!sourceMode.value) {
      const slot = openFiles.value.find(f => f.id === id)
      slot?.editor?.commands.focus()
    }
  })
}

async function closeFile(slot: FileSlot): Promise<boolean> {
  if (slot.dirty) {
    const confirmed = await confirmUnsaved(slot.filename)
    if (!confirmed) return false
  }

  clearAutoSaveTimer(slot)
  slot.editor?.destroy()

  const idx = openFiles.value.findIndex(f => f.id === slot.id)
  openFiles.value = openFiles.value.filter(f => f.id !== slot.id)
  slotElements.delete(slot.id)

  if (openFiles.value.length === 0) {
    const newSlot = createFileSlot()
    switchToFile(newSlot.id)
  } else {
    const newIdx = Math.min(idx, openFiles.value.length - 1)
    switchToFile(openFiles.value[newIdx].id)
  }

  return true
}

// ── File operations ────────────────────────────────────────

async function handleSave() {
  const slot = activeFile.value
  if (!slot?.editor) return

  // If in source mode, sync CM → PM before saving
  if (sourceMode.value && sourceEditor) {
    const md = sourceEditor.getContent()
    slot.editor.commands.setContent(md)
  }

  clearAutoSaveTimer(slot)
  const content = getMarkdownContent(slot)
  if (content === null) return

  try {
    if (slot.filePath) {
      await fileWrite(slot.filePath, content)
      slot.dirty = false
      slot.lastSavedContent = content
      showToast('Saved', 'success')
    } else {
      const chosenPath = await saveFileDialog(slot.filename)
      if (chosenPath) {
        await fileWrite(chosenPath, content)
        slot.filePath = chosenPath
        const parts = chosenPath.split(/[/\\]/)
        slot.filename = parts[parts.length - 1] || 'Untitled.md'
        slot.dirty = false
        slot.lastSavedContent = content
        showToast('Saved', 'success')
      }
    }
  } catch (e) {
    showToast(`Save failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function handleOpen() {
  try {
    const results = await openFileDialog()
    if (results.length === 0) return

    for (const result of results) {
      // Check if already open
      const existing = openFiles.value.find(f => f.filePath === result.path)
      if (existing) {
        switchToFile(existing.id)
        continue
      }

      const parts = result.path.split(/[/\\]/)
      const fn = parts[parts.length - 1] || 'Untitled.md'
      const slot = createFileSlot(result.content, fn, result.path)
      switchToFile(slot.id)
    }
  } catch (e) {
    showToast(`Open failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function handleNew() {
  const slot = createFileSlot()
  switchToFile(slot.id)
}

async function handleClose() {
  const slot = activeFile.value
  if (!slot) return
  await closeFile(slot)
}

function toggleSourceMode() {
  if (sourceMode.value) {
    // Exit source mode: push CM content back to ProseMirror
    sourceEditor?.view.dom.blur()
    const slot = activeFile.value
    const md = sourceEditor?.getContent() ?? null
    sourceMode.value = false
    if (slot?.editor) {
      nextTick(() => {
        if (md) {
          try {
            slot.editor.commands.setContent(md, false)
          } catch (e) {
            console.warn('setContent failed', e)
          }
        }
        slot.editor.commands.focus()
      })
    }
  } else {
    // Enter source mode: get markdown from ProseMirror
    const slot = activeFile.value
    if (!slot?.editor) return

    const md = getMarkdownContent(slot)
    if (md === null) return

    sourceMode.value = true

    // Lazy-create CodeMirror on first toggle
    if (!sourceEditor && sourceEditorEl.value) {
      sourceEditor = createSourceEditor(sourceEditorEl.value, () => {
        const s = activeFile.value
        if (s) {
          s.dirty = true
          scheduleAutoSave(s)
        }
      })
    }

    if (sourceEditor) {
      sourceEditor.setContent(md)
      const { from } = slot.editor.state.selection
      const text = slot.editor.state.doc.textBetween(0, from, '\n')
      const line = text.split('\n').length
      sourceEditor.setCursorLine(line)
    }
  }
}

// ── Export ────────────────────────────────────────────────────

async function handleExportPDF() {
  const slot = activeFile.value
  if (!slot?.element) return
  try {
    const blob = await exportPDF(slot.element, activeFilename.value)
    const baseName = activeFilename.value.replace(/\.[^.]+$/, '')
    const chosenPath = await saveFileDialogWithFilter(
      `${baseName}.pdf`,
      [{ name: 'PDF Document', extensions: ['pdf'] }]
    )
    if (chosenPath) {
      const buffer = await blob.arrayBuffer()
      const base64 = arrayBufferToBase64(buffer)
      await fileWriteBinary(chosenPath, base64)
      showToast('Exported as PDF', 'success')
    }
  } catch (e) {
    showToast(`PDF export failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function handleExportDOCX() {
  const slot = activeFile.value
  if (!slot?.element) return
  try {
    const blob = await exportDOCX(slot.element)
    const baseName = activeFilename.value.replace(/\.[^.]+$/, '')
    const chosenPath = await saveFileDialogWithFilter(
      `${baseName}.docx`,
      [{ name: 'Word Document', extensions: ['docx'] }]
    )
    if (chosenPath) {
      const buffer = await blob.arrayBuffer()
      const base64 = arrayBufferToBase64(buffer)
      await fileWriteBinary(chosenPath, base64)
      showToast('Exported as DOCX', 'success')
    }
  } catch (e) {
    showToast(`DOCX export failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function handleExportJPEG() {
  const slot = activeFile.value
  if (!slot?.element) return
  try {
    const blob = await exportJPEG(slot.element)
    const baseName = activeFilename.value.replace(/\.[^.]+$/, '')
    const chosenPath = await saveFileDialogWithFilter(
      `${baseName}.jpg`,
      [{ name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }]
    )
    if (chosenPath) {
      const buffer = await blob.arrayBuffer()
      const base64 = arrayBufferToBase64(buffer)
      await fileWriteBinary(chosenPath, base64)
      showToast('Exported as JPEG', 'success')
    }
  } catch (e) {
    showToast(`JPEG export failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function handleCycleNext() {
  if (openFiles.value.length <= 1) return
  const nextIdx = (activeIndex.value + 1) % openFiles.value.length
  switchToFile(openFiles.value[nextIdx].id)
}

function handleCyclePrev() {
  if (openFiles.value.length <= 1) return
  const prevIdx = (activeIndex.value - 1 + openFiles.value.length) % openFiles.value.length
  switchToFile(openFiles.value[prevIdx].id)
}

// ── Folder / tree ──────────────────────────────────────────

async function handleOpenFolder() {
  try {
    // If in flat mode (multiple files), open folder in a new window
    if (effectiveSidebarMode.value === 'flat') {
      const dirPath = await directoryOpenDialog()
      if (dirPath) {
        await openFolderInNewWindow(dirPath)
      }
      return
    }

    const dirPath = await directoryOpenDialog()
    if (dirPath) {
      workspaceRoot.value = dirPath
      const parts = dirPath.split(/[/\\]/)
      const folderName = parts[parts.length - 1] || 'Lexx'
      updateWindowTitle(folderName).catch(() => {})
    }
  } catch (e) {
    showToast(`Open folder failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function openFileFromTree(path: string) {
  // Check if already open
  const existing = openFiles.value.find(f => f.filePath === path)
  if (existing) {
    switchToFile(existing.id)
    return
  }

  try {
    const content = await fileRead(path)
    const parts = path.split(/[/\\]/)
    const fn = parts[parts.length - 1] || 'Untitled.md'
    const slot = createFileSlot(content, fn, path)
    switchToFile(slot.id)
  } catch (e) {
    showToast(`Failed to open: ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function confirmUnsaved(fn: string): Promise<boolean> {
  try {
    const { ask } = await import('@tauri-apps/plugin-dialog')
    return await ask(`"${fn}" has unsaved changes. Close anyway?`, {
      title: 'Unsaved Changes',
      kind: 'warning',
      okLabel: 'Discard',
      cancelLabel: 'Cancel',
    })
  } catch {
    return window.confirm(`"${fn}" has unsaved changes. Close anyway?`)
  }
}

// ── Crash recovery ─────────────────────────────────────────

async function checkCrashRecovery() {
  try {
    const tempFiles = await listTempFiles()
    if (tempFiles.length === 0) return

    const { ask } = await import('@tauri-apps/plugin-dialog')
    for (const tf of tempFiles) {
      const recover = await ask(
        `Found unsaved file "${tf.filename}" from a previous session. Recover it?`,
        { title: 'Crash Recovery', kind: 'warning', okLabel: 'Recover', cancelLabel: 'Discard' }
      )
      if (recover) {
        const content = await fileRead(tf.path)
        const slot = createFileSlot(content, tf.filename)
        slot.dirty = true
        switchToFile(slot.id)
      }
      await deleteTempFile(tf.path)
    }
  } catch {
    // Silent
  }
}

// ── Lifecycle ──────────────────────────────────────────────

onMounted(async () => {
  // Create initial empty file
  const initialSlot = createFileSlot()
  switchToFile(initialSlot.id)

  // Check for workspace query param (new window from folder open)
  try {
    const params = new URLSearchParams(window.location.search)
    const ws = params.get('workspace')
    if (ws) {
      workspaceRoot.value = ws
      const parts = ws.split(/[/\\]/)
      const folderName = parts[parts.length - 1] || 'Lexx'
      updateWindowTitle(folderName).catch(() => {})
    }
    // Check for file query param (new window from file open)
    const fp = params.get('file')
    if (fp) {
      try {
        const content = await fileRead(fp)
        const parts = fp.split(/[/\\]/)
        const fn = parts[parts.length - 1] || 'Untitled.md'
        // Replace the initial empty slot with the real file
        openFiles.value[0].filePath = fp
        openFiles.value[0].filename = fn
        openFiles.value[0].lastSavedContent = content
        if (openFiles.value[0].editor) {
          openFiles.value[0].editor.commands.setContent(content)
        }
      } catch {
        // file read failed, keep empty slot
      }
    }
  } catch {
    // not in browser context
  }

  // ── Frontend menu bar (Windows) ────────────────────────────

  function onMenuBarEvent(id: string) {
    if (id === 'vf') {
      toggleFullscreen().catch(() => {})
      return
    }
    switch (id) {
      case 'fn': handleNew(); break
      case 'fo': handleOpen(); break
      case 'ff': handleOpenFolder(); break
      case 'fs': handleSave(); break
      case 'fc': handleClose(); break
      case 'vs': toggleSourceMode(); break
      case 'ep': handleExportPDF(); break
      case 'ed': handleExportDOCX(); break
      case 'ej': handleExportJPEG(); break
    }
  }

  // Menu events + keyboard shortcuts
  try {
    const { listen } = await import('@tauri-apps/api/event')
    unlistenMenu = await listen<string>('menu-event', (event) => {
      switch (event.payload) {
        case 'fn': handleNew(); break
        case 'fo': handleOpen(); break
        case 'ff': handleOpenFolder(); break
        case 'fs': handleSave(); break
        case 'fc': handleClose(); break
        case 'vs': toggleSourceMode(); break
        case 'ep': handleExportPDF(); break
        case 'ed': handleExportDOCX(); break
        case 'ej': handleExportJPEG(); break
      }
    })

    // File-open events from OS (double-click .md file, drag to dock, etc.)
    await listen<string>('file-open', (event) => {
      const path = event.payload
      if (workspaceRoot.value) {
        // Folder mode → open file in a new window
        openFileInNewWindow(path).catch(() => {})
      } else {
        // No workspace → open in current window
        openFileFromTree(path)
      }
    })
  } catch {
    // Not running in Tauri
  }
  // Always register keyboard shortcuts (menu accelerators may not forward to frontend on all platforms)
  window.addEventListener('keydown', onAcceleratorKey)
  window.addEventListener('keydown', onCycleKey)

  // Window close
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const appWindow = getCurrentWindow()
    appWindow.onCloseRequested(async (event) => {
      const dirtySlots = openFiles.value.filter(f => f.dirty)
      if (dirtySlots.length > 0) {
        event.preventDefault()
        clearAllAutoSaveTimers()
        for (const slot of dirtySlots) {
          await performAutoSave(slot)
        }
        await appWindow.destroy()
      }
    })
  } catch {
    // Not running in Tauri
  }

  // Crash recovery
  await checkCrashRecovery()
})

function onAcceleratorKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 's') { e.preventDefault(); handleSave() }
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'o') { e.preventDefault(); handleOpen() }
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'O') { e.preventDefault(); handleOpenFolder() }
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'n') { e.preventDefault(); handleNew() }
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'w') { e.preventDefault(); handleClose() }
  if (e.key === 'Escape' && sourceMode.value) { e.preventDefault(); toggleSourceMode() }
}

function onCycleKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ']') {
    e.preventDefault()
    handleCycleNext()
  }
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '[') {
    e.preventDefault()
    handleCyclePrev()
  }
}

onBeforeUnmount(() => {
  clearAllAutoSaveTimers()
  if (unlistenMenu) unlistenMenu()
  if (sourceEditor) sourceEditor.destroy()
  window.removeEventListener('keydown', onAcceleratorKey)
  window.removeEventListener('keydown', onCycleKey)
  if (toastTimeout) clearTimeout(toastTimeout)
  for (const slot of openFiles.value) {
    slot.editor?.destroy()
  }
})
</script>

<style>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.editor-container {
  flex: 1;
  overflow-y: auto;
  padding: 40px max(40px, calc((100% - 800px) / 2));
}
.editor-pane {
  min-height: 100%;
}
.source-pane {
  min-height: 100%;
  position: relative;
}
.source-pane :deep(.cm-editor) {
  height: auto;
  font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
  font-size: 14px;
}
.source-pane :deep(.cm-editor .cm-scroller) {
  font-family: inherit;
  overflow: auto;
}

.source-exit-btn {
  position: fixed;
  top: 60px;
  right: 16px;
  z-index: 9999;
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}
.source-exit-btn:hover {
  background: var(--bg-secondary);
}

/* ── Toast Notification ─────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 48px;
  right: 24px;
  padding: 10px 18px;
  border-radius: 6px;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 9999;
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.toast.error {
  background: #ffeef0;
  color: #86181d;
  border: 1px solid #fdaeb7;
}
.toast.success {
  background: #dcffe4;
  color: #144620;
  border: 1px solid #34d058;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
