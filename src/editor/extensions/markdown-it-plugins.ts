/**
 * MarkdownItPlugins — registers extra markdown-it plugins for parsing
 * ==highlight==, ~subscript~, ^superscript^, ++underline++ syntax.
 * Also adds input rules so live typing triggers the marks.
 */
import { Extension, markInputRule, InputRule } from '@tiptap/core'
// @ts-ignore — no type declarations available
import markPlugin from 'markdown-it-mark'
// @ts-ignore — no type declarations available
import subPlugin from 'markdown-it-sub'
// @ts-ignore — no type declarations available
import supPlugin from 'markdown-it-sup'

// Custom markdown-it plugin for ++underline++
function underlinePlugin(md: any) {
  md.inline.ruler.after('emphasis', 'underline', (state: any, silent: boolean) => {
    const start = state.pos
    const max = state.posMax
    if (start >= max) return false
    if (state.src.charCodeAt(start) !== 0x2B /* + */) return false
    if (state.src.charCodeAt(start + 1) !== 0x2B /* + */) return false

    // Find closing ++
    let pos = start + 2
    let found = false
    while (pos < max - 1) {
      if (state.src.charCodeAt(pos) === 0x2B && state.src.charCodeAt(pos + 1) === 0x2B) {
        found = true
        break
      }
      pos++
    }
    if (!found) return false

    const content = state.src.slice(start + 2, pos)
    if (!content) return false

    if (!silent) {
      const tokenOpen = state.push('u_open', 'u', 1)
      tokenOpen.markup = '++'
      const tokenText = state.push('text', '', 0)
      tokenText.content = content
      const tokenClose = state.push('u_close', 'u', -1)
      tokenClose.markup = '++'
    }

    state.pos = pos + 2
    return true
  })
}

export const MarkdownItPlugins = Extension.create({
  name: 'markdownItPlugins',

  addStorage() {
    return {
      markdown: {
        parse: {
          setup(markdownit: any) {
            markdownit.use(markPlugin)
            markdownit.use(subPlugin)
            markdownit.use(supPlugin)
            markdownit.use(underlinePlugin)
          },
        },
      },
    }
  },

  addInputRules() {
    return [
      // ==highlight==
      markInputRule({
        find: /(?:^|\s)(==(?!\s+==)((?:[^=]+))==(?!\s+==))$/,
        type: this.editor.schema.marks.highlight,
      }),
      // ~subscript~ (single tilde, not ~~ which is strike)
      markInputRule({
        find: /(?:^|\s)(~(?!\s+~)((?:[^~]+))~(?!\s+~))$/,
        type: this.editor.schema.marks.subscript,
      }),
      // ^superscript^
      markInputRule({
        find: /(?:^|\s)(\^(?!\s+\^)((?:[^\^]+))\^(?!\s+\^))$/,
        type: this.editor.schema.marks.superscript,
      }),
      // ++underline++
      markInputRule({
        find: /(?:^|\s)(\+\+(?!\s+\+\+)((?:[^+]+))\+\+(?!\s+\+\+))$/,
        type: this.editor.schema.marks.underline,
      }),
    ]
  },
})
