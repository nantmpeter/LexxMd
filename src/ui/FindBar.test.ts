import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FindBar from './FindBar.vue'

function mountFindBar(props = {}) {
  return mount(FindBar, {
    props: {
      query: '',
      replace: '',
      countLabel: '',
      disabled: true,
      notFound: false,
      ...props,
    },
  })
}

// happy-dom ignores unknown KeyboardEventInit members, so keyCode is patched
// onto the event afterwards; cancelable must be set for preventDefault().
function fireKeydown(el: Element, init: KeyboardEventInit & { keyCode?: number }): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { ...init, cancelable: true, bubbles: true })
  if (init.keyCode !== undefined) {
    Object.defineProperty(e, 'keyCode', { value: init.keyCode, configurable: true })
  }
  el.dispatchEvent(e)
  return e
}

describe('FindBar', () => {
  it('emits query and replacement updates', async () => {
    const wrapper = mountFindBar()

    await wrapper.find('input[type="search"]').setValue('alpha')
    await wrapper.find('.replace-input').setValue('beta')

    expect(wrapper.emitted('update:query')?.[0]).toEqual(['alpha'])
    expect(wrapper.emitted('update:replace')?.[0]).toEqual(['beta'])
  })

  it('shows an explicit no-results state', () => {
    const wrapper = mountFindBar({
      query: 'missing',
      countLabel: 'No results',
      notFound: true,
    })

    expect(wrapper.find('.find-bar').classes()).toContain('has-no-results')
    expect(wrapper.find('input[type="search"]').classes()).toContain('is-not-found')
    expect(wrapper.find('input[type="search"]').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('.find-count').text()).toBe('No results')
  })

  it('disables navigation and replace controls when there are no matches', () => {
    const wrapper = mountFindBar({ disabled: true })

    expect(wrapper.find('button[aria-label="Previous match"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button[aria-label="Next match"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('.find-action-btn').every(button => button.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.find('button[aria-label="Close find"]').attributes('disabled')).toBeUndefined()
  })

  it('uses a clear replace-all label', () => {
    const wrapper = mountFindBar({ disabled: false })

    expect(wrapper.text()).toContain('Replace all')
  })
})

describe('FindBar IME composition guard', () => {
  it('Enter during composition does not jump a match; plain Enter still does', () => {
    const wrapper = mountFindBar()
    const input = wrapper.find('input[type="search"]').element

    const composing = fireKeydown(input, { key: 'Enter', isComposing: true })
    expect(wrapper.emitted('enter')).toBeUndefined()
    expect(composing.defaultPrevented).toBe(false)

    const keyCode229 = fireKeydown(input, { key: 'Enter', keyCode: 229 })
    expect(wrapper.emitted('enter')).toBeUndefined()
    expect(keyCode229.defaultPrevented).toBe(false)

    const plain = fireKeydown(input, { key: 'Enter' })
    expect(wrapper.emitted('enter')).toHaveLength(1)
    expect(plain.defaultPrevented).toBe(true)
  })

  it('Escape during composition does not close the bar; plain Escape still does', () => {
    const wrapper = mountFindBar()
    const input = wrapper.find('input[type="search"]').element

    fireKeydown(input, { key: 'Escape', isComposing: true })
    expect(wrapper.emitted('close')).toBeUndefined()

    const plain = fireKeydown(input, { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(plain.defaultPrevented).toBe(true)
  })

  it('Escape in the replace input is guarded the same way', () => {
    const wrapper = mountFindBar()
    const input = wrapper.find('.replace-input').element

    fireKeydown(input, { key: 'Escape', isComposing: true })
    expect(wrapper.emitted('close')).toBeUndefined()

    fireKeydown(input, { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
