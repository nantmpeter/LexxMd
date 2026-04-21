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
import { MermaidBlockExtension } from './extensions/mermaid-block'
import { Markdown } from 'tiptap-markdown'
import { createLowlight, common } from 'lowlight'
import { DualModeExtension } from './extensions/dual-mode'
import { FixContentParsing } from './extensions/fix-content-parsing'

const lowlight = createLowlight(common)

export function createEditor(element: HTMLElement, content: string = '') {
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
      MermaidBlockExtension.configure({
        lowlight,
        defaultLanguage: 'plaintext',
      }),
      DualModeExtension,
      Markdown.configure({
        html: true,
        breaks: true,
        linkify: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      FixContentParsing,
    ],
    content: content || `# Welcome to Lexx

Start typing in **Markdown** and see it render instantly.

- Press \`# \` at the start of a line for headings
- Use \`**bold**\` and \`*italic*\` for inline formatting

## Code Blocks

\`\`\`javascript
const hello = 'world'
console.log(hello)
\`\`\`

> This is a blockquote. Cursor entering a block shows the Markdown source syntax.

## Mermaid Diagrams

\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
\`\`\`

## Math Formulas

\`\`\`math
E = mc^2
\`\`\`

\`\`\`math
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
\`\`\`
`,
    editorProps: {
      attributes: {
        class: 'ProseMirror',
      },
    },
  })

  return editor
}
