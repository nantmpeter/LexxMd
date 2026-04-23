/**
 * TrailingNode — ensures the document always ends with a paragraph node
 * so the cursor can be placed after the last block (e.g. code blocks,
 * mermaid diagrams, math formulas).
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const TrailingNode = Extension.create({
  name: 'trailingNode',

  addProseMirrorPlugins() {
    const plugin = new Plugin({
      key: new PluginKey('trailingNode'),
      appendTransaction(transactions, _, state) {
        // Only check if the document was actually modified
        const docChanged = transactions.some(tr => tr.docChanged)
        if (!docChanged) return null

        const { doc, schema } = state
        const lastNode = doc.lastChild

        if (lastNode && lastNode.type.name !== 'paragraph') {
          const paragraph = schema.nodes.paragraph.create()
          const tr = state.tr.insert(doc.content.size, paragraph)
          return tr
        }
        return null
      },
    })
    return [plugin]
  },
})
