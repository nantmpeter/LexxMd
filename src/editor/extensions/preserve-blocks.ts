/**
 * PreserveBlocks — guarantees lossless storage of content that markdown
 * cannot represent as native ProseMirror nodes:
 *
 * 1. `frontmatter` — YAML front matter: a leading `---` ... `---` block at
 *    the very top of the file is kept verbatim as an editable plain-text
 *    block instead of being mangled into an hr + paragraphs.
 * 2. `rawHtml` — markdown-it `html_block` tokens (`<!-- comments -->`,
 *    `<details>`, `<div>`, `<script>`, ...): kept verbatim as plain text.
 *    They are never executed or rendered as markup (this also removes the
 *    raw-HTML injection surface). Inline `html_inline` is intentionally
 *    left untouched.
 *
 * How it plugs in (tiptap-markdown has no token→node dispatch — it renders
 * markdown-it output to an HTML string, then ProseMirror's DOMParser builds
 * the doc from that DOM, see tiptap-markdown/src/parse/MarkdownParser.js):
 *
 *   markdown-it block rule   → `frontmatter` token
 *   markdown-it renderer     → both token kinds rendered as
 *                              `<pre data-...>GUARD escapeHtml(content)</pre>`
 *   PM parseDOM (this file)  → `pre[data-frontmatter]` / `pre[data-raw-html]`
 *                              matched with priority 1000 so they win over
 *                              the generic `pre` rule of MermaidBlock
 *                              (codeBlock) — otherwise the content would be
 *                              swallowed into a code block. getContent()
 *                              removes the GUARD, see RENDER_GUARD below.
 *
 * Serialization writes the text content back verbatim:
 *   frontmatter → `---\n<content>\n---` (trailing blank lines trimmed so the
 *                  round trip is idempotent; internal lines are untouched)
 *   rawHtml     → the original HTML text, including markdown-it's trailing
 *                  newline (serializer's closeBlock keeps exactly one blank
 *                  line between blocks, so output matches the input file).
 */
import { Node } from '@tiptap/core'
import { Fragment } from '@tiptap/pm/model'

/** Opening/closing delimiter line: exactly `---` (optionally followed by whitespace). */
const DELIMITER = /^---\s*$/

/**
 * Guard character emitted right after the `<pre ...>` start tag of preserved
 * blocks (see renderPreservedPre) and removed again by the parseDOM rule's
 * getContent (see parsePreservedPre), so the ProseMirror text always equals
 * the original markdown content.
 *
 * Why a guard at all: HTML's PRE tokenization rule drops a single LF
 * immediately after a `<pre>` start tag, which eats a real leading blank
 * line in content like `---\n\ntitle: x\n---`. WebKit conforms (the shipped
 * app lost the line); happy-dom does not (which is why tests stayed green).
 *
 * Why ZWSP and not a bare `\n` guard: a bare LF is stripped by the FIRST
 * spec-conforming parse, and every parse path in this app parses the
 * rendered HTML at least once, usually twice — tiptap-markdown's
 * MarkdownParser.parse returns element.innerHTML (parse #1), which
 * FixContentParsing re-parses via domFromHTML (parse #2), and the
 * initial-content path feeds the same innerHTML through tiptap core's
 * createDocument (parse #2). A second spec parse would then consume the
 * content's own leading LF, and non-conforming parsers would instead keep
 * the guard as content and corrupt round trips. ZWSP is not LF: no parser
 * strips it, on any path, after any number of parses — the parse rule
 * removes exactly the one we emitted. Trade-off: frontmatter content that
 * genuinely starts with U+200B loses that character (the previous behavior
 * was lossy for leading whitespace in that spot too).
 */
const RENDER_GUARD = '\u200B'

/** Remove exactly one guard character from the start of parsed pre text. */
function stripRenderGuard(text: string): string {
  return text.startsWith(RENDER_GUARD) ? text.slice(RENDER_GUARD.length) : text
}

/**
 * markdown-it parse.setup runs on EVERY MarkdownParser.parse() call with the
 * same markdown-it instance, so block-ruler registration must be guarded
 * (renderer rules are plain assignments and idempotent by themselves).
 */
const configured = new WeakSet<object>()

function escapeHtml(md: any, text: string): string {
  return md.utils.escapeHtml(text)
}

/**
 * markdown-it block rule for front matter.
 * Only the document head qualifies: no tokens may exist yet and every line
 * before the opening delimiter must be blank. A `---` anywhere else in the
 * document is left to the regular hr rule (the rule is registered before
 * `hr`, but returns false unless all head conditions hold — including the
 * "no closing delimiter" case, which stays an hr).
 * The closing line must be a `---` on its own line; everything between the
 * two delimiter lines is captured verbatim via state.getLines (tabs,
 * indentation, `#`/`---` lines included — parsing is positional, not
 * content-based).
 */
function frontmatterRule(state: any, startLine: number, endLine: number, silent: boolean): boolean {
  if (silent) return false
  if (state.tokens.length > 0) return false

  // Every line before the current one must be blank (leading blank lines ok).
  for (let line = 0; line < startLine; line++) {
    if (!/^\s*$/.test(state.src.slice(state.bMarks[line], state.eMarks[line]))) {
      return false
    }
  }

  // Opening `---` must sit at column 0 (no indentation).
  if (state.tShift[startLine] !== 0) return false
  const opening = state.src.slice(state.bMarks[startLine], state.eMarks[startLine])
  if (!DELIMITER.test(opening)) return false

  for (let line = startLine + 1; line < endLine; line++) {
    const text = state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line])
    if (DELIMITER.test(text)) {
      const token = state.push('frontmatter', '', 0)
      token.map = [startLine, line + 1]
      // Lines strictly between the delimiters, verbatim (keepLastLF=false
      // trims only the final line's newline, so content round-trips).
      token.content = state.getLines(startLine + 1, line, state.blkIndent, false)
      state.line = line + 1
      return true
    }
  }

  // No closing delimiter: not front matter — let the hr rule handle it.
  return false
}

/**
 * Render a preserved block as inert text inside a `<pre>`. Exported for the
 * format-lock test: the guard must sit immediately after the start tag.
 *
 * The rawHtml branch gets the same guard for uniformity. html_block content
 * always begins with the tag itself (`<!--`, `<div>`, ...), so it was never
 * bitten by the leading-LF strip — the guard there is purely defensive.
 */
export function renderPreservedPre(attr: string, md: any, content: string): string {
  return `<pre ${attr}="1">${RENDER_GUARD}${escapeHtml(md, content)}</pre>\n`
}

function setupMarkdownIt(md: any): void {
  if (configured.has(md)) return
  configured.add(md)

  // frontmatter token (only fires at the document head, see rule above)
  md.block.ruler.before('hr', 'frontmatter', frontmatterRule, { alt: [] })
  md.renderer.rules.frontmatter = (tokens: any[], idx: number) =>
    renderPreservedPre('data-frontmatter', md, tokens[idx].content)

  // html_block tokens (<!-- -->, <div>, <details>, <script>, ...) — render
  // the raw source as ESCAPED TEXT so it is preserved verbatim and never
  // interpreted as markup. html_inline keeps the default renderer (unchanged
  // behavior for <br>, <b>, ... inside paragraphs).
  md.renderer.rules.html_block = (tokens: any[], idx: number) =>
    renderPreservedPre('data-raw-html', md, tokens[idx].content)
}

function sharedParseSetup() {
  return {
    parse: {
      // Called with the markdown-it instance on every parse; guarded above.
      setup(markdownit: any) {
        setupMarkdownIt(markdownit)
      },
    },
  }
}

/**
 * Parse rule for both preserved nodes. `priority: 1000` is REQUIRED:
 * MermaidBlock (codeBlock) registers a generic `pre` rule at default
 * priority 50 that would otherwise swallow our pre blocks.
 *
 * getContent strips the render guard (see RENDER_GUARD) and replaces child
 * parsing with the exact text. Doing the strip at rule level (instead of in
 * FixContentParsing's domFromHTML) covers every path that turns rendered
 * HTML into a doc: setContent, the initial-content double parse, and the
 * markdown-paste path — with or without a guard present (clipboard HTML
 * rendered by renderHTML never carries one, and the strip is a no-op then).
 */
function parsePreservedPre(tag: string) {
  return [
    {
      tag,
      preserveWhitespace: 'full' as const,
      priority: 1000,
      getContent: (dom: globalThis.Node, schema: any): Fragment => {
        const text = stripRenderGuard(dom.textContent ?? '')
        return text ? Fragment.from(schema.text(text)) : Fragment.empty
      },
    },
  ]
}

/** pre > plain text; `code: true` gives whitespace 'pre' semantics in the view. */
function renderPreservedNode(attr: string, label: string): any {
  return [
    'pre',
    { [attr]: '1', 'data-label': label, class: 'preserved-block' },
    0,
  ]
}

export const Frontmatter = Node.create({
  name: 'frontmatter',

  // group 'block' is REQUIRED: doc content is 'block+' (StarterKit doc);
  // without it ProseMirror's content match rejects the node and transparently
  // hoists its children into paragraphs (observed via findWrapping → null).
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,

  parseHTML() {
    return parsePreservedPre('pre[data-frontmatter]')
  },

  renderHTML() {
    return renderPreservedNode('data-frontmatter', 'frontmatter')
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          // Trim trailing blank lines only — keeps the round trip idempotent
          // (content itself, including `---`/`#` lines, is written verbatim).
          const content = node.textContent.replace(/\n+$/, '')
          state.write(`---\n${content}\n---`)
          state.closeBlock(node)
        },
        ...sharedParseSetup(),
      },
    }
  },
})

export const RawHtmlBlock = Node.create({
  name: 'rawHtml',

  // See Frontmatter: group 'block' is required to fit doc 'block+'.
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,

  parseHTML() {
    return parsePreservedPre('pre[data-raw-html]')
  },

  renderHTML() {
    return renderPreservedNode('data-raw-html', 'html')
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          // Verbatim write-back of the original HTML text (markdown-it's
          // html_block content carries a trailing newline; the serializer's
          // block separator then yields exactly one blank line after it).
          state.write(node.textContent)
          state.closeBlock(node)
        },
        ...sharedParseSetup(),
      },
    }
  },
})
