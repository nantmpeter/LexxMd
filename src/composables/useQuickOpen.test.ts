import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useQuickOpen } from './useQuickOpen'
import { listDirectory } from '../tauri/commands'
import type { DirEntry } from '../tauri/commands'

vi.mock('../tauri/commands', () => ({
  listDirectory: vi.fn(),
}))

const mockedListDirectory = vi.mocked(listDirectory)

function entry(name: string, overrides: Partial<DirEntry> = {}): DirEntry {
  return {
    name,
    path: `/ws/${name}`,
    is_dir: false,
    is_markdown: name.endsWith('.md'),
    ...overrides,
  }
}

function setup() {
  return useQuickOpen({
    workspaceRoot: ref<string | null>('/ws'),
    showToast: vi.fn(),
    openFileFromTree: vi.fn(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useQuickOpen scan', () => {
  it('skips unreadable directories and keeps the rest of the results', async () => {
    mockedListDirectory.mockImplementation(async (dirPath: string) => {
      if (dirPath === '/ws') {
        return [
          entry('note.md', { path: '/ws/note.md' }),
          entry('locked', { path: '/ws/locked', is_dir: true }),
          entry('open', { path: '/ws/open', is_dir: true }),
        ]
      }
      if (dirPath === '/ws/locked') {
        throw new Error('permission denied')
      }
      if (dirPath === '/ws/open') {
        return [entry('open.md', { path: '/ws/open/open.md' })]
      }
      throw new Error(`unexpected directory: ${dirPath}`)
    })

    const quickOpen = setup()
    await quickOpen.openQuickOpen()

    expect(quickOpen.quickOpenError.value).toBe('')
    expect(quickOpen.quickOpenLoading.value).toBe(false)
    expect(quickOpen.quickOpenFiles.value.map((f) => f.path)).toEqual([
      '/ws/note.md',
      '/ws/open/open.md',
    ])
  })

  it('completes the full tree with results intact under concurrent reads', async () => {
    const listings = new Map<string, DirEntry[]>()
    const rootEntries: DirEntry[] = []
    for (let i = 0; i < 12; i += 1) {
      rootEntries.push(entry(`d${i}`, { path: `/ws/d${i}`, is_dir: true }))
      listings.set(`/ws/d${i}`, [
        entry(`f${i}.md`, { path: `/ws/d${i}/f${i}.md` }),
        entry(`sub${i}`, { path: `/ws/d${i}/sub${i}`, is_dir: true }),
      ])
      listings.set(`/ws/d${i}/sub${i}`, [
        entry(`s${i}.md`, { path: `/ws/d${i}/sub${i}/s${i}.md` }),
      ])
    }
    listings.set('/ws', rootEntries)

    let inFlight = 0
    let peakInFlight = 0
    mockedListDirectory.mockImplementation(async (dirPath: string) => {
      const entries = listings.get(dirPath)
      if (!entries) throw new Error(`unexpected directory: ${dirPath}`)
      inFlight += 1
      peakInFlight = Math.max(peakInFlight, inFlight)
      // Yield to the microtask queue so waves can genuinely overlap.
      await new Promise((resolve) => setTimeout(resolve, 0))
      inFlight -= 1
      return entries
    })

    const quickOpen = setup()
    await quickOpen.openQuickOpen()

    const paths = quickOpen.quickOpenFiles.value.map((f) => f.path)
    expect(paths).toHaveLength(24)
    for (let i = 0; i < 12; i += 1) {
      expect(paths).toContain(`/ws/d${i}/f${i}.md`)
      expect(paths).toContain(`/ws/d${i}/sub${i}/s${i}.md`)
    }
    // More than one IPC overlapped, but never more than the concurrency cap.
    expect(peakInFlight).toBeGreaterThan(1)
    expect(peakInFlight).toBeLessThanOrEqual(8)
  })

  it('reports an error when the workspace root itself is unreadable', async () => {
    mockedListDirectory.mockRejectedValue(new Error('permission denied'))

    const quickOpen = setup()
    await quickOpen.openQuickOpen()

    expect(quickOpen.quickOpenError.value).toBe('permission denied')
    expect(quickOpen.quickOpenFiles.value).toEqual([])
  })
})
