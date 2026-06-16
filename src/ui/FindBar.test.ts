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
