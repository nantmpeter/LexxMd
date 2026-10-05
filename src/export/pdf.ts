import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { cloneEditorContent } from './utils'

/**
 * Export the editor content as a PDF file.
 *
 * The document is NOT rendered into a single canvas: a whole-document canvas
 * quickly exceeds the WKWebView canvas allocation limit (a rejected or clipped
 * allocation produces an all-white PDF with no error). Instead the content is
 * sliced at BLOCK boundaries into page-sized chunks, each rendered by its own
 * html2canvas call, so no canvas ever approaches the limit.
 *
 * WKWebView / WebKit canvas limits and how to measure them in the shipping
 * webview (this dev environment cannot run WKWebView — END-TO-END CHECK IS
 * PENDING GUI SMOKE, docs/fix-plan.md §6):
 *
 *   // Run in the app's devtools; a width/height set that does not stick
 *   // (canvas.width !== s) means the allocation was rejected.
 *   const c = document.createElement('canvas')
 *   for (let s = 4096; s <= 32768; s *= 2) {
 *     c.width = s
 *     c.height = Math.floor(16777216 / s)   // hold ~16.7M total pixels
 *     console.log(s, c.width === s)
 *   }
 *
 * The chunk geometry below keeps every canvas at roughly 1600x2262 px
 * (scale 2, one A4 page) — orders of magnitude below any known limit even
 * if the measured ceiling differs per device.
 *
 * Pagination rule (docs/fix-plan.md §5):
 * - Normal blocks are NEVER cut: chunk boundaries are only placed between
 *   blocks, and each chunk is rendered as one image.
 * - A single block taller than one page (very long code block / table /
 *   large image) starts on a fresh page and is SLICED at page boundaries.
 *   Known simplification: the content inside such a block is cut mid-line
 *   at the page boundary (the tail of each slice is truncated rather than
 *   re-flowed) — accepted trade-off, see the loop below.
 */

const RENDER_WIDTH_PX = 800
const PAGE_WIDTH_MM = 210
const PAGE_HEIGHT_MM = 297
const SCALE = 2
/** How much of the 800px-wide render one A4 page holds vertically. */
export const PAGE_HEIGHT_PX = Math.floor((PAGE_HEIGHT_MM / PAGE_WIDTH_MM) * RENDER_WIDTH_PX)
/** Reserve headroom so inter-block margins inside a chunk cannot overflow the page. */
export const CHUNK_SLACK_PX = 16

/** mm covered by one rendered pixel (the whole 800px render spans 210mm). */
const MM_PER_PX = PAGE_WIDTH_MM / RENDER_WIDTH_PX

export interface MeasuredBlock {
  el: Element
  /** Document-space top of the block. */
  top: number
  height: number
}

export type PdfPageChunk =
  | { kind: 'blocks'; els: Element[]; top: number; height: number }
  | { kind: 'oversized'; el: Element; top: number; height: number }

/**
 * Greedy block packing. Normal blocks are grouped while they fit within
 * `usablePx`; a block taller than one page becomes its own 'oversized' chunk
 * (rendered as page-boundary slices by the caller).
 *
 * Invariants (covered by pdf.test.ts):
 * - every non-oversized block appears in exactly one chunk;
 * - a 'blocks' chunk never spans more than usablePx;
 * - an 'oversized' block is alone in its chunk (fresh page).
 */
export function planPdfPages(
  blocks: MeasuredBlock[],
  pageHeightPx: number = PAGE_HEIGHT_PX,
  slackPx: number = CHUNK_SLACK_PX
): PdfPageChunk[] {
  const usable = pageHeightPx - slackPx
  const chunks: PdfPageChunk[] = []
  let current: Extract<PdfPageChunk, { kind: 'blocks' }> | null = null

  const flush = () => {
    if (current) chunks.push(current)
    current = null
  }

  for (const b of blocks) {
    const bottom = b.top + b.height
    if (bottom - b.top > usable) {
      flush()
      chunks.push({ kind: 'oversized', el: b.el, top: b.top, height: b.height })
      continue
    }
    if (!current) {
      current = { kind: 'blocks', els: [b.el], top: b.top, height: b.height }
    } else if (bottom - current.top <= usable) {
      current.els.push(b.el)
      current.height = bottom - current.top
    } else {
      flush()
      current = { kind: 'blocks', els: [b.el], top: b.top, height: b.height }
    }
  }
  flush()
  return chunks
}

/**
 * Render a horizontal region of `el` (crop is element-relative in
 * html2canvas 1.4: x/y are added to the element's bounds) into a canvas of
 * at most scale*RENDER_WIDTH_PX x scale*height pixels.
 */
function renderRegion(el: HTMLElement, top: number, height: number): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    scale: SCALE,
    x: 0,
    y: top,
    width: RENDER_WIDTH_PX,
    height,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
  })
}

/**
 * Export the editor content as a PDF file.
 * Renders page-sized chunks and assembles them with jsPDF.
 */
export async function exportPDF(
  editorEl: HTMLElement,
  filename: string
): Promise<Blob> {
  const clone = cloneEditorContent(editorEl)

  clone.style.width = '800px'
  clone.style.padding = '40px 60px'
  clone.style.background = '#ffffff'
  clone.style.position = 'fixed'
  clone.style.left = '-9999px'
  clone.style.top = '0'
  clone.style.zIndex = '-1'
  document.body.appendChild(clone)

  try {
    const pm = clone.querySelector('.ProseMirror') || clone
    const cloneTop = clone.getBoundingClientRect().top

    const measured: MeasuredBlock[] = Array.from(pm.children).map(el => {
      const rect = el.getBoundingClientRect()
      return { el, top: rect.top - cloneTop, height: rect.height }
    })

    const usable = PAGE_HEIGHT_PX - CHUNK_SLACK_PX
    const canvases: HTMLCanvasElement[] = []

    for (const chunk of planPdfPages(measured)) {
      if (chunk.kind === 'blocks') {
        canvases.push(await renderRegion(clone, chunk.top, Math.ceil(chunk.height)))
      } else {
        // Oversized block: fresh page (the previous chunk ends here), then
        // slice at page boundaries. Simplification: content inside the block
        // is cut mid-line at each boundary — the slice tail is truncated,
        // not re-flowed. Normal blocks never go through this path.
        const slices = Math.max(1, Math.ceil(chunk.height / usable))
        for (let s = 0; s < slices; s++) {
          const top = chunk.top + s * usable
          const height = Math.min(usable, chunk.height - s * usable)
          canvases.push(await renderRegion(clone, top, Math.ceil(height)))
        }
      }
    }

    // Degenerate document (no block children): emit a single blank page
    // rather than a zero-page PDF.
    if (canvases.length === 0) {
      canvases.push(await renderRegion(clone, 0, Math.min(usable, PAGE_HEIGHT_PX)))
    }

    const pdf = new jsPDF('p', 'mm', 'a4')
    canvases.forEach((canvas, i) => {
      if (i > 0) pdf.addPage()
      // The last page may be shorter than a full page; the image simply ends.
      const heightMm = (canvas.height / SCALE) * MM_PER_PX
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.95),
        'JPEG',
        0,
        0,
        PAGE_WIDTH_MM,
        heightMm
      )
    })

    return pdf.output('blob')
  } finally {
    document.body.removeChild(clone)
  }
}
