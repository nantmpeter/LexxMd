import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { exportPDF, planPdfPages, waitForImagesLoaded, PAGE_HEIGHT_PX, CHUNK_SLACK_PX, type MeasuredBlock } from './pdf'

vi.mock('html2canvas', () => ({
  default: vi.fn(async (_el: HTMLElement, opts: { y: number; height: number }) => ({
    width: 1600,
    height: opts.height * 2,
    toDataURL: () => 'data:image/jpeg;base64,ZmFrZQ==',
  })),
}))

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(function () {
    return {
      addPage: vi.fn(),
      addImage: vi.fn(),
      output: () => new Blob(['fake-pdf'], { type: 'application/pdf' }),
    }
  }),
}))

// Use the editor element itself instead of a cloneNode copy: the per-element
// getBoundingClientRect stubs below are JS own properties and would not
// survive cloneNode.
vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>()
  return { ...actual, cloneEditorContent: (el: HTMLElement) => el }
})

const USABLE = PAGE_HEIGHT_PX - CHUNK_SLACK_PX

function block(top: number, height: number, tag = 'p'): MeasuredBlock {
  return { el: document.createElement(tag), top, height }
}

describe('planPdfPages', () => {
  it('groups normal blocks into chunks that never exceed one usable page', () => {
    const blocks = [block(0, 300), block(300, 300), block(600, 300), block(900, 300)]
    const chunks = planPdfPages(blocks)

    expect(chunks).toHaveLength(2)
    expect(chunks[0].kind).toBe('blocks')
    expect(chunks[0].height).toBeLessThanOrEqual(USABLE)
    expect(chunks[1].kind).toBe('blocks')
    expect(chunks[1].height).toBeLessThanOrEqual(USABLE)
  })

  it('never splits a normal block: every element lands in exactly one chunk', () => {
    const blocks = [
      block(0, 200, 'h1'),
      block(200, 400),
      block(600, 500, 'table'),
      block(1100, 300, 'pre'),
      block(1400, 200),
    ]
    const chunks = planPdfPages(blocks)

    const allEls = chunks.flatMap((c) => (c.kind === 'blocks' ? c.els : [c.el]))
    expect(allEls).toHaveLength(blocks.length)
    expect(new Set(allEls).size).toBe(blocks.length)
    for (const c of chunks) {
      if (c.kind === 'blocks') expect(c.height).toBeLessThanOrEqual(USABLE)
    }
  })

  it('puts a block taller than one page alone into an oversized chunk', () => {
    const tall = block(300, 3000, 'pre')
    const blocks = [block(0, 300), tall, block(3300, 200)]
    const chunks = planPdfPages(blocks)

    expect(chunks.map((c) => c.kind)).toEqual(['blocks', 'oversized', 'blocks'])
    expect(chunks[1]).toMatchObject({ top: 300, height: 3000 })
  })

  it('handles a document that is one giant oversized block', () => {
    const chunks = planPdfPages([block(0, 20000, 'pre')])
    expect(chunks).toHaveLength(1)
    expect(chunks[0].kind).toBe('oversized')
  })
})

describe('waitForImagesLoaded', () => {
  /** Minimal img stand-in: `complete` gate + manual event firing. */
  function stubImg(complete: boolean) {
    const listeners: Record<string, Array<() => void>> = {}
    return {
      complete,
      addEventListener(type: string, cb: () => void) {
        listeners[type] = listeners[type] ?? []
        listeners[type].push(cb)
      },
      fire(type: string) {
        for (const cb of listeners[type] ?? []) cb()
      },
    }
  }

  function stubRoot(images: ReturnType<typeof stubImg>[]): ParentNode {
    return { querySelectorAll: (selector: string) => (selector === 'img' ? images : []) } as unknown as ParentNode
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Drain the promise chain: listener resolve → Promise.all → race → await → then. */
  async function flushMicrotasks(): Promise<void> {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  }

  it('resolves immediately when every image is already complete', async () => {
    const root = stubRoot([stubImg(true), stubImg(true)])
    await expect(waitForImagesLoaded(root)).resolves.toBeUndefined()
  })

  it('resolves once every pending image fires load', async () => {
    const a = stubImg(false)
    const b = stubImg(false)
    const root = stubRoot([a, b])
    let resolved = false
    void waitForImagesLoaded(root).then(() => {
      resolved = true
    })

    await flushMicrotasks()
    expect(resolved).toBe(false)
    a.fire('load')
    await flushMicrotasks()
    expect(resolved).toBe(false) // b still pending
    b.fire('load')
    await flushMicrotasks()
    expect(resolved).toBe(true)
  })

  it('treats a failed image like a loaded one (error settles the wait)', async () => {
    const a = stubImg(false)
    const root = stubRoot([a])
    let resolved = false
    void waitForImagesLoaded(root).then(() => {
      resolved = true
    })

    await flushMicrotasks()
    expect(resolved).toBe(false)
    a.fire('error')
    await flushMicrotasks()
    expect(resolved).toBe(true)
  })

  it('gives up after the timeout instead of hanging the export on a dead URL', async () => {
    vi.useFakeTimers()
    const root = stubRoot([stubImg(false)])
    let resolved = false
    void waitForImagesLoaded(root, 5000).then(() => {
      resolved = true
    })

    await vi.advanceTimersByTimeAsync(4999)
    expect(resolved).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(resolved).toBe(true)
  })
})

describe('exportPDF pagination', () => {
  const html2canvasMock = vi.mocked(html2canvas)

  beforeEach(() => {
    html2canvasMock.mockClear()
    vi.mocked(jsPDF).mockClear()
  })

  /** Build an editor element whose blocks report deterministic geometry. */
  function buildEditor(heights: number[]): HTMLElement {
    const root = document.createElement('div')
    const pm = document.createElement('div')
    pm.className = 'ProseMirror'
    let top = 0
    for (const h of heights) {
      const el = document.createElement('p')
      const blockTop = top
      el.getBoundingClientRect = () => ({ top: blockTop, height: h, bottom: blockTop + h } as DOMRect)
      pm.appendChild(el)
      top += h
    }
    root.appendChild(pm)
    root.getBoundingClientRect = () => ({ top: 0 } as DOMRect)
    return root
  }

  it('renders page-sized chunks instead of one whole-document canvas', async () => {
    // 6 x 300px blocks: chunk 1 = 3 blocks (900px), chunk 2 = 3 blocks (900px).
    await exportPDF(buildEditor([300, 300, 300, 300, 300, 300]), 'doc.pdf')

    expect(html2canvasMock).toHaveBeenCalledTimes(2)
    for (const call of html2canvasMock.mock.calls) {
      const opts = call[1] as { y: number; height: number; width: number }
      expect(opts.width).toBe(800)
      expect(opts.height).toBeLessThanOrEqual(USABLE)
    }
  })

  it('slices an oversized block at page boundaries', async () => {
    await exportPDF(buildEditor([3000]), 'doc.pdf')

    // ceil(3000 / usable) slices
    expect(html2canvasMock).toHaveBeenCalledTimes(Math.ceil(3000 / USABLE))
    const cropHeights = html2canvasMock.mock.calls.map(
      (c) => (c[1] as { height: number }).height
    )
    for (const h of cropHeights) expect(h).toBeLessThanOrEqual(USABLE)
    expect(cropHeights.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(3000)
  })

  it('starts a new PDF page for every rendered chunk', async () => {
    await exportPDF(buildEditor([300, 300, 300, 300, 300, 300, 5000]), 'doc.pdf')

    const pdfInstance = vi.mocked(jsPDF).mock.results[0]?.value as {
      addPage: ReturnType<typeof vi.fn>
      addImage: ReturnType<typeof vi.fn>
    }
    const renderCalls = html2canvasMock.mock.calls.length
    // 2 block chunks + ceil(5000/usable) slices for the oversized block
    expect(renderCalls).toBe(2 + Math.ceil(5000 / USABLE))
    expect(pdfInstance.addImage).toHaveBeenCalledTimes(renderCalls)
    expect(pdfInstance.addPage).toHaveBeenCalledTimes(renderCalls - 1)
  })
})
