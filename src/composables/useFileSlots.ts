import { markRaw, nextTick, onBeforeUnmount } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { createEditor } from '../editor/index'
import { convertLocalImagesInEditor } from '../editor/extensions/lexx-image'
import type { Transaction } from '@tiptap/pm/state'
import type { createSourceEditor } from '../editor/source-editor'
import { fileWrite, saveFileDialog, saveFileDialogWithFilter, fileRead, openFileDialog, deleteTempFile } from '../tauri/commands'
import type { FileSlot } from '../types'
import { uniqueUntitledName } from '../untitled'
import type { ToastFn } from './useQuickOpen'
import type { SyncSourceToSlot } from './useSourceMode'

type SourceEditor = ReturnType<typeof createSourceEditor>

interface UseFileSlotsOptions {
  openFiles: Ref<FileSlot[]>
  activeFileId: Ref<string>
  activeFile: ComputedRef<FileSlot | null>
  /** Index of the active slot in openFiles (-1 when none). */
  activeIndex: ComputedRef<number>
  getMarkdownContent: (slot: FileSlot) => string | null
  showToast: ToastFn
  /** Bumps the reactive counter StatusBar consumes on document changes. */
  bumpDocVersion: () => void
  /** Called after an active slot's document changed (search highlight refresh). */
  onActiveSlotDocumentChanged: (slot: FileSlot) => void
  scheduleAutoSave: (slot: FileSlot) => void
  clearAutoSaveTimer: (slot: FileSlot) => void
  sourceMode: Ref<boolean>
  getSourceEditor: () => SourceEditor | null
  syncSourceToSlot: SyncSourceToSlot
  /** Called with the path after a file successfully opened (recents feed). */
  onFileOpened?: (path: string) => void
  /** Called with the chosen path after a save-to-new-path succeeds (recents feed). */
  onFileSavedToPath?: (path: string) => void
}

export function useFileSlots(options: UseFileSlotsOptions) {
  const {
    openFiles,
    activeFileId,
    activeFile,
    activeIndex,
    getMarkdownContent,
    showToast,
    bumpDocVersion,
    onActiveSlotDocumentChanged,
    scheduleAutoSave,
    clearAutoSaveTimer,
    sourceMode,
    getSourceEditor,
    syncSourceToSlot,
    onFileOpened,
    onFileSavedToPath,
  } = options

  let idCounter = 0
  const slotElements = new Map<string, HTMLElement>()

  function createFileSlot(content: string = '', fn: string | null = null, fp: string | null = null): FileSlot {
    const id = `file-${++idCounter}`
    const slot: FileSlot = {
      id,
      filePath: fp,
      // Untitled slots get a cross-window-unique name: the temp directory is
      // shared app-wide, so a constant name would collide between windows.
      filename: fn ?? uniqueUntitledName(),
      dirty: false,
      editor: null,
      element: null,
      lastSavedContent: content,
      tempPath: null,
    }
    openFiles.value.push(slot)
    return slot
  }

  function cleanupSlotTemp(slot: FileSlot) {
    if (!slot.tempPath) return
    deleteTempFile(slot.tempPath).catch(() => { /* best effort */ })
    slot.tempPath = null
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
        // Any document change (including image-path conversion) must refresh the
        // StatusBar counters; the dirty/autosave branch below intentionally skips
        // conversion transactions.
        if (transaction.docChanged) bumpDocVersion()
        if (transaction.getMeta('convertLocalImages')) return
        slot.dirty = true
        scheduleAutoSave(slot)
        onActiveSlotDocumentChanged(slot)
      })
    }
  }

  function switchToFile(id: string) {
    // If in source mode, save CM content to the outgoing slot (internal sync:
    // must not mark dirty / reschedule autosave; no-op outside source mode)
    syncSourceToSlot(activeFile.value, { convertImages: true })

    activeFileId.value = id

    // Load new file's markdown into CM if in source mode
    const sourceEditor = getSourceEditor()
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

    // Only the active view may be moved: closing a background tab must leave
    // the currently visible file (and any source-mode session) untouched.
    const wasActive = slot.id === activeFileId.value

    clearAutoSaveTimer(slot)
    cleanupSlotTemp(slot)
    slot.editor?.destroy()

    const idx = openFiles.value.findIndex(f => f.id === slot.id)
    openFiles.value = openFiles.value.filter(f => f.id !== slot.id)
    slotElements.delete(slot.id)

    if (openFiles.value.length === 0) {
      const newSlot = createFileSlot()
      switchToFile(newSlot.id)
    } else if (wasActive) {
      const newIdx = Math.min(idx, openFiles.value.length - 1)
      switchToFile(openFiles.value[newIdx].id)
    }

    return true
  }

  // ── File operations ────────────────────────────────────────

  /** File-type filter shared by every Markdown save dialog. */
  const MARKDOWN_SAVE_FILTERS = [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdx'] }]

  /**
   * Shared tail of every "save to a user-chosen path" flow (untitled first
   * save and Save As): prompt for a path, write, and re-point the slot at the
   * new location. Cancel keeps the slot untouched. The window title and the
   * sidebar pick up the new filename through the existing
   * `watch(activeFilename)` in useWorkspace — no extra plumbing here.
   */
  async function writeSlotToChosenPath(
    slot: FileSlot,
    content: string,
    pickPath: () => Promise<string | null>,
  ): Promise<void> {
    const chosenPath = await pickPath()
    if (!chosenPath) return
    await fileWrite(chosenPath, content)
    slot.filePath = chosenPath
    const parts = chosenPath.split(/[/\\]/)
    slot.filename = parts[parts.length - 1] || 'Untitled.md'
    slot.dirty = false
    slot.lastSavedContent = content
    slot.externalChangeNotified = false
    // The document now lives at its real path: drop the crash-recovery
    // temp copy so the next launch does not offer a stale duplicate.
    cleanupSlotTemp(slot)
    onFileSavedToPath?.(chosenPath)
    showToast('Saved', 'success')
  }

  async function handleSave() {
    const slot = activeFile.value
    if (!slot?.editor) return

    // If in source mode, sync CM → PM before saving (internal sync: must not
    // mark dirty / reschedule autosave; no-op outside source mode)
    syncSourceToSlot(slot, { convertImages: false })

    clearAutoSaveTimer(slot)
    const content = getMarkdownContent(slot)
    if (content === null) return

    try {
      if (slot.filePath) {
        await fileWrite(slot.filePath, content)
        slot.dirty = false
        slot.lastSavedContent = content
        slot.externalChangeNotified = false
        showToast('Saved', 'success')
      } else {
        await writeSlotToChosenPath(slot, content, () => saveFileDialog(slot.filename))
      }
    } catch (e) {
      showToast(`Save failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleSaveAs() {
    const slot = activeFile.value
    if (!slot?.editor) return

    // If in source mode, sync CM → PM before saving (internal sync: must not
    // mark dirty / reschedule autosave; no-op outside source mode)
    syncSourceToSlot(slot, { convertImages: false })

    clearAutoSaveTimer(slot)
    const content = getMarkdownContent(slot)
    if (content === null) return

    try {
      await writeSlotToChosenPath(slot, content, () =>
        saveFileDialogWithFilter(slot.filename, MARKDOWN_SAVE_FILTERS),
      )
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
        onFileOpened?.(result.path)
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

  async function openFileFromTree(path: string) {
    try {
      const content = await fileRead(path)
      // Dedup must sit AFTER the await: `fileRead` is async, so a check placed
      // before it lets two rapid activations of the same file (double-click on
      // a tree node) both pass and each create its own slot — the double-open
      // race. Re-checking here, immediately before createFileSlot, makes the
      // second call reuse the slot the first one just created.
      // (Smoke-tested only: mounting App.vue in vitest would require mocking
      // the whole Tauri layer.)
      const existing = openFiles.value.find(f => f.filePath === path)
      if (existing) {
        switchToFile(existing.id)
        return
      }

      const parts = path.split(/[/\\]/)
      const fn = parts[parts.length - 1] || 'Untitled.md'
      const slot = createFileSlot(content, fn, path)
      switchToFile(slot.id)
      onFileOpened?.(path)
    } catch (e) {
      showToast(`Failed to open: ${e instanceof Error ? e.message : String(e)}`)
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

  // ── Unsaved-changes confirmation ───────────────────────────

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

  onBeforeUnmount(() => {
    for (const slot of openFiles.value) {
      slot.editor?.destroy()
    }
  })

  return {
    createFileSlot,
    setSlotElement,
    switchToFile,
    closeFile,
    handleSave,
    handleSaveAs,
    handleOpen,
    handleNew,
    handleClose,
    openFileFromTree,
    handleCycleNext,
    handleCyclePrev,
    confirmDiscardChanges,
  }
}
