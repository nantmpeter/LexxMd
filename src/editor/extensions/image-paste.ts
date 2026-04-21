/**
 * ImagePaste — intercept clipboard paste with image data,
 * save the image to disk, and insert an Image node.
 *
 * Images are saved alongside the .md file in an assets/ folder.
 * For rendering in the webview, we use Tauri's convertFileSrc()
 * to create a loadable URL. For markdown, we store the relative path.
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { fileWriteBinary, getAppDataDir } from '../../tauri/commands'

export interface ImagePasteOptions {
  /** Returns the current file's full path (or null for untitled) */
  getFilePath: () => string | null
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function convertFileSrc(filePath: string): Promise<string> {
  try {
    const { convertFileSrc: tauriConvert } = await import('@tauri-apps/api/core')
    return tauriConvert(filePath)
  } catch {
    // Fallback: return as-is (works in browser dev mode)
    return filePath
  }
}

export const ImagePaste = Extension.create<ImagePasteOptions>({
  name: 'imagePaste',

  addOptions() {
    return {
      getFilePath: () => null,
    }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    const getFilePath = this.options.getFilePath

    return [
      new Plugin({
        key: new PluginKey('imagePaste'),
        props: {
          handlePaste(view, event) {
            const items = event.clipboardData?.items
            if (!items) return false

            let imageItem: DataTransferItem | null = null
            for (let i = 0; i < items.length; i++) {
              if (items[i].type.startsWith('image/')) {
                imageItem = items[i]
                break
              }
            }
            if (!imageItem) return false

            event.preventDefault()

            const blob = imageItem.getAsFile()
            if (!blob) return true

            const ext = imageItem.type.split('/')[1] || 'png'
            const ts = Date.now()
            const filename = `image-${ts}.${ext}`

            ;(async () => {
              try {
                const base64 = await blobToBase64(blob)
                const filePath = getFilePath()

                let savePath: string
                let mdPath: string

                if (filePath) {
                  const dir = filePath.split(/[/\\]/).slice(0, -1).join('/')
                  const assetsDir = dir + '/assets'
                  savePath = assetsDir + '/' + filename
                  mdPath = 'assets/' + filename
                } else {
                  const appData = await getAppDataDir()
                  savePath = appData + '/temp/' + filename
                  mdPath = savePath
                }

                await fileWriteBinary(savePath, base64)

                // Convert absolute path to webview-loadable URL
                const assetUrl = await convertFileSrc(savePath)

                const pos = view.state.selection.from
                const node = view.state.schema.nodes.image
                if (node) {
                  // src: asset URL for rendering, data-md-src: relative path for markdown
                  const imageNode = node.create({
                    src: assetUrl,
                    'data-md-src': mdPath,
                  })
                  const tr = view.state.tr.insert(pos, imageNode)
                  view.dispatch(tr)
                }
              } catch (e) {
                console.error('Image paste failed:', e)
              }
            })()

            return true
          },
        },
      }),
    ]
  },
})
