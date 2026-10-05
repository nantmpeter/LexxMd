import { describe, it, expect, afterEach } from 'vitest'
import { computed, nextTick } from 'vue'
import { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { FixContentParsing } from '../editor/extensions/fix-content-parsing'
import { useSourceMode } from './useSourceMode'
import type { FileSlot } from '../types'

describe('useSourceMode', () => {
  let editor: Editor | null = null

  afterEach(() => {
    editor?.destroy()
    editor = null
  })

  // Same assertion setup as fix-content-parsing.test.ts (batch-1 item 2.4):
  // track every update transaction and require the CM→PM sync to emit none.
  function createTrackedSlot(): { slot: FileSlot; updates: Transaction[] } {
    const updates: Transaction[] = []
    editor = new Editor({
      extensions: [StarterKit, Markdown, FixContentParsing],
    })
    editor.on('update', ({ transaction }) => {
      updates.push(transaction)
    })
    const slot: FileSlot = {
      id: 'slot-1',
      filePath: null,
      filename: 'test.md',
      dirty: false,
      editor,
      element: null,
      lastSavedContent: '',
      tempPath: null,
    }
    return { slot, updates }
  }

  function createComposable(slot: FileSlot) {
    return useSourceMode({
      activeFile: computed(() => slot),
      getMarkdownContent: () => 'pm content',
      scheduleAutoSave: () => {},
      closeSearch: () => {},
    })
  }

  it('exiting source mode pushes CM content back without emitting update or marking dirty', async () => {
    const { slot, updates } = createTrackedSlot()
    const { sourceEditorEl, getSourceEditor, toggleSourceMode } = createComposable(slot)
    sourceEditorEl.value = document.createElement('div')

    // Enter source mode: loads PM content into CodeMirror.
    toggleSourceMode()
    expect(sourceEditorEl.value.querySelector('.cm-editor')).not.toBeNull()

    // User edits in source mode.
    getSourceEditor()!.setContent('edited in source')

    // Exit source mode: the CM content must be pushed back into ProseMirror
    // as an internal sync (setContent emitUpdate=false), so no update event
    // fires and the slot is not marked dirty.
    toggleSourceMode()
    await nextTick()

    expect(slot.editor.getText()).toContain('edited in source')
    expect(updates).toHaveLength(0)
    expect(slot.dirty).toBe(false)
  })

  it('syncSourceToSlot is a no-op while source mode is off', () => {
    const { slot, updates } = createTrackedSlot()
    const { syncSourceToSlot } = createComposable(slot)

    syncSourceToSlot(slot, { convertImages: false })

    expect(updates).toHaveLength(0)
  })
})
