import { onBeforeUnmount } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { fileRead, fileWrite, tempSave } from '../tauri/commands'
import type { FileSlot } from '../types'
import type { ToastFn } from './useQuickOpen'
import type { SyncSourceToSlot } from './useSourceMode'
import type { Prefs } from './usePrefs'

interface UseAutoSaveOptions {
  /** The currently visible slot; CM→PM sync only applies to it. */
  activeFile: ComputedRef<FileSlot | null>
  getMarkdownContent: (slot: FileSlot) => string | null
  /**
   * Pushes CodeMirror content into a slot before serializing (no-op outside
   * source mode). Internal sync, never marks dirty / reschedules.
   */
  syncSourceToSlot: SyncSourceToSlot
  showToast: ToastFn
  /** Live preferences: autosaveEnabled gates scheduling, autosaveDelayMs the timer. */
  prefs: Ref<Prefs>
}

export function useAutoSave(options: UseAutoSaveOptions) {
  const { activeFile, getMarkdownContent, syncSourceToSlot, showToast, prefs } = options

  const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

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

    // If in source mode, sync CM → PM for the visible slot. The helper is a
    // no-op outside source mode; the sync itself is internal (emitUpdate=false)
    // and must not mark dirty / reschedule autosave.
    if (activeFile.value?.id === slot.id) {
      syncSourceToSlot(slot, { convertImages: true })
    }

    const content = getMarkdownContent(slot)
    if (content === null) return false

    try {
      if (slot.filePath) {
        // External-change guard: if the file on disk no longer matches what
        // we last saved, another editor modified it. Autosave must never
        // silently clobber external edits — skip the write and keep the
        // user's in-editor changes (dirty stays true so nothing is lost).
        const onDisk = await fileRead(slot.filePath)
        if (onDisk !== slot.lastSavedContent) {
          showToast('File changed outside Lexx — use Save As to keep both versions')
          return false
        }
        await fileWrite(slot.filePath, content)
        slot.dirty = false
        slot.lastSavedContent = content
        slot.externalChangeNotified = false
      } else {
        slot.tempPath = await tempSave(slot.filename, content)
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
    // Autosave disabled: dirty tracking still happens (this is the only
    // scheduler entry point), but no timer is armed — content is saved only
    // through explicit Save / window-close flows.
    if (!prefs.value.autosaveEnabled) return
    const timer = setTimeout(() => performAutoSave(slot), prefs.value.autosaveDelayMs)
    autoSaveTimers.set(slot.id, timer)
  }

  function scheduleAutoSaveForActiveFile() {
    const slot = activeFile.value
    if (!slot) return
    slot.dirty = true
    scheduleAutoSave(slot)
  }

  onBeforeUnmount(clearAllAutoSaveTimers)

  return {
    clearAutoSaveTimer,
    clearAllAutoSaveTimers,
    performAutoSave,
    scheduleAutoSave,
    scheduleAutoSaveForActiveFile,
  }
}
