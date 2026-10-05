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
    <div v-if="exporting" class="export-overlay">
      <div class="export-spinner" aria-hidden="true"></div>
      <div class="export-overlay-text">Exporting…</div>
    </div>
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
import { useStartupFiles } from './composables/useStartupFiles'

const isMac = navigator.platform.toUpperCase().includes('MAC')

const editorContainerEl = ref<HTMLElement | null>(null)
const openFiles = ref<FileSlot[]>([])
const activeFileId = ref('')
const toast = ref<{ message: string; type: 'error' | 'success' } | null>(null)
// Bumped on every editor document change. The editor instances are markRaw'd,
// so StatusBar needs this reactive counter to refresh word/char counts while
// the user types.
const editorVersion = ref(0)

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

// ── Composable assembly ────────────────────────────────────

// Each useXxx factory takes explicit dependencies and returns the same names
// the template and handlers have always used. Two pairs of composables are
// mutually dependent (autosave ↔ source-mode sync, source mode ↔ find bar);
// those bindings are deferred closures resolved right after both factories
// have run — the deferred calls only fire at user-interaction time.

const { workspaceRoot, effectiveSidebarMode, handleOpenFolder } = useWorkspace({
  openFiles, activeFilename, showToast,
})

let toastTimeout: ReturnType<typeof setTimeout> | null = null

const {
  clearAutoSaveTimer, clearAllAutoSaveTimers, performAutoSave,
  scheduleAutoSave, scheduleAutoSaveForActiveFile,
} = useAutoSave({
  activeFile, getMarkdownContent, showToast,
  // Bound after useSourceMode() below; the call itself is deferred until an
  // autosave actually runs, so the forward reference is safe.
  syncSourceToSlot: (slot, opts) => sourceModeApi.syncSourceToSlot(slot, opts),
})

const {
  sourceMode, sourceEditorEl, getSourceEditor, syncSourceToSlot,
  toggleSourceMode, destroySourceEditor,
} = useSourceMode({
  activeFile, getMarkdownContent, scheduleAutoSave,
  // Bound after useFindReplace() below; the call itself is deferred until the
  // user actually toggles source mode, so the forward reference is safe.
  closeSearch: () => searchApi.closeSearch(),
})
const sourceModeApi = { syncSourceToSlot }

const searchApi = useFindReplace({
  activeEditor, activeFileId, openFiles, editorContainerEl,
  sourceMode, scheduleAutoSaveForActiveFile,
})
const {
  searchOpen, searchQuery, replaceQuery, searchTotal, searchInputEl,
  searchCountLabel, syncSearchState, openSearch, closeSearch,
  goToNextSearchMatch, goToPreviousSearchMatch,
  replaceCurrentMatch, replaceAllMatches, onSearchEnter,
} = searchApi

const { handleExportPDF, handleExportDOCX, handleExportJPEG, exporting } = useExport({
  activeFile, activeFilename, showToast,
})

const {
  createFileSlot, setSlotElement, switchToFile, closeFile,
  handleSave, handleOpen, handleNew, handleClose,
  openFileFromTree, handleCycleNext, handleCyclePrev, confirmDiscardChanges,
} = useFileSlots({
  openFiles, activeFileId, activeFile, activeIndex, getMarkdownContent, showToast,
  bumpDocVersion: () => { editorVersion.value++ },
  onActiveSlotDocumentChanged: (slot) => {
    if (searchOpen.value && slot.id === activeFileId.value) syncSearchState()
  },
  scheduleAutoSave, clearAutoSaveTimer,
  sourceMode, getSourceEditor, syncSourceToSlot,
})

const {
  quickOpenOpen, quickOpenFiles, quickOpenLoading, quickOpenError, quickOpenEl,
  openQuickOpen, closeQuickOpen, openQuickOpenFile,
} = useQuickOpen({ workspaceRoot, showToast, openFileFromTree })

const { onMenuBarEvent, registerMenuEventListener } = useShortcuts({
  handleNew, handleOpen, handleOpenFolder, openQuickOpen, handleSave, openSearch,
  handleClose, toggleSourceMode,
  handleExportPDF, handleExportDOCX, handleExportJPEG,
  handleCycleNext, handleCyclePrev,
  isSourceMode: () => sourceMode.value,
})

const {
  updateInfo,
  checkForUpdate,
  installUpdate,
  checkCrashRecovery,
  registerWindowCloseHandler,
  registerFileOpenListener,
  registerFocusChangeListener,
} = useAppLifecycle({
  openFiles,
  workspaceRoot,
  showToast,
  performAutoSave,
  clearAllAutoSaveTimers,
  confirmDiscardChanges,
  createFileSlot,
  switchToFile,
})

const { openStartupFiles } = useStartupFiles({
  workspaceRoot,
  openFiles,
  createFileSlot,
  switchToFile,
  openFileFromTree,
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
  await openStartupFiles()

  // ── Menu + file-open events (keyboard shortcuts live in useShortcuts) ──
  try {
    await registerMenuEventListener()
    await registerFileOpenListener(openFileFromTree)
  } catch {
    // Not running in Tauri
  }

  // Window close
  try {
    await registerWindowCloseHandler()
  } catch {
    // Not running in Tauri
  }

  // External file-change detection on window focus
  try {
    await registerFocusChangeListener()
  } catch {
    // Not running in Tauri
  }

  // Check for updates (background, non-blocking)
  checkForUpdate()

  // Crash recovery
  await checkCrashRecovery()
})

onBeforeUnmount(() => {
  if (toastTimeout) clearTimeout(toastTimeout)
})
</script>

<style src="./app.css"></style>
