import {
  Document as DocxDocument, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, ExternalHyperlink,
  ImageRun,
} from 'docx'
import { cloneEditorContent } from './utils'

const HLJS_COLORS: Record<string, string> = {
  'hljs-keyword': 'D73A49', 'hljs-string': '032F62', 'hljs-number': '005CC5',
  'hljs-comment': '6A737D', 'hljs-title': '6F42C1', 'hljs-type': 'E36209',
  'hljs-built_in': '005CC5', 'hljs-variable': '24292E', 'hljs-attr': '032F62',
  'hljs-literal': '005CC5', 'hljs-section': '6F42C1', 'hljs-selector-tag': 'D73A49',
  'hljs-selector-attr': '032F62', 'hljs-quote': '6A737D', 'hljs-meta': '6A737D',
  'hljs-tag': 'D73A49', 'hljs-name': '6F42C1', 'hljs-attribute': '032F62',
  'hljs-symbol': '005CC5', 'hljs-params': '24292E',
}

/**
 * Capture an SVG element as PNG Uint8Array.
 * Converts foreignObject → text elements to avoid canvas tainting,
 * then serializes SVG → data URL → Image → Canvas → PNG.
 */
async function captureSVG(svgEl: SVGSVGElement): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  try {
    const clone = svgEl.cloneNode(true) as SVGSVGElement
    const svgNS = 'http://www.w3.org/2000/svg'

    // Set explicit dimensions from viewBox
    const vb = clone.getAttribute('viewBox')
    if (vb) {
      const parts = vb.split(/[\s,]+/)
      clone.setAttribute('width', parts[2])
      clone.setAttribute('height', parts[3])
    }

    // Convert foreignObject → SVG text to avoid canvas tainting
    clone.querySelectorAll('foreignObject').forEach(fo => {
      const text = fo.textContent?.trim()
      if (!text) { fo.remove(); return }

      const x = parseFloat(fo.getAttribute('x') || '0')
      const y = parseFloat(fo.getAttribute('y') || '0')
      const w = parseFloat(fo.getAttribute('width') || '100')
      const h = parseFloat(fo.getAttribute('height') || '30')

      const textEl = document.createElementNS(svgNS, 'text')
      textEl.setAttribute('x', String(x + w / 2))
      textEl.setAttribute('y', String(y + h / 2 + 4))
      textEl.setAttribute('text-anchor', 'middle')
      textEl.setAttribute('font-size', '12')
      textEl.setAttribute('font-family', 'sans-serif')
      textEl.setAttribute('fill', '#333')
      textEl.textContent = text
      fo.replaceWith(textEl)
    })

    // Ensure xmlns
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', svgNS)
    }

    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(clone)
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)))

    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG load failed'))
      img.src = dataUrl
    })

    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth * scale
    canvas.height = img.naturalHeight * scale
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png')
    })

    return {
      data: new Uint8Array(await blob.arrayBuffer()),
      width: canvas.width,
      height: canvas.height,
    }
  } catch {
    return null
  }
}

/**
 * Capture a DOM element as PNG using html2canvas.
 */
async function captureElement(el: HTMLElement): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(el, {
      scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true,
    })
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png')
    })
    return {
      data: new Uint8Array(await blob.arrayBuffer()),
      width: canvas.width,
      height: canvas.height,
    }
  } catch {
    return null
  }
}

/**
 * Export editor content as DOCX.
 * Captures mermaid SVGs and KaTeX as embedded images from the live DOM.
 */
export async function exportDOCX(editorEl: HTMLElement): Promise<Blob> {
  const clone = cloneEditorContent(editorEl)

  // Attach clone to DOM for rendering
  clone.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;background:#fff;'
  document.body.appendChild(clone)

  try {
    // Pre-capture all rich blocks as images
    const richImages = new Map<Element, { data: Uint8Array; width: number; height: number }>()
    const richWrappers = clone.querySelectorAll('.rich-block-wrapper')

    for (const wrapper of richWrappers) {
      const renderContainer = wrapper.querySelector('.rich-render-container') as HTMLElement | null
      if (!renderContainer) continue

      // Try SVG capture first (works for mermaid)
      const svg = renderContainer.querySelector('svg')
      if (svg) {
        const captured = await captureSVG(svg as SVGSVGElement)
        if (captured) {
          richImages.set(renderContainer, captured)
          continue
        }
      }

      // Fallback to html2canvas (for KaTeX and other rendered content)
      const captured = await captureElement(renderContainer)
      if (captured) {
        richImages.set(renderContainer, captured)
      }
    }

    // Parse the clone
    const pm = clone.querySelector('.ProseMirror') || clone
    const children: (Paragraph | Table)[] = []
    let node: Element | null = pm.firstElementChild

    while (node) {
      const tag = node.tagName.toLowerCase()

      if (tag.match(/^h[1-6]$/)) {
        children.push(convertHeading(node))
      } else if (tag === 'p') {
        children.push(convertParagraph(node))
      } else if (tag === 'blockquote') {
        children.push(...convertBlockquote(node))
      } else if (tag === 'ul' || tag === 'ol') {
        children.push(...convertList(node, tag === 'ol'))
      } else if (tag === 'pre' && !node.closest('.rich-block-wrapper')) {
        children.push(...convertCodeBlock(node))
      } else if (tag === 'div' && (node.getAttribute('data-type')?.startsWith('rich-') || node.classList.contains('rich-block-wrapper'))) {
        children.push(...convertRichBlock(node, richImages))
      } else if (tag === 'table') {
        children.push(convertTable(node))
      } else if (tag === 'hr') {
        children.push(new Paragraph({
          children: [new TextRun('')],
          spacing: { before: 160, after: 160 },
          border: { bottom: { style: 'single' as any, size: 4, color: 'd1d5da' } },
        }))
      } else {
        // Flatten wrapper divs
        if (node.children.length > 0) {
          const childTags = Array.from(node.children).map(c => c.tagName.toLowerCase())
          const blockTags = new Set(['h1','h2','h3','h4','h5','h6','p','ul','ol','pre','blockquote','table','hr','div'])
          if (childTags.some(t => blockTags.has(t))) {
            let child: Element | null = node.firstElementChild
            while (child) {
              const next: Element | null = child.nextElementSibling
              node.removeChild(child)
              node.parentElement!.insertBefore(child, node)
              child = next
            }
            node = node.previousElementSibling
            continue
          }
        }
        children.push(convertParagraph(node))
      }
      node = node.nextElementSibling
    }

    const docxDoc = new DocxDocument({
      sections: [{
        properties: {
          page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } },
        },
        children,
      }],
    })

    return Packer.toBlob(docxDoc)
  } finally {
    document.body.removeChild(clone)
  }
}

// ── Converters ──────────────────────────────────────────────

function convertHeading(el: Element): Paragraph {
  const level = parseInt(el.tagName[1])
  const map: Record<number, any> = {
    1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4, 5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6,
  }
  return new Paragraph({
    heading: map[level] || HeadingLevel.HEADING_1,
    children: extractRuns(el),
    spacing: { before: level <= 2 ? 280 : 200, after: 80 },
  })
}

function convertParagraph(el: Element): Paragraph {
  return new Paragraph({
    children: extractRuns(el),
    spacing: { after: 80, line: 276 },
  })
}

function convertBlockquote(el: Element): Paragraph[] {
  const paragraphs: Paragraph[] = []
  const ps = el.querySelectorAll(':scope > p')
  const sources = ps.length > 0 ? Array.from(ps) : [el]
  sources.forEach(p => {
    paragraphs.push(new Paragraph({
      children: extractRuns(p),
      indent: { left: 240 },
      border: { left: { style: 'single' as any, size: 4, color: 'd1d5da', space: 6 } },
      spacing: { after: 40, line: 276 },
    }))
  })
  return paragraphs
}

function convertList(el: Element, ordered: boolean, depth: number = 0): Paragraph[] {
  const paragraphs: Paragraph[] = []
  let counter = 1
  for (const li of el.children) {
    if (li.tagName.toLowerCase() !== 'li') continue
    const contentEl = li.querySelector(':scope > p') || li
    const runs = extractRuns(contentEl)
    const checkbox = li.querySelector('input[type="checkbox"]')
    const prefix = checkbox
      ? ((checkbox as HTMLInputElement).checked ? '\u2611 ' : '\u2610 ')
      : (ordered ? `${counter}. ` : '\u2022 ')
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: prefix }), ...runs],
      indent: { left: 240 + depth * 180 },
      spacing: { after: 20, line: 276 },
    }))
    const nested = li.querySelector(':scope > ul, :scope > ol')
    if (nested) paragraphs.push(...convertList(nested, nested.tagName.toLowerCase() === 'ol', depth + 1))
    counter++
  }
  return paragraphs
}

function convertCodeBlock(el: Element): Paragraph[] {
  const code = el.querySelector('code')
  const lang = el.getAttribute('data-language') || ''
  const paragraphs: Paragraph[] = []

  // Language label
  if (lang) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: lang.toUpperCase(), font: 'Courier New', size: 12, color: '6a737d' })],
      shading: { type: 'clear' as any, fill: 'f6f8fa' },
      spacing: { before: 100, after: 0 },
    }))
  }

  // Code content — one paragraph per line with proper breaks
  if (code) {
    const lineRuns = extractCodeLineRuns(code)
    for (let i = 0; i < lineRuns.length; i++) {
      paragraphs.push(new Paragraph({
        children: lineRuns[i],
        shading: { type: 'clear' as any, fill: 'f6f8fa' },
        spacing: { before: 0, after: 0, line: 240 },
      }))
    }
    // Add bottom spacing on last line
    if (paragraphs.length > 0) {
      const last = paragraphs[paragraphs.length - 1]
      paragraphs[paragraphs.length - 1] = new Paragraph({
        ...last,
        spacing: { before: 0, after: 100, line: 240 },
      } as any)
    }
  }

  return paragraphs
}

function convertRichBlock(el: Element, images: Map<Element, { data: Uint8Array; width: number; height: number }>): Paragraph[] {
  const renderContainer = el.querySelector('.rich-render-container')
  const lang = el.getAttribute('data-language') || ''

  if (renderContainer && images.has(renderContainer)) {
    const img = images.get(renderContainer)!
    const maxPts = 432 // 6 inches
    const imgW = (img.width / 2) * 0.75
    const imgH = (img.height / 2) * 0.75
    const scale = Math.min(1, maxPts / imgW)

    return [new Paragraph({
      children: [
        new ImageRun({
          data: img.data,
          transformation: { width: Math.round(imgW * scale), height: Math.round(imgH * scale) },
          type: 'png',
        }),
      ],
      alignment: 'center' as any,
      spacing: { before: 100, after: 100 },
    })]
  }

  // Fallback: source code
  const codeEl = el.querySelector('pre code')
  const source = codeEl?.textContent || ''
  return [new Paragraph({
    children: [new TextRun({ text: source, font: 'Courier New', size: 18 })],
    shading: { type: 'clear' as any, fill: 'f6f8fa' },
    spacing: { before: 100, after: 100 },
  })]
}

function convertTable(el: Element): Table {
  const rows: TableRow[] = []
  for (const tr of el.querySelectorAll('tr')) {
    const cells: TableCell[] = []
    for (const cell of tr.querySelectorAll('td, th')) {
      const isHeader = cell.tagName.toLowerCase() === 'th'
      cells.push(new TableCell({
        children: [new Paragraph({ children: extractRuns(cell), spacing: { before: 20, after: 20 } })],
        shading: isHeader ? { type: 'clear' as any, fill: 'f6f8fa' } : undefined,
      }))
    }
    rows.push(new TableRow({ children: cells }))
  }
  return new Table({ rows, width: { size: 100, type: 'pct' as any } })
}

// ── Run extractors ──────────────────────────────────────────

/**
 * Extract code runs split by newlines for proper line breaks in DOCX.
 * Returns an array of arrays — each inner array is one line's TextRuns.
 */
function extractCodeLineRuns(el: Element): TextRun[][] {
  // First collect all runs as flat array
  const flatRuns: { text: string; color?: string }[] = []

  function walk(node: Node) {
    if (node.nodeType === 3) {
      const text = node.textContent || ''
      if (text) flatRuns.push({ text })
      return
    }
    if (node.nodeType !== 1) return
    const element = node as Element
    if (element.tagName.toLowerCase() === 'br') {
      if (!element.classList.contains('ProseMirror-trailingBreak')) {
        flatRuns.push({ text: '\n' })
      }
      return
    }

    let color: string | undefined
    for (const cls of element.classList) {
      if (HLJS_COLORS[cls]) { color = HLJS_COLORS[cls]; break }
    }

    if (color) {
      const text = element.textContent || ''
      if (text) flatRuns.push({ text, color })
      else for (const child of element.childNodes) walk(child)
    } else {
      for (const child of element.childNodes) walk(child)
    }
  }

  for (const child of el.childNodes) walk(child)

  // Split into lines
  const lines: TextRun[][] = [[]]
  for (const run of flatRuns) {
    const parts = run.text.split('\n')
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) lines.push([]) // new line
      if (parts[i]) {
        lines[lines.length - 1].push(new TextRun({
          text: parts[i], font: 'Courier New', size: 18, ...(run.color ? { color: run.color } : {}),
        }))
      }
    }
  }

  // Ensure each line has at least an empty run
  for (const line of lines) {
    if (line.length === 0) line.push(new TextRun({ text: '', font: 'Courier New', size: 18 }))
  }

  return lines
}

/** Extract inline TextRun/ExternalHyperlink from element children. */
function extractRuns(el: Element): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = []

  function walk(node: Node, opts: Record<string, unknown> = {}) {
    if (node.nodeType === 3) {
      const text = node.textContent || ''
      if (text) runs.push(new TextRun({ text, ...opts }))
      return
    }
    if (node.nodeType !== 1) return
    const element = node as Element
    const tag = element.tagName.toLowerCase()

    if (tag === 'br') {
      if (!element.classList.contains('ProseMirror-trailingBreak'))
        runs.push(new TextRun({ text: '', break: 1 }))
      return
    }
    if (tag === 'span' && element.classList.contains('md-prefix')) return

    if (tag === 'strong' || tag === 'b')
      for (const c of element.childNodes) walk(c, { ...opts, bold: true })
    else if (tag === 'em' || tag === 'i')
      for (const c of element.childNodes) walk(c, { ...opts, italics: true })
    else if (tag === 's' || tag === 'del')
      for (const c of element.childNodes) walk(c, { ...opts, strike: true })
    else if (tag === 'code' && !element.closest('pre'))
      for (const c of element.childNodes)
        walk(c, { ...opts, font: 'Courier New', size: 20, shading: { type: 'clear' as any, fill: 'f0f0f0' } })
    else if (tag === 'a') {
      const href = element.getAttribute('href') || ''
      if (href) {
        runs.push(new ExternalHyperlink({
          link: href,
          children: [new TextRun({ text: element.textContent || href, style: 'Hyperlink', color: '0366d6', underline: { type: 'single' as any } })],
        }))
      } else for (const c of element.childNodes) walk(c, opts)
    } else if (tag === 'input')
      runs.push(new TextRun({ text: (element as HTMLInputElement).checked ? '\u2611 ' : '\u2610 ' }))
    else
      for (const c of element.childNodes) walk(c, opts)
  }

  for (const child of el.childNodes) walk(child)
  if (runs.length === 0) runs.push(new TextRun(''))
  return runs
}
