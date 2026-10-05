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

  it('decodes percent-encoded srcs before resolving them as file paths', async () => {
    // markdown-it normalizes destinations on parse: a saved
    // `![photo](<img/my file.png>)` comes back with src "img/my%20file.png".
    editor = createTestEditor('<img src="img/my%20file.png" />')

    await convertLocalImagesInEditor(editor, '/docs/file.md')

    const images = findImageNodes(editor)
    // Resolved as the decoded path (space), not the percent-encoded one.
    expect(images[0].attrs.src).toBe('mock:///docs/img/my file.png')
    expect(images[0].attrs['data-md-src']).toBe('img/my file.png')
  })
})

describe('image markdown serialization (escaping)', () => {
  function makeEditor(content: any) {
    return new Editor({
      extensions: [
        Document,
        Paragraph,
        Text,
        LexxImage.configure({ allowBase64: true }),
        Markdown.configure({ html: true }),
      ],
      content,
    })
  }

  function serialize(attrs: Record<string, any>): { md: string } {
    const e = makeEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs }] }] })
    const md = e.storage.markdown.getMarkdown()
    e.destroy()
    return { md }
  }

  function roundTrip(attrs: Record<string, any>): { md: string; parsed: Record<string, any>; reserialized: string } {
    const { md } = serialize(attrs)
    const e = makeEditor(md)
    let parsedAttrs: Record<string, any> = {}
    e.state.doc.descendants((n) => {
      if (n.type.name === 'image' && Object.keys(parsedAttrs).length === 0) parsedAttrs = { ...n.attrs }
    })
    const reserialized = e.storage.markdown.getMarkdown()
    e.destroy()
    return { md, parsed: parsedAttrs, reserialized }
  }

  it('escapes brackets in alt so the image is not parsed as plain text', () => {
    // Without escaping, `![a]b](x.png)` is not an image at all — the label
    // closes early and markdown-it renders the whole thing as literal text.
    const { md } = serialize({ src: 'img/a.png', alt: 'a]b [c', title: null })
    expect(md).toBe('![a\\]b \\[c](img/a.png)')
    // Known limitation (out of scope): markdown-it's renderInlineAsText drops
    // text_special tokens when computing the alt attribute, so Lexx's own
    // re-parse loses the brackets. The on-disk markdown itself is valid
    // CommonMark (cmark-family renderers show alt "a]b [c").
  })

  it('keeps underscores between word characters unescaped (default serializer strategy)', () => {
    const { md } = serialize({ src: 'img/a.png', alt: 'snake_case_word', title: null })
    expect(md).toBe('![snake_case_word](img/a.png)')
  })

  it('escapes an underscore at the start of alt', () => {
    const { md } = serialize({ src: 'img/a.png', alt: '_leading', title: null })
    expect(md).toBe('![\\_leading](img/a.png)')
  })

  it('wraps a src containing spaces in pointy brackets', () => {
    const { md } = serialize({ src: 'img/my file.png', alt: 'photo', title: null })
    expect(md).toBe('![photo](<img/my file.png>)')
  })

  it('round-trips a src with parentheses through backslash escaping', () => {
    const { md, parsed, reserialized } = roundTrip({ src: 'img/shot(1).png', alt: 'shot', title: null })
    expect(md).toBe('![shot](img/shot\\(1\\).png)')
    expect(parsed.src).toBe('img/shot(1).png')
    expect(reserialized).toBe(md)
  })

  it('round-trips a quoted title', () => {
    const { md, parsed, reserialized } = roundTrip({ src: 'img/a.png', alt: 'pic', title: 'my "quoted" title' })
    expect(md).toBe('![pic](img/a.png "my \\"quoted\\" title")')
    expect(parsed.title).toBe('my "quoted" title')
    expect(reserialized).toBe(md)
  })

  it('round-trips a src with spaces: parse percent-encodes, decode recovers the path', () => {
    const { md, parsed, reserialized } = roundTrip({ src: 'img/my file.png', alt: 'photo', title: null })
    expect(md).toBe('![photo](<img/my file.png>)')
    // markdown-it normalizes the destination on parse...
    expect(parsed.src).toBe('img/my%20file.png')
    // ...decodeURIComponent recovers the path, so the next save is stable.
    expect(decodeURIComponent(parsed.src)).toBe('img/my file.png')
    expect(reserialized).toBe('![photo](img/my%20file.png)')
  })
})
