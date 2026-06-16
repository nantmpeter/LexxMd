import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import type { Editor } from '@tiptap/core'
import OutlineView from './OutlineView.vue'

function createMockEditor(headings: { level: number; text: string }[]) {
  const nodes = headings.map((h) => ({
    type: { name: 'heading' },
    attrs: { level: h.level },
    textContent: h.text,
  }))

  let updateCb: (() => void) | null = null
  let selectionUpdateCb: (() => void) | null = null

  // A partial duck-typed stand-in for Tiptap's `Editor`; only the surface
  // area exercised by OutlineView is implemented. Cast through `unknown`
  // because the real Editor has dozens of members we don't need to mock.
  const mock = {
    state: {
      doc: {
        forEach: (cb: (node: any, offset: number, index: number) => void) => {
          nodes.forEach((n, i) => cb(n, i * 10, i))
        },
      },
    },
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'update') updateCb = cb
      if (event === 'selectionUpdate') selectionUpdateCb = cb
    }),
    off: vi.fn(),
    view: {
      coordsAtPos: vi.fn(() => ({ top: 100, left: 0, bottom: 120, right: 100 })),
    },
  }
  return mock as unknown as Editor
}

describe('OutlineView', () => {
  const originalInnerWidth = window.innerWidth

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true })
  })

  it('renders nothing when editor is null', () => {
    const wrapper = mount(OutlineView, {
      props: { editor: null, container: null },
    })
    expect(wrapper.find('.outline-root').exists()).toBe(false)
  })

  it('renders heading items when editor has headings (desktop)', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true })

    const editor = createMockEditor([
      { level: 1, text: 'Introduction' },
      { level: 2, text: 'Getting Started' },
      { level: 3, text: 'Installation' },
    ])

    const wrapper = mount(OutlineView, {
      props: { editor, container: document.createElement('div') },
    })

    await nextTick()

    const items = wrapper.findAll('.outline-item')
    expect(items.length).toBe(3)
    expect(items[0].text()).toBe('Introduction')
    expect(items[1].text()).toBe('Getting Started')
    expect(items[2].text()).toBe('Installation')
  })

  it('applies level classes to heading items', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true })

    const editor = createMockEditor([
      { level: 1, text: 'H1' },
      { level: 2, text: 'H2' },
    ])

    const wrapper = mount(OutlineView, {
      props: { editor, container: document.createElement('div') },
    })

    await nextTick()

    const items = wrapper.findAll('.outline-item')
    expect(items[0].classes()).toContain('level-1')
    expect(items[1].classes()).toContain('level-2')
  })

  it('shows edge trigger on narrow screens when headings exist', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true })

    const editor = createMockEditor([{ level: 1, text: 'Title' }])

    const wrapper = mount(OutlineView, {
      props: { editor, container: document.createElement('div') },
    })

    await nextTick()

    expect(wrapper.find('.outline-edge-trigger').exists()).toBe(true)
  })

  it('shows "(untitled)" for headings with empty text', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true })

    const editor = createMockEditor([{ level: 1, text: '' }])

    const wrapper = mount(OutlineView, {
      props: { editor, container: document.createElement('div') },
    })

    await nextTick()

    expect(wrapper.find('.outline-item').text()).toBe('(untitled)')
  })

  it('registers editor event listeners on mount', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true })

    const editor = createMockEditor([])

    mount(OutlineView, {
      props: { editor, container: document.createElement('div') },
    })

    expect(editor.on).toHaveBeenCalledWith('update', expect.any(Function))
    expect(editor.on).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
  })

  it('cleans up editor listeners on unmount', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true })

    const editor = createMockEditor([])

    const wrapper = mount(OutlineView, {
      props: { editor, container: document.createElement('div') },
    })

    wrapper.unmount()

    expect(editor.off).toHaveBeenCalledWith('update', expect.any(Function))
    expect(editor.off).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
  })

  it('cleans up previous editor listeners when editor changes', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1400, writable: true })

    const previousEditor = createMockEditor([])
    const nextEditor = createMockEditor([])

    const wrapper = mount(OutlineView, {
      props: { editor: previousEditor, container: document.createElement('div') },
    })

    await wrapper.setProps({ editor: nextEditor })

    expect(previousEditor.off).toHaveBeenCalledWith('update', expect.any(Function))
    expect(previousEditor.off).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
    expect(nextEditor.on).toHaveBeenCalledWith('update', expect.any(Function))
    expect(nextEditor.on).toHaveBeenCalledWith('selectionUpdate', expect.any(Function))
  })
})
