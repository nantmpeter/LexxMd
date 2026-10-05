import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuickOpen from './QuickOpen.vue'
import type { QuickOpenFile } from '../types'

function file(name: string, path: string, relativePath = path): QuickOpenFile {
  return { name, path, relativePath }
}

function mountQuickOpen(props: {
  files?: QuickOpenFile[]
  recents?: QuickOpenFile[]
  loading?: boolean
  error?: string
}) {
  return mount(QuickOpen, {
    props: {
      files: props.files ?? [],
      loading: props.loading ?? false,
      error: props.error ?? '',
      ...(props.recents !== undefined ? { recents: props.recents } : {}),
    },
  })
}

function itemNames(wrapper: ReturnType<typeof mountQuickOpen>): string[] {
  return wrapper.findAll('.quick-open-item').map((w) => w.find('.quick-open-name').text())
}

function groupLabels(wrapper: ReturnType<typeof mountQuickOpen>): string[] {
  return wrapper.findAll('.quick-open-group').map((w) => w.text())
}

describe('QuickOpen recents group', () => {
  it('shows recents above workspace files with group headers on an empty query', () => {
    const wrapper = mountQuickOpen({
      files: [file('a.md', '/ws/a.md', 'a.md')],
      recents: [file('r.md', '/elsewhere/r.md', '/elsewhere')],
    })

    expect(groupLabels(wrapper)).toEqual(['Recent', 'Files'])
    expect(itemNames(wrapper)).toEqual(['r.md', 'a.md'])
  })

  it('dedupes workspace files already listed as recent', () => {
    const wrapper = mountQuickOpen({
      files: [file('a.md', '/ws/a.md', 'a.md'), file('b.md', '/ws/b.md', 'b.md')],
      recents: [file('a.md', '/ws/a.md', 'a.md')],
    })

    expect(groupLabels(wrapper)).toEqual(['Recent', 'Files'])
    expect(itemNames(wrapper)).toEqual(['a.md', 'b.md'])
    // 'b.md' is under the Files header: exactly one header between them.
    expect(groupLabels(wrapper)).toHaveLength(2)
  })

  it('selecting the first row (keyboard) opens the most recent file', async () => {
    const wrapper = mountQuickOpen({
      files: [file('a.md', '/ws/a.md', 'a.md')],
      recents: [file('r.md', '/elsewhere/r.md', '/elsewhere')],
    })

    await wrapper.find('input').trigger('keydown.enter')

    expect(wrapper.emitted('select')?.[0]).toEqual([file('r.md', '/elsewhere/r.md', '/elsewhere')])
  })

  it('arrow keys move through the combined list', async () => {
    const wrapper = mountQuickOpen({
      files: [file('a.md', '/ws/a.md', 'a.md')],
      recents: [file('r.md', '/elsewhere/r.md', '/elsewhere')],
    })
    const input = wrapper.find('input')

    await input.trigger('keydown.down')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('select')?.[0]).toEqual([file('a.md', '/ws/a.md', 'a.md')])
  })

  it('a typed query hides recents and searches workspace files only', async () => {
    const wrapper = mountQuickOpen({
      files: [file('alpha.md', '/ws/alpha.md', 'alpha.md'), file('beta.md', '/ws/beta.md', 'beta.md')],
      recents: [file('r-alpha.md', '/elsewhere/r-alpha.md', '/elsewhere/r-alpha.md')],
    })
    const input = wrapper.find('input')

    await input.setValue('alpha')

    expect(groupLabels(wrapper)).toEqual([])
    expect(itemNames(wrapper)).toEqual(['alpha.md'])
  })

  it('no recents prop keeps the flat workspace list without headers', () => {
    const wrapper = mountQuickOpen({ files: [file('a.md', '/ws/a.md', 'a.md')] })

    expect(groupLabels(wrapper)).toEqual([])
    expect(itemNames(wrapper)).toEqual(['a.md'])
  })

  it('shows No files when there is neither recents nor workspace files', () => {
    const wrapper = mountQuickOpen({})
    expect(wrapper.find('.quick-open-empty').text()).toBe('No files')
  })
})
