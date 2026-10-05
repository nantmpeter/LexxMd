/**
 * PreserveBlocks tests — lossless round trips for YAML frontmatter and
 * block-level raw HTML (markdown-it html_block tokens).
 *
 * The test editor mirrors the real assembly in src/editor/index.ts as far
 * as parsing is concerned: MermaidBlockExtension is REQUIRED here because
 * its generic `pre` parseDOM rule must lose to the preserved-block rules,
 * and FixContentParsing is the actual setContent path in the app.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { createLowlight, common } from 'lowlight'
import { MermaidBlockExtension } from './mermaid-block'
import { FixContentParsing } from './fix-content-parsing'
import { Frontmatter, RawHtmlBlock } from './preserve-blocks'

const lowlight = createLowlight(common)

function createTestEditor() {
  return new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      MermaidBlockExtension.configure({ lowlight, defaultLanguage: 'plaintext' }),
      Markdown.configure({ html: true, breaks: true, linkify: true }),
      FixContentParsing,
      Frontmatter,
      RawHtmlBlock,
    ],
  })
}

function getMarkdown(editor: Editor): string {
  return editor.storage.markdown.getMarkdown()
}

function roundTrip(md: string): { editor: Editor; out: string } {
  const editor = createTestEditor()
  editor.commands.setContent(md, false)
  return { editor, out: getMarkdown(editor) }
}

function firstNode(editor: Editor) {
  return editor.state.doc.firstChild
}

describe('PreserveBlocks — frontmatter', () => {
  let editor: Editor | null = null

  afterEach(() => {
    editor?.destroy()
    editor = null
  })

  it('parses leading frontmatter verbatim (content with # and : lines) and round-trips', () => {
    const md = [
      '---',
      'title: My Doc',
      '# not a heading',
      'tags: [a, b]',
      '---',
      '',
      '# Real Heading',
      '',
      'Body text.',
    ].join('\n')

    const result = roundTrip(md)
    editor = result.editor

    const fm = firstNode(editor)
    expect(fm?.type.name).toBe('frontmatter')
    expect(fm?.textContent).toBe('title: My Doc\n# not a heading\ntags: [a, b]')
    expect(result.out).toBe(md)
  })

  it('keeps a leading --- without a closing delimiter as hr, not frontmatter', () => {
    const md = '---\n\ntext after'
    const result = roundTrip(md)
    editor = result.editor

    const nodes = editor.state.doc.content.content.map(n => n.type.name)
    expect(nodes).toContain('horizontalRule')
    expect(nodes).not.toContain('frontmatter')
    expect(result.out).toBe(md)
  })

  it('keeps a --- in the middle of the document as hr, not frontmatter', () => {
    const md = 'above\n\n---\n\nbelow'
    const result = roundTrip(md)
    editor = result.editor

    const nodes = editor.state.doc.content.content.map(n => n.type.name)
    expect(nodes).toContain('horizontalRule')
    expect(nodes).not.toContain('frontmatter')
    expect(result.out).toBe(md)
  })

  it('is idempotent: set → get → set → get is stable', () => {
    const md = '---\nlayout: post\nweight: -3\n---\n\n# Title'
    const first = roundTrip(md)
    editor = first.editor
    const second = roundTrip(first.out)
    second.editor.commands.setContent(first.out, false)
    expect(getMarkdown(second.editor)).toBe(second.out)
    expect(second.out).toBe(md)
  })

  it('frontmatter followed directly by content (no blank line) still round-trips', () => {
    // NOTE: block separation is normalized to one blank line by the
    // markdown serializer (same as every other block type in this app);
    // the frontmatter content itself is preserved verbatim.
    const md = '---\nfoo: bar\n---\n# Heading'
    const result = roundTrip(md)
    editor = result.editor
    expect(firstNode(editor)?.type.name).toBe('frontmatter')
    expect(firstNode(editor)?.textContent).toBe('foo: bar')
    expect(result.out).toBe('---\nfoo: bar\n---\n\n# Heading')
  })
})

describe('PreserveBlocks — raw html blocks', () => {
  let editor: Editor | null = null

  afterEach(() => {
    editor?.destroy()
    editor = null
  })

  it('round-trips an HTML comment verbatim', () => {
    const md = '<!-- build: do not remove -->\n\ntext'
    const result = roundTrip(md)
    editor = result.editor

    const node = firstNode(editor)
    expect(node?.type.name).toBe('rawHtml')
    expect(node?.textContent).toBe('<!-- build: do not remove -->\n')
    expect(result.out).toBe(md)
  })

  it('round-trips a <details> block verbatim (structure not executed)', () => {
    const md = '<details>\n<summary>More</summary>\n<p>hidden body</p>\n</details>\n\nafter'
    const result = roundTrip(md)
    editor = result.editor

    const node = firstNode(editor)
    expect(node?.type.name).toBe('rawHtml')
    expect(node?.textContent).toBe('<details>\n<summary>More</summary>\n<p>hidden body</p>\n</details>\n')
    expect(result.out).toBe(md)
  })

  it('round-trips a <div> block verbatim', () => {
    const md = '<div class="callout">\ninner line\n</div>\n\nafter'
    const result = roundTrip(md)
    editor = result.editor

    const node = firstNode(editor)
    expect(node?.type.name).toBe('rawHtml')
    expect(node?.textContent).toBe('<div class="callout">\ninner line\n</div>\n')
    expect(result.out).toBe(md)
  })

  it('keeps a <script> block as inert text (no execution, no script node)', () => {
    const md = '<script>alert("x")</script>\n\nsafe paragraph'
    const result = roundTrip(md)
    editor = result.editor

    const node = firstNode(editor)
    expect(node?.type.name).toBe('rawHtml')
    expect(node?.textContent).toBe('<script>alert("x")</script>\n')

    // Nothing in the doc is an unparsed HTML payload: content is plain text.
    const matchingTexts: string[] = []
    editor.state.doc.descendants(n => {
      if (n.type.name === 'text' && n.text?.includes('alert')) matchingTexts.push(n.text)
    })
    expect(matchingTexts.length).toBeGreaterThan(0)
    expect(result.out).toBe(md)
  })
})

describe('PreserveBlocks — mixed documents and regressions', () => {
  let editor: Editor | null = null

  afterEach(() => {
    editor?.destroy()
    editor = null
  })

  it('round-trips a mixed document (frontmatter + paragraphs + raw html + fence + hr)', () => {
    const md = [
      '---',
      'title: Mixed',
      '---',
      '',
      'Intro paragraph.',
      '',
      '<!-- note -->',
      '',
      '<div class="box">box</div>',
      '',
      '```js',
      'console.log("hi")',
      '```',
      '',
      '---',
      '',
      'Closing paragraph.',
    ].join('\n')

    const result = roundTrip(md)
    editor = result.editor
    expect(result.out).toBe(md)

    const names = editor.state.doc.content.content.map(n => n.type.name)
    expect(names[0]).toBe('frontmatter')
    expect(names).toContain('rawHtml')
    expect(names).toContain('codeBlock')
    expect(names).toContain('horizontalRule')
  })

  it('normal markdown without frontmatter/raw html serializes unchanged', () => {
    const md = '# Title\n\nSome **bold** text.\n\n- item one\n- item two'
    const result = roundTrip(md)
    editor = result.editor
    expect(result.out).toBe(md)
  })

  it('inline html (<b>, <br>) is not captured as rawHtml (unchanged behavior)', () => {
    const md = 'text with <b>bold</b> inline'
    const result = roundTrip(md)
    editor = result.editor

    const names = editor.state.doc.content.content.map(n => n.type.name)
    expect(names).not.toContain('rawHtml')
    // Inline markup keeps its existing interpretation as marks.
    const boldTexts: string[] = []
    editor.state.doc.descendants(n => {
      if (n.marks?.some((m: any) => m.type.name === 'bold')) boldTexts.push(n.textContent)
    })
    expect(boldTexts).toContain('bold')
  })

  it('preserved blocks separate from following paragraphs with exactly one blank line', () => {
    const md = '<!-- a -->\n\nparagraph'
    const result = roundTrip(md)
    editor = result.editor
    expect(result.out).toBe(md)
  })
})
