import { describe, it, expect, vi } from 'vitest'
import { ImageRun } from 'docx'
import {
  sniffImageFormat,
  loadDocxImage,
  resolveDocxImageSize,
  extractRuns,
  type DocxImageRunData,
} from './docx'

// 1x1 transparent PNG — only the magic bytes need to be right for these tests.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function dataUrlPng(): string {
  return `data:image/png;base64,${TINY_PNG_BASE64}`
}

function fakeImg(props: Partial<HTMLImageElement> & { src?: string }): HTMLImageElement {
  const el = document.createElement('img')
  if (props.src !== undefined) el.setAttribute('src', props.src)
  // Duck-type the measurable properties: happy-dom performs no image decode
  // or layout, so tests supply the values resolveDocxImageSize reads.
  const target = el as unknown as Record<string, unknown>
  for (const key of ['clientWidth', 'clientHeight', 'width', 'height', 'naturalWidth', 'naturalHeight'] as const) {
    if (props[key] !== undefined) target[key] = props[key]
  }
  return el
}

describe('sniffImageFormat', () => {
  it('detects png, jpg, gif and bmp magic bytes', () => {
    expect(sniffImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe('png')
    expect(sniffImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg')
    expect(sniffImageFormat(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39]))).toBe('gif')
    expect(sniffImageFormat(new Uint8Array([0x42, 0x4d, 0x00, 0x00]))).toBe('bmp')
  })

  it('returns null for unknown or truncated data', () => {
    expect(sniffImageFormat(new Uint8Array([1, 2, 3, 4]))).toBeNull()
    expect(sniffImageFormat(new Uint8Array([0x89]))).toBeNull()
  })
})

describe('loadDocxImage', () => {
  it('decodes a data: URL into image bytes with the right format', async () => {
    const img = fakeImg({ src: dataUrlPng() })
    const loaded = await loadDocxImage(img)
    expect(loaded).not.toBeNull()
    expect(loaded!.format).toBe('png')
    expect(loaded!.data.byteLength).toBeGreaterThan(0)
  })

  it('returns null for an unsupported data mime', async () => {
    const img = fakeImg({ src: 'data:image/webp;base64,AAAA' })
    expect(await loadDocxImage(img)).toBeNull()
  })

  it('returns null when src is missing or unreadable, instead of throwing', async () => {
    expect(await loadDocxImage(fakeImg({}))).toBeNull()
    // A plain path in a non-Tauri test environment cannot be converted/fetched.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await loadDocxImage(fakeImg({ src: '/does/not/exist.png' }))).toBeNull()
    warn.mockRestore()
  })

  it('sizes from width/height attributes when no layout is available', async () => {
    const el = document.createElement('img')
    el.setAttribute('src', dataUrlPng())
    el.setAttribute('width', '32')
    el.setAttribute('height', '16')
    const loaded = await loadDocxImage(el as unknown as HTMLImageElement)
    expect(loaded!.width).toBe(32)
    expect(loaded!.height).toBe(16)
  })
})

describe('resolveDocxImageSize', () => {
  it('prefers the rendered box over attributes and natural size', () => {
    expect(
      resolveDocxImageSize({
        clientWidth: 200, clientHeight: 100, width: 800, height: 400, naturalWidth: 4000, naturalHeight: 2000,
      })
    ).toEqual({ width: 200, height: 100 })
  })

  it('clamps an oversized image to the max width, keeping the aspect ratio', () => {
    const size = resolveDocxImageSize({
      clientWidth: 4000, clientHeight: 2000, width: 0, height: 0, naturalWidth: 0, naturalHeight: 0,
    })
    expect(size.width).toBeLessThanOrEqual(620)
    expect(size.height).toBe(Math.round(2000 * (size.width / 4000)))
  })

  it('falls back to width/height attributes, then natural size, then the default', () => {
    expect(
      resolveDocxImageSize({
        clientWidth: 0, clientHeight: 0, width: 64, height: 32, naturalWidth: 128, naturalHeight: 64,
      })
    ).toEqual({ width: 64, height: 32 })
    expect(
      resolveDocxImageSize({
        clientWidth: 0, clientHeight: 0, width: 0, height: 0, naturalWidth: 128, naturalHeight: 64,
      })
    ).toEqual({ width: 128, height: 64 })
    expect(
      resolveDocxImageSize({
        clientWidth: 0, clientHeight: 0, width: 0, height: 0, naturalWidth: 0, naturalHeight: 0,
      })
    ).toEqual({ width: 480, height: 360 })
  })
})

describe('extractRuns img branch', () => {
  function buildImages(el: Element, data: DocxImageRunData): Map<Element, DocxImageRunData> {
    const map = new Map<Element, DocxImageRunData>()
    const img = el.querySelector('img')
    if (img) map.set(img, data)
    return map
  }

  it('emits an ImageRun for a mapped <img> inside a paragraph', () => {
    const container = document.createElement('div')
    container.innerHTML = `<p>before <img src="${dataUrlPng()}" alt="cat" width="32" height="16"> after</p>`
    const p = container.querySelector('p')!
    const imgEl = p.querySelector('img')!
    const images = buildImages(container, {
      data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      format: 'png',
      width: 32,
      height: 16,
    })

    const runs = extractRuns(p, images)
    const imageRuns = runs.filter((r): r is ImageRun => r instanceof ImageRun)
    expect(imageRuns).toHaveLength(1)
    // Text before and after the image is preserved.
    expect(runs.length).toBeGreaterThanOrEqual(3)
    expect(imgEl.getAttribute('alt')).toBe('cat')
  })

  it('skips an <img> missing from the map without throwing', () => {
    const container = document.createElement('div')
    container.innerHTML = `<p>a <img src="/broken.png" alt="x"> b</p>`
    const p = container.querySelector('p')!
    const runs = extractRuns(p)
    expect(runs.some((r) => r instanceof ImageRun)).toBe(false)
    // The surrounding text runs survive the skipped image.
    expect(runs.length).toBe(2)
  })
})
