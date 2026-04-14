/**
 * IMPLEMENTATION SCOPE:
 * - Implemented: Tiptap editor initialization with StarterKit, Typography, Link,
 *   Placeholder, TaskList, TaskItem, Table, CodeBlockLowlight, DualModeExtension
 * - Not implemented: File persistence, toolbar integration, status bar integration
 * - Pending: Integration with store for state management
 */

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Typography from '@tiptap/extension-typography'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { DualModeExtension } from './extensions/dual-mode'

const lowlight = createLowlight(common)

export function createEditor(element: HTMLElement) {
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Typography,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
      }),
      DualModeExtension,
    ],
    content: `# Welcome to MDEditor

Start typing in **Markdown** and see it render instantly.

- Press \`# \` at the start of a line for headings
- Use \`**bold**\` and \`*italic*\` for inline formatting

## Code Blocks

\`\`\`javascript
const hello = 'world'
console.log(hello)
\`\`\`

> This is a blockquote. Cursor entering a block shows the Markdown source syntax.
`,
    editorProps: {
      attributes: {
        class: 'ProseMirror',
      },
    },
  })

  return editor
}
