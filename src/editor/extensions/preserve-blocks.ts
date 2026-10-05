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
 *                              `<pre data-...>escapeHtml(content)</pre>`
 *   PM parseDOM (this file)  → `pre[data-frontmatter]` / `pre[data-raw-html]`
 *                              matched with priority 1000 so they win over
 *                              the generic `pre` rule of MermaidBlock
 *                              (codeBlock) — otherwise the content would be
 *                              swallowed into a code block.
 *
 * Serialization writes the text content back verbatim:
 *   frontmatter → `---\n<content>\n---` (trailing blank lines trimmed so the
 *                  round trip is idempotent; internal lines are untouched)
 *   rawHtml     → the original HTML text, including markdown-it's trailing
 *                  newline (serializer's closeBlock keeps exactly one blank
 *                  line between blocks, so output matches the input file).
 */
import { Node } from '@tiptap/core'

/** Opening/closing delimiter line: exactly `---` (optionally followed by whitespace). */
const DELIMITER = /^---\s*$/

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

function renderPreservedPre(attr: string, md: any, content: string): string {
  return `<pre ${attr}="1">${escapeHtml(md, content)}</pre>\n`
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
 */
function parsePreservedPre(tag: string) {
  return [
    {
      tag,
      preserveWhitespace: 'full' as const,
      priority: 1000,
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
