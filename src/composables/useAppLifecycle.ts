import { ref } from 'vue'
import type { Ref } from 'vue'
import { listTempFiles, deleteTempFile, fileRead, openFileInNewWindow } from '../tauri/commands'
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
  }

  // ── External file changes (window focus) ──────────────────

  /**
   * On every window focus, compare each open saved file against what we last
   * wrote. Known v1 simplification: this only notifies (once per file per
   * mismatch episode) — the external version is NOT auto-reloaded; the user
   * must close and reopen the file to pick it up.
   */
  async function checkExternalChanges(): Promise<void> {
    for (const slot of openFiles.value) {
      // Dirty slots are protected by the autosave write guard instead; their
      // toast fires at write time, so don't double-notify here.
      if (!slot.filePath || slot.dirty || slot.externalChangeNotified) continue
      try {
        const onDisk = await fileRead(slot.filePath)
        if (onDisk !== slot.lastSavedContent) {
          slot.externalChangeNotified = true
          showToast(`${slot.filename} changed outside Lexx — close and reopen it to load the external version`)
        }
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
      checkExternalChanges().catch(() => {})
    })
  }

  return {
    updateInfo,
    checkForUpdate,
    installUpdate,
    checkCrashRecovery,
    registerWindowCloseHandler,
    registerFileOpenListener,
    registerFocusChangeListener,
  }
}
