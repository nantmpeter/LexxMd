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
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Underline from '@tiptap/extension-underline'
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
import { TaskListInputRule } from './extensions/task-list-input'
import { MarkdownItPlugins } from './extensions/markdown-it-plugins'
import { BubbleToolbar } from './extensions/bubble-toolbar'

const lowlight = createLowlight(common)

export function createEditor(element: HTMLElement, content: string = '', getFilePath: () => string | null = () => null) {
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Typography,
      Highlight.configure({
        multicolor: false,
      }).extend({
        addStorage() {
          return {
            markdown: {
              serialize: { open: '==', close: '==', expelEnclosingWhitespace: true },
              parse: { /* handled by markdown-it mark plugin */ },
            },
          }
        },
      }),
      Subscript.extend({
        addStorage() {
          return {
            markdown: {
              serialize: { open: '~', close: '~', expelEnclosingWhitespace: true },
              parse: { /* handled by markdown-it sub plugin */ },
            },
          }
        },
      }),
      Superscript.extend({
        addStorage() {
          return {
            markdown: {
              serialize: { open: '^', close: '^', expelEnclosingWhitespace: true },
              parse: { /* handled by markdown-it sup plugin */ },
            },
          }
        },
      }),
      Underline.extend({
        addStorage() {
          return {
            markdown: {
              serialize: { open: '++', close: '++', expelEnclosingWhitespace: true },
              parse: { /* handled by custom rule */ },
            },
          }
        },
      }),
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
      TaskListInputRule,
      MarkdownItPlugins,
      BubbleToolbar,
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
