import { onBeforeUnmount } from 'vue'
import type { ComputedRef } from 'vue'
import { fileWrite, tempSave } from '../tauri/commands'
import type { FileSlot } from '../types'
import type { ToastFn } from './useQuickOpen'
import type { SyncSourceToSlot } from './useSourceMode'

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
}

const AUTO_SAVE_DELAY = 3000

export function useAutoSave(options: UseAutoSaveOptions) {
  const { activeFile, getMarkdownContent, syncSourceToSlot, showToast } = options

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
        await fileWrite(slot.filePath, content)
        slot.dirty = false
        slot.lastSavedContent = content
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
    const timer = setTimeout(() => performAutoSave(slot), AUTO_SAVE_DELAY)
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