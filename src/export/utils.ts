import { EXPORT_CSS } from './export-css'

/**
 * Clone the editor DOM element, forcing all blocks into render mode.
 */
export function cloneEditorContent(editorEl: HTMLElement): HTMLElement {
  const clone = editorEl.cloneNode(true) as HTMLElement

  // Force all blocks to render mode
  clone.querySelectorAll('.block-edit-mode').forEach(el => {
    el.classList.remove('block-edit-mode')
    el.classList.add('block-render-mode')
  })

  // Remove ProseMirror cursor
  clone.querySelectorAll('.ProseMirror-cursor').forEach(el => el.remove())

  // Remove selected cell markers
  clone.querySelectorAll('.selectedCell').forEach(el => {
    el.classList.remove('selectedCell')
  })

  // Ensure rich code blocks show render container (hide edit pre)
  clone.querySelectorAll('.rich-block-wrapper').forEach(wrapper => {
    const pre = wrapper.querySelector('pre')
    const render = wrapper.querySelector('.rich-render-container')
    if (pre && render) {
      ;(pre as HTMLElement).style.display = 'none'
      ;(render as HTMLElement).style.display = ''
    }
  })

  return clone
}

/**
 * Build a standalone HTML document from content HTML, with inlined CSS.
 */
export function buildExportHTML(html: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
${EXPORT_CSS}
</style>
</head>
<body>
<div class="ProseMirror">
${html}
</div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Convert ArrayBuffer to base64 string.
 *
 * Bytes are converted in 0x8000-byte chunks: appending one
 * String.fromCharCode per byte made the intermediate binary string
 * O(n) appends on multi-megabyte images/docx payloads, which dominated
 * export time and could hit engine string-length limits. 0x8000 is the
 * widely-used safe argument count for Function.prototype.apply.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const CHUNK_SIZE = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK_SIZE) as unknown as number[])
  }
  return btoa(binary)
}
