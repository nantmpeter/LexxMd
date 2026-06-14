import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ToolbarButton from './ToolbarButton.vue'

describe('ToolbarButton', () => {
  it('renders slot content', () => {
    const wrapper = mount(ToolbarButton, {
      props: {},
      slots: { default: 'Bold' },
    })
    expect(wrapper.text()).toBe('Bold')
  })

  it('does not have is-active class by default', () => {
    const wrapper = mount(ToolbarButton, {
      props: {},
      slots: { default: 'B' },
    })
    expect(wrapper.find('.toolbar-btn').classes()).not.toContain('is-active')
  })

  it('applies is-active class when active prop is true', () => {
    const wrapper = mount(ToolbarButton, {
      props: { active: true },
      slots: { default: 'B' },
    })
    expect(wrapper.find('.toolbar-btn').classes()).toContain('is-active')
  })

  it('passes through attributes', () => {
    const wrapper = mount(ToolbarButton, {
      props: {},
      attrs: { 'aria-label': 'Bold', title: 'Bold text' },
      slots: { default: 'B' },
    })
    const btn = wrapper.find('.toolbar-btn')
    expect(btn.attributes('aria-label')).toBe('Bold')
    expect(btn.attributes('title')).toBe('Bold text')
  })

  it('emits click events', async () => {
    const wrapper = mount(ToolbarButton, {
      props: {},
      slots: { default: 'Click me' },
    })
    await wrapper.find('.toolbar-btn').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
