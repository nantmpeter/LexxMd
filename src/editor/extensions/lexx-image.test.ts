import { describe, it, expect, afterEach, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Markdown } from 'tiptap-markdown'
import { LexxImage, convertLocalImagesInEditor } from './lexx-image'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mock://${path}`,
}))

function createTestEditor(content: string, withMarkdown = false) {
  return new Editor({
    extensions: [
      Document,
      Paragraph,
      Text,
      // allowBase64 so data: URLs parse into image nodes and the
      // "leave data: URLs untouched" behaviour can be asserted
      LexxImage.configure({ allowBase64: true }),
      ...(withMarkdown ? [Markdown.configure({ html: true })] : []),
    ],
    content,
  })
}

function findImageNodes(editor: Editor) {
  const images: any[] = []
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'image') images.push(node)
  })
  return images
}

describe('convertLocalImagesInEditor', () => {
  let editor: Editor | null = null

  afterEach(() => {
    editor?.destroy()
    editor = null
  })

  it('converts relative image paths against the file directory and keeps data-md-src', async () => {
    editor = createTestEditor('<p>before</p><img src="img/a.png" /><p>after</p>')

    let metaSeen = false
    editor.on('transaction', ({ transaction }) => {
      if (transaction.getMeta('convertLocalImages')) metaSeen = true
    })

    await convertLocalImagesInEditor(editor, '/docs/file.md')

    const images = findImageNodes(editor)
    expect(images).toHaveLength(1)
    // dir of '/docs/file.md' is '/docs'
    expect(images[0].attrs.src).toBe('mock:///docs/img/a.png')
    expect(images[0].attrs['data-md-src']).toBe('img/a.png')
    expect(metaSeen).toBe(true)
  })

  it('leaves http, https, asset and data URLs untouched', async () => {
    editor = createTestEditor(
      '<img src="http://example.com/a.png" />' +
      '<img src="https://example.com/b.png" />' +
      '<img src="asset://localhost/c.png" />' +
      '<img src="data:image/png;base64,xyz" />'
    )

    await convertLocalImagesInEditor(editor, '/docs/file.md')

    const images = findImageNodes(editor)
    expect(images).toHaveLength(4)
    expect(images.map((node) => node.attrs.src)).toEqual([
      'http://example.com/a.png',
      'https://example.com/b.png',
      'asset://localhost/c.png',
      'data:image/png;base64,xyz',
    ])
    expect(images.every((node) => node.attrs['data-md-src'] === null)).toBe(true)
  })

  it('does nothing when filePath is null', async () => {
    editor = createTestEditor('<img src="img/a.png" />')

    await convertLocalImagesInEditor(editor, null)

    const images = findImageNodes(editor)
    expect(images).toHaveLength(1)
    expect(images[0].attrs.src).toBe('img/a.png')
    expect(images[0].attrs['data-md-src']).toBe(null)
  })

  it('serializes back to the original relative markdown path', async () => {
    const markdownEditor = createTestEditor(
      '<p>before</p><img src="img/a.png" />',
      true
    )
    editor = markdownEditor

    await convertLocalImagesInEditor(markdownEditor, '/docs/file.md')

    const images = findImageNodes(markdownEditor)
    expect(images[0].attrs.src).toBe('mock:///docs/img/a.png')

    const md = markdownEditor.storage.markdown.getMarkdown()
    expect(md).toContain('![](img/a.png)')
    expect(md).not.toContain('mock://')
  })

  it('keeps converted attributes when the user undoes (addToHistory is false)', async () => {
    // StarterKit includes the History extension, so undo can act on the
    // conversion transaction unless it is excluded from history.
    const undoEditor = new Editor({
      extensions: [
        StarterKit,
        LexxImage.configure({ allowBase64: true }),
      ],
      content: '<img src="img/a.png" />',
    })
    editor = undoEditor

    await convertLocalImagesInEditor(undoEditor, '/docs/file.md')

    const before = findImageNodes(undoEditor)[0]
    expect(before.attrs.src).toBe('mock:///docs/img/a.png')
    expect(before.attrs['data-md-src']).toBe('img/a.png')

    undoEditor.commands.undo()

    const after = findImageNodes(undoEditor)[0]
    expect(after.attrs.src).toBe('mock:///docs/img/a.png')
    expect(after.attrs['data-md-src']).toBe('img/a.png')
  })
})
