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
      :editor-version="editorVersion"
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
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import StatusBar from './ui/StatusBar.vue'
import OutlineView from './ui/OutlineView.vue'
import Sidebar from './ui/Sidebar.vue'
import MenuBar from './ui/MenuBar.vue'
import FindBar from './ui/FindBar.vue'
import QuickOpen from './ui/QuickOpen.vue'
import { fileRead, updateWindowTitle, openFileInNewWindow, drainPendingFiles } from './tauri/commands'
import type { FileSlot } from './types'
import { useQuickOpen } from './composables/useQuickOpen'
import { useAutoSave } from './composables/useAutoSave'
import { useSourceMode } from './composables/useSourceMode'
import { useFileSlots } from './composables/useFileSlots'
import { useShortcuts } from './composables/useShortcuts'
import { useFindReplace } from './composables/useFindReplace'
import { useExport } from './composables/useExport'
import { useWorkspace } from './composables/useWorkspace'
import { useAppLifecycle } from './composables/useAppLifecycle'

const isMac = navigator.platform.toUpperCase().includes('MAC')

const editorContainerEl = ref<HTMLElement | null>(null)
const openFiles = ref<FileSlot[]>([])
const activeFileId = ref('')
const toast = ref<{ message: string; type: 'error' | 'success' } | null>(null)
// Bumped on every editor document change. The editor instances are markRaw'd,
// so StatusBar needs this reactive counter to refresh word/char counts while
// the user types.
const editorVersion = ref(0)

// ── Composable assembly ────────────────────────────────────

const {
  workspaceRoot,
  effectiveSidebarMode,
  handleOpenFolder,
} = useWorkspace({
  openFiles,
  showToast,
})

let toastTimeout: ReturnType<typeof setTimeout> | null = null

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

const {
  clearAutoSaveTimer,
  clearAllAutoSaveTimers,
  performAutoSave,
  scheduleAutoSave,
  scheduleAutoSaveForActiveFile,
} = useAutoSave({
  activeFile,
  getMarkdownContent,
  // Bound after useSourceMode() below; the call itself is deferred until an
  // autosave actually runs, so the forward reference is safe.
  syncSourceToSlot: (slot, opts) => sourceModeApi.syncSourceToSlot(slot, opts),
  showToast,
})

const {
  sourceMode,
  sourceEditorEl,
  getSourceEditor,
  syncSourceToSlot,
  toggleSourceMode,
  destroySourceEditor,
} = useSourceMode({
  activeFile,
  getMarkdownContent,
  scheduleAutoSave,
  // Bound after useFindReplace() below; the call itself is deferred until the
  // user actually toggles source mode, so the forward reference is safe.
  closeSearch: () => searchApi.closeSearch(),
})
const sourceModeApi = { syncSourceToSlot }

const searchApi = useFindReplace({
  activeEditor,
  activeFileId,
  openFiles,
  editorContainerEl,
  sourceMode,
  scheduleAutoSaveForActiveFile,
})
const {
  searchOpen,
  searchQuery,
  replaceQuery,
  searchTotal,
  searchInputEl,
  searchCountLabel,
  syncSearchState,
  openSearch,
  closeSearch,
  goToNextSearchMatch,
  goToPreviousSearchMatch,
  replaceCurrentMatch,
  replaceAllMatches,
  onSearchEnter,
} = searchApi

const {
  handleExportPDF,
  handleExportDOCX,
  handleExportJPEG,
} = useExport({
  activeFile,
  activeFilename,
  showToast,
})

const {
  createFileSlot,
  setSlotElement,
  switchToFile,
  closeFile,
  handleSave,
  handleOpen,
  handleNew,
  handleClose,
  openFileFromTree,
  handleCycleNext,
  handleCyclePrev,
  confirmDiscardChanges,
} = useFileSlots({
  openFiles,
  activeFileId,
  activeFile,
  activeIndex,
  getMarkdownContent,
  showToast,
  bumpDocVersion: () => { editorVersion.value++ },
  onActiveSlotDocumentChanged: (slot) => {
    if (searchOpen.value && slot.id === activeFileId.value) {
      syncSearchState()
    }
  },
  scheduleAutoSave,
  clearAutoSaveTimer,
  sourceMode,
  getSourceEditor,
  syncSourceToSlot,
})

const {
  quickOpenOpen,
  quickOpenFiles,
  quickOpenLoading,
  quickOpenError,
  quickOpenEl,
  openQuickOpen,
  closeQuickOpen,
  openQuickOpenFile,
} = useQuickOpen({
  workspaceRoot,
  showToast,
  openFileFromTree,
})

const { onMenuBarEvent, registerMenuEventListener } = useShortcuts({
  handleNew,
  handleOpen,
  handleOpenFolder,
  openQuickOpen,
  handleSave,
  openSearch,
  handleClose,
  toggleSourceMode,
  handleExportPDF,
  handleExportDOCX,
  handleExportJPEG,
  handleCycleNext,
  handleCyclePrev,
  isSourceMode: () => sourceMode.value,
})

const {
  updateInfo,
  checkForUpdate,
  installUpdate,
  checkCrashRecovery,
  registerWindowCloseHandler,
} = useAppLifecycle({
  openFiles,
  showToast,
  performAutoSave,
  clearAllAutoSaveTimers,
  confirmDiscardChanges,
  createFileSlot,
  switchToFile,
})

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

  // ── Menu events (keyboard shortcuts are registered by useShortcuts) ──
  try {
    await registerMenuEventListener()

    // File-open events from OS (double-click .md file, drag to dock, etc.)
    const { listen } = await import('@tauri-apps/api/event')
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

  // Window close
  try {
    await registerWindowCloseHandler()
  } catch {
    // Not running in Tauri
  }

  // Check for updates (background, non-blocking)
  checkForUpdate()

  // Crash recovery
  await checkCrashRecovery()
})

onBeforeUnmount(() => {
  clearAllAutoSaveTimers()
  destroySourceEditor()
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
