import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TaskListInputRule } from './task-list-input'

function listItem(text: string) {
  return {
    type: 'listItem',
    content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
  }
}

function createTestEditor() {
  return new Editor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      TaskListInputRule,
    ],
  })
}

function findTextEndPos(editor: Editor, text: string): number {
  let pos = -1
  editor.state.doc.descendants((node, nodePos) => {
    if (node.isText && node.text === text) {
      pos = nodePos + text.length
      return false
    }
    return true
  })
  if (pos === -1) throw new Error(`text not found: ${text}`)
  return pos
}

/** Simulates typing `text` at the current cursor so input rules fire. */
function typeText(editor: Editor, text: string) {
  const { view } = editor
  const { from, to } = view.state.selection
  view.someProp('handleTextInput', f => f(view, from, to, text))
}

function firstTaskList(editor: Editor): PMNode | null {
  let found: PMNode | null = null
  editor.state.doc.descendants((node) => {
    if (found) return false
    if (node.type.name === 'taskList') {
      found = node
      return false
    }
    return true
  })
  return found
}

/** Asserts the cursor sits inside the task item at `index` of its task list. */
function expectCursorInTaskItem(editor: Editor, index: number) {
  const $from = editor.state.selection.$from
  let depth = $from.depth
  while (depth > 0 && $from.node(depth).type.name !== 'taskItem') depth -= 1
  expect(depth).toBeGreaterThan(0)
  expect($from.node(depth - 1).type.name).toBe('taskList')
  expect($from.index(depth - 1)).toBe(index)
}

describe('TaskListInputRule', () => {
  let editor: Editor | null = null

  afterEach(() => {
    editor?.destroy()
    editor = null
  })

  it('keeps all three items when converting the middle one of a bullet list', () => {
    editor = createTestEditor()
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [listItem('a'), listItem('[x]'), listItem('c')],
        },
      ],
    })

    editor.commands.setTextSelection(findTextEndPos(editor, '[x]'))
    typeText(editor, ' ')

    const taskList = firstTaskList(editor)
    expect(taskList).not.toBeNull()
    expect(taskList!.childCount).toBe(3)

    const first = taskList!.child(0)
    const second = taskList!.child(1)
    const third = taskList!.child(2)

    expect(first.type.name).toBe('taskItem')
    expect(first.attrs.checked).toBe(false)
    expect(first.textContent).toBe('a')

    expect(second.type.name).toBe('taskItem')
    expect(second.attrs.checked).toBe(true)
    expect(second.textContent).toBe('')

    expect(third.type.name).toBe('taskItem')
    expect(third.attrs.checked).toBe(false)
    expect(third.textContent).toBe('c')

    expectCursorInTaskItem(editor, 1)
  })

  it('converts a single-item bullet list', () => {
    editor = createTestEditor()
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [listItem('[ ]')],
        },
      ],
    })

    editor.commands.setTextSelection(findTextEndPos(editor, '[ ]'))
    typeText(editor, ' ')

    const taskList = firstTaskList(editor)
    expect(taskList).not.toBeNull()
    expect(taskList!.childCount).toBe(1)
    expect(taskList!.child(0).type.name).toBe('taskItem')
    expect(taskList!.child(0).attrs.checked).toBe(false)
    expect(taskList!.child(0).textContent).toBe('')

    expectCursorInTaskItem(editor, 0)
  })

  it('preserves a nested bullet list when converting the outer item', () => {
    editor = createTestEditor()
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: '[x]' }] },
                {
                  type: 'bulletList',
                  content: [listItem('b')],
                },
              ],
            },
            listItem('c'),
          ],
        },
      ],
    })

    editor.commands.setTextSelection(findTextEndPos(editor, '[x]'))
    typeText(editor, ' ')

    const taskList = firstTaskList(editor)
    expect(taskList).not.toBeNull()
    expect(taskList!.childCount).toBe(2)

    const outer = taskList!.child(0)
    expect(outer.type.name).toBe('taskItem')
    expect(outer.attrs.checked).toBe(true)
    // Own content preserved: paragraph plus the nested bullet list
    expect(outer.childCount).toBe(2)
    expect(outer.child(1).type.name).toBe('bulletList')
    expect(outer.child(1).child(0).textContent).toBe('b')

    const sibling = taskList!.child(1)
    expect(sibling.type.name).toBe('taskItem')
    expect(sibling.attrs.checked).toBe(false)
    expect(sibling.textContent).toBe('c')

    expectCursorInTaskItem(editor, 0)
  })
})
