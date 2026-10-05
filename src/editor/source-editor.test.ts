import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { undo } from '@codemirror/commands'
import { createSourceEditor } from './source-editor'

describe('createSourceEditor', () => {
  let parent: HTMLDivElement
  let editor: ReturnType<typeof createSourceEditor>

  beforeEach(() => {
    parent = document.createElement('div')
    document.body.appendChild(parent)
    editor = createSourceEditor(parent, () => {})
  })

  afterEach(() => {
    editor.destroy()
    parent.remove()
  })

  it('creates an editor view in the parent element', () => {
    expect(parent.querySelector('.cm-editor')).toBeTruthy()
  })

  it('getContent returns empty string initially', () => {
    expect(editor.getContent()).toBe('')
  })

  it('setContent and getContent roundtrip', () => {
    editor.setContent('# Hello World\n\nSome **bold** text.')
    expect(editor.getContent()).toBe('# Hello World\n\nSome **bold** text.')
  })

  it('setContent replaces existing content', () => {
    editor.setContent('first')
    editor.setContent('second')
    expect(editor.getContent()).toBe('second')
  })

  it('getCursorLine returns 1 initially', () => {
    expect(editor.getCursorLine()).toBe(1)
  })

  it('getCursorLine returns correct line after setCursorLine', () => {
    editor.setContent('line1\nline2\nline3\nline4')
    editor.setCursorLine(3)
    expect(editor.getCursorLine()).toBe(3)
  })

  it('setCursorLine clamps to valid range', () => {
    editor.setContent('line1\nline2')
    editor.setCursorLine(0)
    expect(editor.getCursorLine()).toBe(1)

    editor.setCursorLine(100)
    expect(editor.getCursorLine()).toBe(2)
  })

  it('fires onChange when content changes via a real edit', () => {
    let callCount = 0
    const onChangeEditor = createSourceEditor(parent, () => { callCount++ })
    onChangeEditor.view.dispatch({
      changes: { from: 0, to: 0, insert: 'x' },
    })
    expect(callCount).toBe(1)
    onChangeEditor.destroy()
  })

  it('undo after setContent keeps the loaded content', () => {
    editor.setContent('# Hello World')
    undo(editor.view)
    expect(editor.getContent()).toBe('# Hello World')
  })

  it('a later setContent resets the undo stack so earlier content cannot resurface', () => {
    editor.setContent('A')
    // Simulate a real user edit
    editor.view.dispatch({ changes: { from: 0, to: 1, insert: 'A2' } })
    // Load a different file (fresh session)
    editor.setContent('B')
    undo(editor.view)
    expect(editor.getContent()).toBe('B')
  })

  it('setContent does not fire onChange', () => {
    let callCount = 0
    const onChangeEditor = createSourceEditor(parent, () => { callCount++ })
    onChangeEditor.setContent('trigger change')
    expect(callCount).toBe(0)
    onChangeEditor.destroy()
  })

  it('destroy removes the editor from DOM', () => {
    editor.destroy()
    expect(parent.querySelector('.cm-editor')).toBeFalsy()
  })
})
