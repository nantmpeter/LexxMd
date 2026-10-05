<template>
  <div class="app">
    <MenuBar v-if="!isMac" @menu-event="onMenuBarEvent" />
    <FindBar
      v-if="searchOpen && !sourceMode"
      ref="searchInputEl"
      :query="searchQuery"
      :replace="replaceQuery"
      :count-label="searchCountLabel"
      :disabled="searchTotal === 0"
      :not-found="searchQuery.length > 0 && searchTotal === 0"
      @update:query="searchQuery = $event"
      @update:replace="replaceQuery = $event"
      @next="goToNextSearchMatch"
      @previous="goToPreviousSearchMatch"
      @replace="replaceCurrentMatch"
      @replace-all="replaceAllMatches"
      @close="closeSearch"
      @enter="onSearchEnter"
    />
    <QuickOpen
      v-if="quickOpenOpen"
      ref="quickOpenEl"
      :files="quickOpenFiles"
      :loading="quickOpenLoading"
      :error="quickOpenError"
      @select="openQuickOpenFile"
      @close="closeQuickOpen"
    />
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
      <OutlineView v-if="!sourceMode" :editor="activeEditor" :container="editorContainerEl" />
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
    <Transition name="toast">
      <div v-if="updateInfo" class="toast update-toast">
        <span>New version {{ updateInfo.version }} available</span>
        <button class="update-btn" @click="installUpdate">Update & Restart</button>
        <button class="update-dismiss" @click="updateInfo = null">&times;</button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, markRaw } from 'vue'
import { createEditor } from './editor/index'
import { createSourceEditor } from './editor/source-editor'
import { convertLocalImagesInEditor } from './editor/extensions/lexx-image'
import type { Transaction } from '@tiptap/pm/state'
import { getSearchState, replaceActiveSearchMatch, replaceAllSearchMatches, updateSearch } from './editor/extensions/search-match'
import StatusBar from './ui/StatusBar.vue'
import OutlineView from './ui/OutlineView.vue'
import Sidebar from './ui/Sidebar.vue'
import MenuBar from './ui/MenuBar.vue'
import FindBar from './ui/FindBar.vue'
import QuickOpen from './ui/QuickOpen.vue'
import { fileWrite, saveFileDialog, saveFileDialogWithFilter, fileWriteBinary, openFileDialog, tempSave, listTempFiles, deleteTempFile, fileRead, updateWindowTitle, directoryOpenDialog, openFolderInNewWindow, openFileInNewWindow, toggleFullscreen, drainPendingFiles, listDirectory } from './tauri/commands'
import type { DirEntry } from './tauri/commands'
import { exportPDF, exportDOCX, exportJPEG } from './export'
import { arrayBufferToBase64 } from './export/utils'
import type { FileSlot, QuickOpenFile } from './types'

const isMac = navigator.platform.toUpperCase().includes('MAC')

const editorContainerEl = ref<HTMLElement | null>(null)
const openFiles = ref<FileSlot[]>([])
const activeFileId = ref('')
const toast = ref<{ message: string; type: 'error' | 'success' } | null>(null)
const updateInfo = ref<{ version: string; downloadAndInstall: () => Promise<void> } | null>(null)
const sourceMode = ref(false)
const sourceEditorEl = ref<HTMLElement | null>(null)
let sourceEditor: ReturnType<typeof createSourceEditor> | null = null
const searchOpen = ref(false)
const searchQuery = ref('')
const replaceQuery = ref('')
const searchActiveIndex = ref(-1)
const searchTotal = ref(0)
const searchInputEl = ref<InstanceType<typeof FindBar> | null>(null)

const quickOpenOpen = ref(false)
const quickOpenFiles = ref<QuickOpenFile[]>([])
const quickOpenLoading = ref(false)
const quickOpenError = ref('')
const quickOpenEl = ref<InstanceType<typeof QuickOpen> | null>(null)

// Scan cache + cancellation. A monotonically increasing token invalidates
// stale scans (folder switch, close, re-open) so an old slow scan can never
// overwrite a fresher result.
interface QuickOpenCacheEntry {
  files: QuickOpenFile[]
  scannedAt: number
}
const QUICK_OPEN_CACHE_TTL_MS = 30_000
const quickOpenCache = new Map<string, QuickOpenCacheEntry>()
let quickOpenScanToken = 0

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
const searchCountLabel = computed(() => {
  if (!searchQuery.value) return ''
  if (searchTotal.value === 0) return 'No results'
  return `${searchActiveIndex.value + 1} of ${searchTotal.value}`
})

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

// ── Find in document ───────────────────────────────────────

function syncSearchState() {
  const state = getSearchState(activeEditor.value)
  searchActiveIndex.value = state.activeIndex
  searchTotal.value = state.matches.length
}

function clearSearchForAllEditors() {
  for (const slot of openFiles.value) {
    updateSearch(slot.editor, { query: '' })
  }
}

function getSelectedSearchText() {
  const editor = activeEditor.value
  if (!editor) return ''

  const { from, to, empty } = editor.view.state.selection
  if (empty) return ''

  return editor.view.state.doc.textBetween(from, to, ' ')
}

function scrollToActiveSearchMatch() {
  const editor = activeEditor.value
  const container = editorContainerEl.value
  const state = getSearchState(editor)
  const match = state.matches[state.activeIndex]
  if (!editor || !container || !match) return

  requestAnimationFrame(() => {
    try {
      const coords = editor.view.coordsAtPos(match.from)
      const rect = container.getBoundingClientRect()
      const top = container.scrollTop + (coords.top - rect.top) - rect.height / 3
      container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    } catch {
      // The document may have changed before the browser paints.
    }
  })
}

function applySearchQuery() {
  updateSearch(activeEditor.value, { query: searchQuery.value })
  syncSearchState()
  scrollToActiveSearchMatch()
}

function focusSearchInput() {
  // The find bar is v-if'd, so wait one tick for it to mount before focusing.
  nextTick(() => searchInputEl.value?.focus())
}

function openSearch(initialQuery = '') {
  if (sourceMode.value) return

  const selectedText = initialQuery || getSelectedSearchText()
  if (selectedText || !searchOpen.value) {
    searchQuery.value = selectedText
  }
  if (!searchOpen.value) replaceQuery.value = ''

  searchOpen.value = true
  updateSearch(activeEditor.value, { query: searchQuery.value })
  syncSearchState()
  focusSearchInput()
}

function closeSearch() {
  clearSearchForAllEditors()
  searchOpen.value = false
  searchQuery.value = ''
  syncSearchState()
  nextTick(() => activeEditor.value?.commands.focus())
}

function goToSearchMatch(delta: number) {
  const state = getSearchState(activeEditor.value)
  if (state.matches.length === 0) return

  const nextIndex = state.activeIndex + delta
  updateSearch(activeEditor.value, {
    query: searchQuery.value,
    activeIndex: nextIndex,
  })
  syncSearchState()
  scrollToActiveSearchMatch()
}

function goToNextSearchMatch() {
  goToSearchMatch(1)
}

function goToPreviousSearchMatch() {
  goToSearchMatch(-1)
}

function replaceCurrentMatch() {
  if (searchTotal.value === 0) {
    focusSearchInput()
    return
  }

  replaceActiveSearchMatch(activeEditor.value, replaceQuery.value)
  updateSearch(activeEditor.value, { query: searchQuery.value })
  syncSearchState()
  scrollToActiveSearchMatch()
  scheduleAutoSaveForActiveFile()
  focusSearchInput()
}

function replaceAllMatches() {
  if (searchTotal.value === 0) {
    focusSearchInput()
    return
  }

  replaceAllSearchMatches(activeEditor.value, replaceQuery.value)
  updateSearch(activeEditor.value, { query: searchQuery.value })
  syncSearchState()
  scheduleAutoSaveForActiveFile()
  focusSearchInput()
}

function onSearchEnter(event: KeyboardEvent) {
  if (event.shiftKey) goToPreviousSearchMatch()
  else goToNextSearchMatch()
}

// ── Quick open ─────────────────────────────────────────────

const QUICK_OPEN_MAX_FILES = 500
const QUICK_OPEN_MAX_DIRS = 300
// Non-hidden build/dependency dirs that are expensive to recurse and rarely
// contain user docs. Dotfile directories (`.git`, `.DS_Store`, …) are already
// hidden by the `list_directory` backend.
const QUICK_OPEN_SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'target',
  'build',
  'out',
])

function relativePathFromRoot(path: string, root: string): string {
  const normalizedRoot = root.replace(/[/\\]+$/, '')
  return path
    .slice(normalizedRoot.length)
    .replace(/^[/\\]+/, '')
    .replace(/\\/g, '/')
}

async function collectQuickOpenFiles(
  dirPath: string,
  rootPath: string,
  files: QuickOpenFile[],
  counters: { dirs: number },
  isCancelled: () => boolean,
) {
  if (isCancelled()) return
  if (files.length >= QUICK_OPEN_MAX_FILES || counters.dirs >= QUICK_OPEN_MAX_DIRS) return

  counters.dirs += 1
  const entries = await listDirectory(dirPath)

  if (isCancelled()) return

  const directories: DirEntry[] = []
  for (const entry of entries) {
    if (files.length >= QUICK_OPEN_MAX_FILES) return
    if (entry.is_dir) {
      if (!QUICK_OPEN_SKIP_DIRS.has(entry.name)) directories.push(entry)
      continue
    }

    if (entry.is_markdown) {
      files.push({
        name: entry.name,
        path: entry.path,
        relativePath: relativePathFromRoot(entry.path, rootPath),
      })
    }
  }

  for (const directory of directories) {
    if (files.length >= QUICK_OPEN_MAX_FILES || counters.dirs >= QUICK_OPEN_MAX_DIRS) return
    await collectQuickOpenFiles(directory.path, rootPath, files, counters, isCancelled)
  }
}

async function refreshQuickOpenFiles(force = false) {
  const root = workspaceRoot.value
  if (!root) return

  // Serve from cache when fresh (unless force-refreshed).
  const cached = quickOpenCache.get(root)
  const now = Date.now()
  if (!force && cached && now - cached.scannedAt < QUICK_OPEN_CACHE_TTL_MS) {
    quickOpenFiles.value = cached.files
    return
  }

  // Invalidate any in-flight scan and start a new one.
  const token = ++quickOpenScanToken
  const isCancelled = () => token !== quickOpenScanToken

  quickOpenLoading.value = true
  quickOpenError.value = ''

  try {
    const files: QuickOpenFile[] = []
    await collectQuickOpenFiles(root, root, files, { dirs: 0 }, isCancelled)

    // A newer scan started (or this one was cancelled); discard results.
    if (isCancelled()) return

    files.sort((a, b) =>
      a.relativePath.toLocaleLowerCase().localeCompare(b.relativePath.toLocaleLowerCase())
    )
    quickOpenCache.set(root, { files, scannedAt: Date.now() })
    quickOpenFiles.value = files
  } catch (error) {
    if (isCancelled()) return
    quickOpenError.value = error instanceof Error ? error.message : String(error)
  } finally {
    if (!isCancelled()) quickOpenLoading.value = false
  }
}

async function openQuickOpen() {
  if (!workspaceRoot.value) {
    showToast('Open a folder before using Quick Open')
    return
  }

  quickOpenOpen.value = true
  nextTick(() => quickOpenEl.value?.focus())

  // Refresh in the background if no cached result; cache hit keeps it instant.
  const cached = quickOpenCache.get(workspaceRoot.value)
  const fresh = cached && Date.now() - cached.scannedAt < QUICK_OPEN_CACHE_TTL_MS
  if (!fresh) {
    await refreshQuickOpenFiles()
    nextTick(() => quickOpenEl.value?.focus())
  } else {
    quickOpenFiles.value = cached!.files
  }
}

function closeQuickOpen() {
  // Invalidate any in-flight scan so it does not overwrite state after close.
  quickOpenScanToken += 1
  quickOpenOpen.value = false
}


function openQuickOpenFile(file: QuickOpenFile) {
  closeQuickOpen()
  openFileFromTree(file.path)
}

// ── Auto-update ─────────────────────────────────────────────

async function checkForUpdate() {
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    if (update) {
      updateInfo.value = {
        version: update.version,
        downloadAndInstall: () => update.downloadAndInstall(),
      }
    }
  } catch {
    // Not in Tauri or updater not configured
  }
}

async function installUpdate() {
  if (!updateInfo.value) return
  try {
    showToast('Downloading update...', 'success')
    await updateInfo.value.downloadAndInstall()
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  } catch (e) {
    showToast(`Update failed: ${e instanceof Error ? e.message : String(e)}`)
  }
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

async function performAutoSave(slot: FileSlot): Promise<boolean> {
  if (!slot.dirty || !slot.editor) return true

  // If in source mode, sync CM → PM
  if (sourceMode.value && sourceEditor && activeFile.value?.id === slot.id) {
    const md = sourceEditor.getContent()
    // Internal sync, not a user edit: must not mark dirty / reschedule autosave
    slot.editor.commands.setContent(md, false)
    if (slot.filePath) convertLocalImagesInEditor(slot.editor, slot.filePath)
  }

  const content = getMarkdownContent(slot)
  if (content === null) return false

  try {
    if (slot.filePath) {
      await fileWrite(slot.filePath, content)
      slot.dirty = false
      slot.lastSavedContent = content
    } else {
      await tempSave(slot.filename, content)
      slot.lastSavedContent = content
    }
    return true
  } catch (e) {
    showToast(`Auto-save failed: ${e instanceof Error ? e.message : String(e)}`)
    return false
  }
}

function scheduleAutoSave(slot: FileSlot) {
  clearAutoSaveTimer(slot)
  const timer = setTimeout(() => performAutoSave(slot), AUTO_SAVE_DELAY)
  autoSaveTimers.set(slot.id, timer)
}

function scheduleAutoSaveForActiveFile() {
  const slot = activeFile.value
  if (!slot) return
  slot.dirty = true
  scheduleAutoSave(slot)
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
    slot.editor = markRaw(createEditor(el, slot.lastSavedContent, () => slot.filePath))
    if (slot.filePath) convertLocalImagesInEditor(slot.editor, slot.filePath)
    slot.editor.on('update', ({ transaction }: { transaction: Transaction }) => {
      if (transaction.getMeta('convertLocalImages')) return
      slot.dirty = true
      scheduleAutoSave(slot)
      if (searchOpen.value && slot.id === activeFileId.value) {
        syncSearchState()
      }
    })
  }
}

function switchToFile(id: string) {
  // If in source mode, save CM content to outgoing slot
  if (sourceMode.value && sourceEditor && activeFile.value?.editor) {
    const md = sourceEditor.getContent()
    // Internal sync, not a user edit: must not mark dirty / reschedule autosave
    activeFile.value.editor.commands.setContent(md, false)
    if (activeFile.value.filePath) convertLocalImagesInEditor(activeFile.value.editor, activeFile.value.filePath)
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
    // Internal sync, not a user edit: must not mark dirty / reschedule autosave
    slot.editor.commands.setContent(md, false)
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
        // md is a string from getContent(): an empty string is valid content
        // (the user cleared the whole document in source mode) and must still
        // be pushed back to ProseMirror, so only null (no source editor) is
        // skipped here.
        if (md !== null) {
          try {
            slot.editor.commands.setContent(md, false)
            if (slot.filePath) convertLocalImagesInEditor(slot.editor, slot.filePath)
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

    closeSearch()
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

async function confirmDiscardChanges(message: string): Promise<boolean> {
  try {
    const { ask } = await import('@tauri-apps/plugin-dialog')
    return await ask(message, {
      title: 'Unsaved Changes',
      kind: 'warning',
      okLabel: 'Discard',
      cancelLabel: 'Cancel',
    })
  } catch {
    return window.confirm(message)
  }
}

async function confirmUnsaved(fn: string): Promise<boolean> {
  return confirmDiscardChanges(`"${fn}" has unsaved changes. Close anyway?`)
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
  // Track whether any file was opened from startup params
  let openedFile = false

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
      openedFile = true
      try {
        const content = await fileRead(fp)
        const parts = fp.split(/[/\\]/)
        const fn = parts[parts.length - 1] || 'Untitled.md'
        const initialSlot = createFileSlot(content, fn, fp)
        switchToFile(initialSlot.id)
      } catch {
        // file read failed
      }
    }
  } catch {
    // not in browser context
  }

  // Check for files opened during app startup (before frontend was ready)
  try {
    const pending = await drainPendingFiles()
    for (const path of pending) {
      openedFile = true
      if (workspaceRoot.value) {
        openFileInNewWindow(path).catch(() => {})
      } else {
        openFileFromTree(path)
      }
    }
  } catch {
    // not in Tauri
  }

  // Only create an empty Untitled.md if nothing else was opened
  if (!openedFile && openFiles.value.length === 0) {
    const initialSlot = createFileSlot()
    switchToFile(initialSlot.id)
  }

  // ── Frontend menu bar (Windows) ────────────────────────────
  // (onMenuBarEvent is defined at top level so the template can bind it)

  // Menu events + keyboard shortcuts
  try {
    const { listen } = await import('@tauri-apps/api/event')
    unlistenMenu = await listen<string>('menu-event', (event) => {
      switch (event.payload) {
        case 'fn': handleNew(); break
        case 'fo': handleOpen(); break
        case 'ff': handleOpenFolder(); break
        case 'fq': openQuickOpen(); break
        case 'fs': handleSave(); break
        case 'ef': openSearch(); break
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
      if (dirtySlots.length === 0) return
      event.preventDefault()
      clearAllAutoSaveTimers()
      let allSaved = true
      for (const slot of dirtySlots) {
        const saved = await performAutoSave(slot)
        if (!saved) allSaved = false
      }
      if (!allSaved) {
        // Auto-save failed for at least one file: never destroy silently,
        // ask the user to confirm discarding the unsaved changes.
        const failed = dirtySlots.filter(f => f.dirty)
        const names = failed.map(f => f.filename).join(', ')
        const confirmed = await confirmDiscardChanges(
          `Auto-save failed for "${names}". Close anyway and lose unsaved changes?`
        )
        if (!confirmed) return
      }
      await appWindow.destroy()
    })
  } catch {
    // Not running in Tauri
  }

  // Check for updates (background, non-blocking)
  checkForUpdate()

  // Crash recovery
  await checkCrashRecovery()
})

function onMenuBarEvent(id: string) {
  if (id === 'vf') {
    toggleFullscreen().catch(() => {})
    return
  }
  switch (id) {
    case 'fn': handleNew(); break
    case 'fo': handleOpen(); break
    case 'ff': handleOpenFolder(); break
    case 'fq': openQuickOpen(); break
    case 'fs': handleSave(); break
    case 'ef': openSearch(); break
    case 'fc': handleClose(); break
    case 'vs': toggleSourceMode(); break
    case 'ep': handleExportPDF(); break
    case 'ed': handleExportDOCX(); break
    case 'ej': handleExportJPEG(); break
  }
}

function onAcceleratorKey(e: KeyboardEvent) {

  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'f') {
    if (sourceMode.value) return
    e.preventDefault()
    openSearch()
  }
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); openQuickOpen() }
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 's') { e.preventDefault(); handleSave() }
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'o') { e.preventDefault(); handleOpen() }
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'O') { e.preventDefault(); handleOpenFolder() }
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'n') { e.preventDefault(); handleNew() }
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'w') { e.preventDefault(); handleClose() }
  if (e.key === 'Escape' && sourceMode.value) { e.preventDefault(); toggleSourceMode() }
}

watch(activeEditor, () => {
  if (!searchOpen.value) return
  updateSearch(activeEditor.value, { query: searchQuery.value })
  syncSearchState()
  scrollToActiveSearchMatch()
})

watch(searchQuery, () => {
  if (!searchOpen.value) return
  applySearchQuery()
})

// Switching workspaces invalidates the file cache and any in-flight scan.
watch(workspaceRoot, (next, prev) => {
  if (next === prev) return
  quickOpenScanToken += 1
  quickOpenFiles.value = []
  quickOpenCache.delete(prev ?? '')
})

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
.update-toast {
  background: var(--bg-secondary, #f6f8fa);
  color: var(--text, #24292e);
  border: 1px solid var(--border, #e1e4e8);
  display: flex;
  align-items: center;
  gap: 10px;
  bottom: 24px;
  right: 24px;
}
.update-toast span {
  flex: 1;
}
.update-btn {
  padding: 4px 12px;
  border-radius: 4px;
  border: none;
  background: #0366d6;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.update-btn:hover {
  background: #0550ae;
}
.update-dismiss {
  background: none;
  border: none;
  font-size: 18px;
  color: #999;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}
.update-dismiss:hover {
  color: #333;
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
