import { describe, it, expect } from 'vitest'
import { Buffer } from 'node:buffer'
import { arrayBufferToBase64, cloneEditorContent, buildExportHTML } from './utils'

describe('arrayBufferToBase64', () => {
  it('round-trips a small buffer', () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]) // "hello"
    expect(arrayBufferToBase64(bytes.buffer)).toBe('aGVsbG8=')
  })

  it('matches the reference base64 for buffers spanning multiple chunks', () => {
    // Sizes chosen around the 0x8000 chunk boundary: exactly one chunk,
    // one chunk + 1, and several chunks + remainder.
    for (const size of [0x8000, 0x8000 + 1, 0x8000 * 3 + 17]) {
      const bytes = new Uint8Array(size)
      for (let i = 0; i < size; i++) bytes[i] = i % 256
      const expected = Buffer.from(bytes).toString('base64')
      expect(arrayBufferToBase64(bytes.buffer)).toBe(expected)
    }
  })

  it('handles an empty buffer', () => {
    expect(arrayBufferToBase64(new ArrayBuffer(0))).toBe('')
  })
})

describe('cloneEditorContent', () => {
  it('switches edit-mode blocks to render mode and strips cursors', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div class="block-edit-mode"><p>a</p></div>
      <span class="ProseMirror-cursor"></span>
      <div class="rich-block-wrapper"><pre style="display:block"></pre><div class="rich-render-container" style="display:none"></div></div>
    `
    const clone = cloneEditorContent(root)
    expect(clone.querySelector('.block-edit-mode')).toBeNull()
    expect(clone.querySelector('.block-render-mode')).not.toBeNull()
    expect(clone.querySelector('.ProseMirror-cursor')).toBeNull()
    const wrapper = clone.querySelector('.rich-block-wrapper') as HTMLElement
    expect((wrapper.querySelector('pre') as HTMLElement).style.display).toBe('none')
    expect((wrapper.querySelector('.rich-render-container') as HTMLElement).style.display).toBe('')
  })
})

describe('buildExportHTML', () => {
  it('escapes the title and inlines the export css', () => {
    const html = buildExportHTML('<p>x</p>', '<script>alert(1)</script> & "quotes"')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('<p>x</p>')
  })
})
