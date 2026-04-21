import html2canvas from 'html2canvas'
import { cloneEditorContent } from './utils'

/**
 * Export the editor content as a JPEG Blob.
 * Uses html2canvas to render the DOM to a canvas, then exports as JPEG.
 */
export async function exportJPEG(
  editorEl: HTMLElement,
  options?: { quality?: number; pixelRatio?: number }
): Promise<Blob> {
  const clone = cloneEditorContent(editorEl)

  // Append off-screen with proper styling
  clone.style.width = '800px'
  clone.style.padding = '40px 60px'
  clone.style.background = '#ffffff'
  clone.style.position = 'fixed'
  clone.style.left = '-9999px'
  clone.style.top = '0'
  clone.style.zIndex = '-1'
  document.body.appendChild(clone)

  try {
    const canvas = await html2canvas(clone, {
      scale: options?.pixelRatio ?? 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to generate JPEG'))
        },
        'image/jpeg',
        options?.quality ?? 0.92
      )
    })
  } finally {
    document.body.removeChild(clone)
  }
}
