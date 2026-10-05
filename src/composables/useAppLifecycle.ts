import { ref } from 'vue'
import type { Ref } from 'vue'
import type { CommandProps } from '@tiptap/core'
import {
  listTempFiles, deleteTempFile, fileRead, openFileInNewWindow, consumePendingFile,
} from '../tauri/commands'
import { convertLocalImagesInEditor } from '../editor/extensions/lexx-image'
import type { FileSlot } from '../types'
import type { ToastFn } from './useQuickOpen'

interface UseAppLifecycleOptions {
  openFiles: Ref<FileSlot[]>
  workspaceRoot: Ref<string | null>
  showToast: ToastFn
  performAutoSave: (slot: FileSlot) => Promise<boolean>
  clearAllAutoSaveTimers: () => void
  confirmDiscardChanges: (message: string) => Promise<boolean>
  createFileSlot: (content?: string, filename?: string | null, filePath?: string | null) => FileSlot
  switchToFile: (id: string) => void
  /** True when the slot is currently being edited in the CodeMirror source pane. */
  isSlotInSourceMode: (slot: FileSlot) => boolean
  /**
   * Re-reads prefs.json into memory, called on every window focus so changes
   * saved by another window take effect here (no event broadcast needed).
   */
  reloadPrefs?: () => void | Promise<void>
}

export function useAppLifecycle(options: UseAppLifecycleOptions) {
  const {
    openFiles,
    workspaceRoot,
    showToast,
    performAutoSave,
    clearAllAutoSaveTimers,
    confirmDiscardChanges,
    createFileSlot,
    switchToFile,
    isSlotInSourceMode,
    reloadPrefs,
  } = options

  // ── Auto-update ─────────────────────────────────────────────

  const updateInfo = ref<{ version: string; downloadAndInstall: () => Promise<void> } | null>(null)

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

  // ── Crash recovery ─────────────────────────────────────────

  async function checkCrashRecovery() {
    // Crash-recovery temp files are app-global, but only the main window may
    // prompt for them: every window runs this on mount, so a secondary window
    // would treat the live session's Untitled drafts as crash leftovers, and
    // its "Discard" would delete the recovery copy another open window still
    // belongs to. Secondary windows only exist while the app is already
    // running, so their mounts can never be a crash recovery.
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    if (getCurrentWebviewWindow().label !== 'main') return
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

  // ── Window close flow ──────────────────────────────────────

  async function registerWindowCloseHandler(): Promise<void> {
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
  }

  // ── OS file-open events (double-click .md file, drag to dock, etc.) ──

  async function registerFileOpenListener(openFileFromTree: (path: string) => void | Promise<void>): Promise<void> {
    // Scoped to THIS window on purpose: the backend emits 'file-open' only
    // to the focused window (the one the OS/single-instance flow activated),
    // and delivery targeting requires the listener to register the window as
    // its event target — bare listen() would fire here in every open window.
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    await getCurrentWebviewWindow().listen<string>('file-open', (event) => {
      const path = event.payload
      // The macOS Opened path emits AND buffers (the buffer is the cold-launch
      // fallback for before this listener existed). Consuming the buffered
      // copy now keeps the two paths single-delivery: a later window's
      // drainPendingFiles must not re-open what this event just delivered.
      consumePendingFile(path).catch(() => {})
      if (workspaceRoot.value) {
        // Folder mode → open file in a new window
        openFileInNewWindow(path).catch(() => {})
      } else {
        // No workspace → open in current window
        openFileFromTree(path)
      }
    })
  }

  // ── External file changes (window focus) ──────────────────

  /**
   * On every window focus, compare each open saved file against what we last
   * wrote. A clean (non-dirty) saved file whose disk content diverged is
   * auto-reloaded into its editor: setContent with emitUpdate=false (the
   * document is identical to disk, so this must not mark the slot dirty),
   * then the local-image conversion pass runs (the same contract as an
   * initial open), then the saved-content baseline moves to the disk text.
   *
   * The reload transaction is kept OUT of undo history: lastSavedContent was
   * already moved to the disk text, so an undo that resurrected the old
   * document would look like a legitimate user edit and the autosave guard
   * would silently write the stale content back over the newer disk file.
   * The meta rides on the same transaction setContent dispatches (tiptap
   * chains share one tr; run() dispatches it once), mirroring the
   * addToHistory contract of convertLocalImagesInEditor.
   *
   * Dirty slots are never touched — the user's unsaved edits outrank the
   * disk version, and their external-change toast already fires at autosave
   * write time.
   *
   * Slots currently open in the source-mode pane are only notified, never
   * reloaded: the pane's CodeMirror buffer still holds the pre-reload text,
   * so writing it back on exit would clobber the fresh disk version — and
   * re-baselining lastSavedContent here would disable the autosave guard
   * against exactly that write-back. Leaving the baseline untouched means
   * the first focus after the slot leaves source mode reloads it normally.
   */
  async function checkExternalChanges(): Promise<void> {
    for (const slot of openFiles.value) {
      if (!slot.filePath || slot.dirty) continue
      try {
        const onDisk = await fileRead(slot.filePath)
        if (onDisk === slot.lastSavedContent) continue
        if (isSlotInSourceMode(slot)) {
          showToast(`File changed outside Lexx — ${slot.filename} will reload when you leave source mode`)
          continue
        }
        if (!slot.editor) continue
        // setContent(content, false) keeps preventUpdate (no dirty marking),
        // but its replacement transaction used to enter undo history; the
        // chain step pins addToHistory=false onto that same transaction.
        const reloaded = slot.editor
          .chain()
          .command(({ tr }: CommandProps) => {
            tr.setMeta('addToHistory', false)
            return true
          })
          .setContent(onDisk, false)
          .run()
        if (!reloaded) continue
        await convertLocalImagesInEditor(slot.editor, slot.filePath)
        slot.lastSavedContent = onDisk
        showToast(`Reloaded ${slot.filename} (changed outside Lexx)`)
      } catch {
        // Unreadable (deleted/moved): leave the slot alone; autosave will
        // surface the write failure on its next run.
      }
    }
  }

  async function registerFocusChangeListener(): Promise<void> {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const appWindow = getCurrentWindow()
    await appWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused) return
      // Prefs are written per window with no broadcast: re-reading the file on
      // focus is the lazy cross-window sync. Focus implies the user just
      // switched TO this window, so no in-flight slider drag can race the
      // reload, and re-reading our own writes is a no-op (same values).
      if (reloadPrefs) Promise.resolve(reloadPrefs()).catch(() => {})
      checkExternalChanges().catch(() => {})
    })
  }

  return {
    updateInfo,
    checkForUpdate,
    installUpdate,
    checkCrashRecovery,
    checkExternalChanges,
    registerWindowCloseHandler,
    registerFileOpenListener,
    registerFocusChangeListener,
  }
}
