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
import { ImagePaste } from './extensions/image-paste'
import { LexxImage, convertLocalImagesInHTML } from './extensions/lexx-image'
import { Markdown } from 'tiptap-markdown'
import { createLowlight, common } from 'lowlight'
import { DualModeExtension } from './extensions/dual-mode'
import { FixContentParsing } from './extensions/fix-content-parsing'
import { TrailingNode } from './extensions/trailing-node'

const lowlight = createLowlight(common)

export function createEditor(element: HTMLElement, content: string = '', getFilePath: () => string | null = () => null) {
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
      LexxImage.configure({
        inline: false,
        allowBase64: false,
      }),
      ImagePaste.configure({
        getFilePath,
      }),
      Markdown.configure({
        html: true,
        breaks: true,
        linkify: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      FixContentParsing,
      TrailingNode,
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'ProseMirror',
      },
    },
  })

  return editor
}
