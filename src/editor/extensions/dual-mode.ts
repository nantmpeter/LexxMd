import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const dualModePluginKey = new PluginKey('dualMode')

/**
 * Find the position of the top-level block ancestor containing the cursor.
 * Returns the absolute position before that block node.
 */
function getFocusedBlockPos(selection: { $from: { depth: number; node: (d: number) => any; before: (d: number) => number }; from: number }): number {
  const { $from } = selection
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.isBlock && d === 1) {
      return $from.before(d)
    }
  }
  return 0
}

/**
 * DualModeExtension — per-block edit/render mode switching (Typora-style).
 *
 * How it works:
 * 1. A ProseMirror Plugin tracks the cursor position and finds which
 *    top-level block node contains the cursor.
 * 2. It uses ProseMirror NodeDecorations to apply `.block-edit-mode`
 *    to the focused block and `.block-render-mode` to all other blocks.
 * 3. CSS rules in style.css scope Markdown marker visibility to
 *    `.block-edit-mode` only — so only the active block shows `**`, `#`, etc.
 */
export const DualModeExtension = Extension.create({
  name: 'dualMode',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: dualModePluginKey,

        props: {
          decorations(state) {
            const { doc, selection } = state
            const focusedPos = getFocusedBlockPos(selection)
            const decorations: Decoration[] = []

            // Iterate over top-level block children of the doc
            doc.forEach((node: any, offset: number, _index: number) => {
              const isFocused = offset === focusedPos
              const className = isFocused
                ? 'block-edit-mode'
                : 'block-render-mode'
              decorations.push(
                Decoration.node(offset, offset + node.nodeSize, {
                  class: className,
                })
              )
            })

            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },
})
