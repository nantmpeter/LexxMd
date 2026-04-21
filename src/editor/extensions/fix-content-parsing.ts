/**
 * FixContentParsing — patches setContent to avoid the innerHTML serialization
 * round-trip that corrupts code-block content (blank lines, HTML entities).
 *
 * tiptap-markdown's setContent override returns element.innerHTML (an HTML
 * string) from MarkdownParser.parse(). The default setContent then re-parses
 * that string via elementFromString → ProseMirror DOMParser. This double
 * serialization loses content before the first \n\n and fails to decode
 * entities like --&gt; back to -->.
 *
 * This extension overrides setContent (at higher priority than Markdown) to
 * feed the DOM element directly to ProseMirror's DOMParser, producing a
 * ProseMirror Node that setContent accepts without re-parsing.
 */
import { Extension } from '@tiptap/core'
import { DOMParser as PMDOMParser } from '@tiptap/pm/model'

function domFromHTML(html: string): HTMLElement {
  const wrapped = `<body>${html}</body>`
  const doc = new DOMParser().parseFromString(wrapped, 'text/html')
  // Remove whitespace-only text nodes that browsers insert between elements
  const body = doc.body
  removeFormatWS(body)
  return body
}

function removeFormatWS(node: HTMLElement) {
  const children = node.childNodes
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i]
    if (
      child.nodeType === 3 &&
      child.nodeValue &&
      /^(\n\s\s|\n)$/.test(child.nodeValue)
    ) {
      node.removeChild(child)
    } else if (child.nodeType === 1) {
      removeFormatWS(child as HTMLElement)
    }
  }
}

export const FixContentParsing = Extension.create({
  name: 'fixContentParsing',

  /** Lower priority than tiptap-markdown (50) so our command override wins */
  priority: 40,

  addCommands() {
    return {
      setContent:
        (content: any, emitUpdate?: any, parseOptions?: any) =>
        (props: any) => {
          const { editor } = props

          // If it's already a ProseMirror Node/Fragment, delegate directly
          if (content && (content.type || content.content)) {
            return props.commands.insertContentAt(
              { from: 0, to: props.editor.state.doc.content.size },
              content,
              {
                parseOptions,
                errorOnInvalidContent: editor.options.enableContentCheck,
              },
            )
          }

          // If it's a string, parse through tiptap-markdown then use
          // ProseMirror's DOMParser directly (no innerHTML round-trip)
          if (typeof content === 'string') {
            const mdParser = editor.storage.markdown?.parser
            if (!mdParser) return false

            const html = mdParser.parse(content)
            const dom = domFromHTML(html)
            const parser = PMDOMParser.fromSchema(editor.schema)
            const doc = parser.parse(dom)

            return props.commands.insertContentAt(
              { from: 0, to: editor.state.doc.content.size },
              doc,
              {
                parseOptions,
                errorOnInvalidContent: editor.options.enableContentCheck,
              },
            )
          }

          return false
        },
    }
  },
})
