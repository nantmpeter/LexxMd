import type { Ref, ComputedRef } from 'vue'
import { convertLocalImagesInEditor } from '../editor/extensions/lexx-image'
import type { createSourceEditor } from '../editor/source-editor'
import { fileWrite, tempSave } from '../tauri/commands'
import type { FileSlot } from '../types'
import type { ToastFn } from './useQuickOpen'

type SourceEditor = ReturnType<typeof createSourceEditor>

interface UseAutoSaveOptions {
  /** Whether the source (CodeMirror) mode is currently active. */
  sourceMode: Ref<boolean>
  /** The lazily created source editor singleton, if any. */
  getSourceEditor: () => SourceEditor | null
  /** The currently visible slot; CM→PM sync only applies to it. */
  activeFile: ComputedRef<FileSlot | null>
  getMarkdownContent: (slot: FileSlot) => string | null
  showToast: ToastFn
}

const AUTO_SAVE_DELAY = 3000

export function useAutoSave(options: UseAutoSaveOptions) {
  const { sourceMode, getSourceEditor, activeFile, getMarkdownContent, showToast } = options

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

    // If in source mode, sync CM → PM
    const sourceEditor = getSourceEditor()
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

  return {
    clearAutoSaveTimer,
    clearAllAutoSaveTimers,
    performAutoSave,
    scheduleAutoSave,
    scheduleAutoSaveForActiveFile,
  }
}
