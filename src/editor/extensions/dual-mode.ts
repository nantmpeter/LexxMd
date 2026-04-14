/**
 * IMPLEMENTATION SCOPE:
 * - Implemented: DualModeExtension that toggles .edit-mode / .render-mode CSS classes
 *   on the editor DOM element based on focus state
 * - Not implemented: Per-block mode tracking, heading prefix decorations,
 *   inline mark marker visibility per-block
 * - Pending: Future iteration may add ProseMirror decorations for heading/block
 *   prefix visibility at per-block granularity
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const dualModePluginKey = new PluginKey('dualMode')

/**
 * DualModeExtension:
 * Tracks cursor position to determine which block is focused.
 * Toggles .edit-mode / .render-mode CSS class on the editor DOM element.
 *
 * The actual visibility of Markdown markers is handled by CSS rules in style.css:
 * - .edit-mode shows ** * markers on inline marks via ::before/::after
 * - .render-mode hides them
 *
 * For block-level prefixes (# for headings, > for blockquotes, - for lists),
 * the CSS ::before pseudo-elements on blockquote handle the > prefix.
 * Heading prefixes will be handled by decorations in a future iteration.
 */
export const DualModeExtension = Extension.create({
  name: 'dualMode',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: dualModePluginKey,

        view() {
          return {
            update(view) {
              const editorEl = view.dom
              const hasFocus = view.hasFocus()

              if (hasFocus) {
                editorEl.classList.add('edit-mode')
                editorEl.classList.remove('render-mode')
              } else {
                editorEl.classList.remove('edit-mode')
                editorEl.classList.add('render-mode')
              }
            },
          }
        },
      }),
    ]
  },
})
