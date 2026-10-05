/**
 * Custom Image extension for Lexx.
 *
 * - Stores `data-md-src` as the markdown-friendly path (relative or absolute)
 * - Uses Tauri's `convertFileSrc()` to render local file paths in the webview
 * - Serializes `data-md-src` (not the asset URL) to markdown via tiptap-markdown
 *
 * `convertLocalImagesInEditor()` must be called after document content is set
 * (createEditor / setContent) so relative image paths become webview-loadable
 * asset URLs.
 */
import { Editor } from '@tiptap/core'
import Image from '@tiptap/extension-image'

/**
 * Convert a filesystem path to a webview-loadable asset URL via Tauri's
 * convertFileSrc(). Returns null when the Tauri API is unavailable or the
 * conversion throws (e.g. running in a plain browser during dev, where
 * `window.__TAURI_INTERNALS__` is undefined) — callers should skip
 * conversion in that case instead of letting the error escape into the
 * fire-and-forget call sites.
 */
async function convertToAssetUrl(filePath: string): Promise<string | null> {
  try {
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    return convertFileSrc(filePath)
  } catch {
    return null
  }
}

export const LexxImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      'data-md-src': { default: null },
    }
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', HTMLAttributes]
  },

  addStorage() {
    return {
      markdown: {
        serialize: (state: any, node: any) => {
          // Use data-md-src for markdown output (relative path), fallback to src
          const src = node.attrs['data-md-src'] || node.attrs.src || ''
          const alt = node.attrs.alt || ''
          const title = node.attrs.title
          state.write('![' + alt + '](' + src + (title ? ' "' + title + '"' : '') + ')')
        },
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
})

/**
 * After markdown content is loaded into the editor (createEditor /
 * setContent), convert local image paths in the document to
 * webview-loadable URLs via Tauri's convertFileSrc().
 *
 * Relative paths are resolved against the directory of `filePath`; absolute
 * paths are used as-is. All conversions are applied in a single transaction
 * tagged with the `convertLocalImages` meta so update listeners (App.vue)
 * can skip it and an opened file is not marked dirty.
 */
export async function convertLocalImagesInEditor(editor: Editor, filePath: string | null): Promise<void> {
  if (!filePath || editor.isDestroyed) return

  const dir = filePath.split(/[/\\]/).slice(0, -1).join('/')

  // Collect convertible images in a synchronous pass, then convert one by
  // one: a failed conversion (no Tauri API) just skips that image instead
  // of throwing inside the fire-and-forget call sites in App.vue.
  const pending: { pos: number; attrs: Record<string, any>; absPath: string }[] = []

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'image') return

    const src = node.attrs.src
    if (!src) return

    // Skip URLs that are already webview-accessible
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('asset:') || src.startsWith('data:')) return

    // Resolve relative path to absolute
    let absPath: string
    if (src.startsWith('/') || src.match(/^[A-Za-z]:\\/)) {
      absPath = src
    } else {
      absPath = dir + '/' + src
    }

    pending.push({ pos, attrs: { ...node.attrs }, absPath })
  })

  const tr = editor.state.tr
  let changed = false

  for (const item of pending) {
    const assetUrl = await convertToAssetUrl(item.absPath)
    if (assetUrl === null) continue

    // Store the original path for markdown round-trip, then convert the
    // rendering src to a webview URL.
    tr.setNodeMarkup(item.pos, undefined, {
      ...item.attrs,
      src: assetUrl,
      'data-md-src': item.attrs.src,
    })
    changed = true
  }

  if (changed) {
    // The conversion may span awaits; the slot could have been closed in
    // the meantime and dispatching on a destroyed editor would throw.
    if (editor.isDestroyed) return
    // Keep the conversion out of undo history (an undo must not revert
    // images to broken relative srcs) and tag it so update listeners
    // (App.vue) can skip it and an opened file is not marked dirty.
    tr.setMeta('convertLocalImages', true)
    tr.setMeta('addToHistory', false)
    editor.view.dispatch(tr)
  }
}
