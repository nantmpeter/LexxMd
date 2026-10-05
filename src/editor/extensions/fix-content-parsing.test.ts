import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { FixContentParsing } from './fix-content-parsing'

describe('FixContentParsing', () => {
  let editor: Editor | null = null

  afterEach(() => {
    editor?.destroy()
    editor = null
  })

  function createEditorWithUpdateTracking() {
    const updates: Transaction[] = []
    editor = new Editor({
      extensions: [StarterKit, Markdown, FixContentParsing],
    })
    editor.on('update', ({ transaction }) => {
      updates.push(transaction)
    })
    return { editor, updates }
  }

  it('does not emit update when emitUpdate is false (string content)', () => {
    const { updates } = createEditorWithUpdateTracking()
    editor!.commands.setContent('hello', false)
    expect(updates).toHaveLength(0)
  })

  it('does not emit update by default, matching core emitUpdate=false (string content)', () => {
    const { updates } = createEditorWithUpdateTracking()
    editor!.commands.setContent('hello')
    expect(updates).toHaveLength(0)
  })

  it('does not emit update when emitUpdate is false (Node content)', () => {
    const { editor: tracked, updates } = createEditorWithUpdateTracking()
    const doc = tracked.schema.topNodeType.create(null, [
      tracked.schema.nodes.paragraph.create(null, tracked.schema.text('from node')),
    ])
    tracked.commands.setContent(doc, false)
    expect(updates).toHaveLength(0)
  })

  it('still emits update for a real user edit (control)', () => {
    const { editor: tracked, updates } = createEditorWithUpdateTracking()
    tracked.commands.insertContentAt(0, 'x')
    expect(updates).toHaveLength(1)
  })
})
