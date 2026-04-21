/**
 * Custom Image extension for Lexx.
 *
 * - Stores `data-md-src` as the markdown-friendly path (relative or absolute)
 * - Uses Tauri's `convertFileSrc()` to render local file paths in the webview
 * - Serializes `data-md-src` (not the asset URL) to markdown via tiptap-markdown
 */
import Image from '@tiptap/extension-image'

async function convertFileSrc(filePath: string): Promise<string> {
  try {
    const { convertFileSrc: tauriConvert } = await import('@tauri-apps/api/core')
    return tauriConvert(filePath)
  } catch {
    return filePath
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
 * When markdown is loaded (e.g. opening a file), convert local image paths
 * to webview-loadable URLs. Called during setContent.
 */
export async function convertLocalImagesInHTML(html: string, filePath: string | null): Promise<string> {
  // Match <img src="assets/..."> or <img src="/absolute/...">
  const container = document.createElement('div')
  container.innerHTML = html

  const images = container.querySelectorAll('img')
  for (const img of images) {
    const src = img.getAttribute('src')
    if (!src) continue

    // Skip URLs that are already webview-accessible
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('asset:') || src.startsWith('data:')) continue

    // Resolve relative path to absolute
    let absPath: string
    if (src.startsWith('/') || src.match(/^[A-Za-z]:\\/)) {
      absPath = src
    } else if (filePath) {
      const dir = filePath.split(/[/\\]/).slice(0, -1).join('/')
      absPath = dir + '/' + src
    } else {
      continue
    }

    // Store the original path for markdown round-trip
    img.setAttribute('data-md-src', src)

    // Convert to webview URL
    const assetUrl = await convertFileSrc(absPath)
    img.setAttribute('src', assetUrl)
  }

  return container.innerHTML
}
