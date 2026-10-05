import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SidebarTree from './SidebarTree.vue'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
const mockedInvoke = invoke as unknown as ReturnType<typeof vi.fn>

function entriesFor(root: string) {
  if (root === '/root-a') {
    return [
      { name: 'alpha.md', path: '/root-a/alpha.md', is_dir: false, is_markdown: true },
      { name: 'notes', path: '/root-a/notes', is_dir: true, is_markdown: false },
    ]
  }
  return [
    { name: 'beta.md', path: '/root-b/beta.md', is_dir: false, is_markdown: true },
  ]
}

beforeEach(() => {
  mockedInvoke.mockReset()
  mockedInvoke.mockImplementation(
    (_cmd: string, args: { dirPath: string }) => Promise.resolve(entriesFor(args.dirPath)),
  )
})

describe('SidebarTree', () => {
  it('renders the root directory listing on mount', async () => {
    const wrapper = mount(SidebarTree, {
      props: { rootPath: '/root-a', activePath: '' },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('alpha.md')
    expect(wrapper.text()).toContain('notes')
  })

  it('reloads the tree when rootPath changes', async () => {
    const wrapper = mount(SidebarTree, {
      props: { rootPath: '/root-a', activePath: '' },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('alpha.md')

    // Regression: opening a different folder while the tree is already shown
    // must re-run loadRoot (the component is not remounted, so onMounted
    // alone leaves a stale listing).
    await wrapper.setProps({ rootPath: '/root-b' })
    await flushPromises()
    expect(wrapper.text()).toContain('beta.md')
    expect(wrapper.text()).not.toContain('alpha.md')
    expect(mockedInvoke).toHaveBeenCalledWith('list_directory', { dirPath: '/root-b' })
  })
})
