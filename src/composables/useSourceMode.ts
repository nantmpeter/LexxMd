import { ref, nextTick, onBeforeUnmount } from 'vue'
import type { ComputedRef } from 'vue'
import { createSourceEditor } from '../editor/source-editor'
import { convertLocalImagesInEditor } from '../editor/extensions/lexx-image'
import type { FileSlot } from '../types'

/** Result of pushing CodeMirror content back into a slot's ProseMirror editor. */
export interface SyncSourceToSlotOptions {
  /** Also re-resolve local image paths against the slot's file path. */
  convertImages: boolean
}

/**
 * Push the CodeMirror content back into a slot's ProseMirror editor.
 * Internal sync, not a user edit: must not mark dirty / reschedule autosave
 * (setContent runs with emitUpdate=false). No-op when source mode is off or
 * the slot has no editor.
 *
 * Returns the image-conversion promise when one runs: callers that serialize
 * the document afterwards (export / print) MUST await it — the src rewrite is
 * an async transaction, and serializing before it lands would export
 * unresolved relative paths (missing images). Serialization that only reads
 * the markdown (save flows, `data-md-src`) is unaffected and may fire and
 * forget.
 */
export type SyncSourceToSlot = (
  slot: FileSlot | null | undefined,
  options: SyncSourceToSlotOptions,
) => void | Promise<void>

interface UseSourceModeOptions {
  activeFile: ComputedRef<FileSlot | null>
  getMarkdownContent: (slot: FileSlot) => string | null
  /** Schedules an autosave; called when the user edits in CodeMirror. */
  scheduleAutoSave: (slot: FileSlot) => void
  closeSearch: () => void
}

export function useSourceMode(options: UseSourceModeOptions) {
  const { activeFile, getMarkdownContent, scheduleAutoSave, closeSearch } = options

  const sourceMode = ref(false)
  const sourceEditorEl = ref<HTMLElement | null>(null)
  let sourceEditor: ReturnType<typeof createSourceEditor> | null = null

  function getSourceEditor() {
    return sourceEditor
  }

  /**
   * Push the CodeMirror content back into a slot's ProseMirror editor.
   * Internal sync, not a user edit: must not mark dirty / reschedule autosave
   * (setContent runs with emitUpdate=false). No-op when source mode is off or
   * the slot has no editor.
   */
  const syncSourceToSlot: SyncSourceToSlot = (slot, { convertImages }) => {
    if (!sourceMode.value || !sourceEditor || !slot?.editor) return
    const md = sourceEditor.getContent()
    slot.editor.commands.setContent(md, false)
    // Hand the async conversion promise to the caller: serialization that
    // renders the DOM (export/print) must await it, or the src rewrite lands
    // after the exported clone and local images go missing. See the
    // SyncSourceToSlot doc comment for who awaits and who may not.
    if (convertImages && slot.filePath) return convertLocalImagesInEditor(slot.editor, slot.filePath)
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

  function destroySourceEditor() {
    if (sourceEditor) sourceEditor.destroy()
    sourceEditor = null
  }

  onBeforeUnmount(destroySourceEditor)

  return {
    sourceMode,
    sourceEditorEl,
    getSourceEditor,
    syncSourceToSlot,
    toggleSourceMode,
    destroySourceEditor,
  }
}
