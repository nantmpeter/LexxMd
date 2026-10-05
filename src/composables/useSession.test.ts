import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { buildSession, parseSession, useSession } from './useSession'
import type { FileSlot } from '../types'
import { readAppDataJson, writeAppDataJson } from '../tauri/appData'
import { fileRead } from '../tauri/commands'

vi.mock('../tauri/appData', () => ({
  readAppDataJson: vi.fn(),
  writeAppDataJson: vi.fn(),
}))

vi.mock('../tauri/commands', () => ({
  fileRead: vi.fn(),
}))

const mockedReadAppData = vi.mocked(readAppDataJson)
const mockedWriteAppData = vi.mocked(writeAppDataJson)
const mockedFileRead = vi.mocked(fileRead)

function makeSlot(partial: Partial<FileSlot>): FileSlot {
  return {
    id: partial.id ?? 'file-1',
    filePath: null,
    filename: 'Untitled.md',
    dirty: false,
    editor: null,
    element: null,
    lastSavedContent: '',
    ...partial,
  }
}

describe('buildSession', () => {
  it('keeps only saved files and maps the active index into that array', () => {
    const slots = [
      makeSlot({ id: 'a', filePath: '/docs/a.md' }),
      makeSlot({ id: 'b', filePath: null }), // untitled: excluded
      makeSlot({ id: 'c', filePath: '/docs/c.md' }),
    ]
    // Active slot is c (index 2 among all slots, index 1 among saved files).
    expect(buildSession(slots, 2)).toEqual({
      files: [{ path: '/docs/a.md' }, { path: '/docs/c.md' }],
      active: 1,
    })
  })

  it('degrades to the first saved file when the active slot is untitled', () => {
    const slots = [
      makeSlot({ id: 'a', filePath: '/docs/a.md' }),
      makeSlot({ id: 'b', filePath: null }),
    ]
    expect(buildSession(slots, 1)).toEqual({
      files: [{ path: '/docs/a.md' }],
      active: 0,
    })
  })

  it('returns an empty session when nothing is saved', () => {
    expect(buildSession([makeSlot({ id: 'a' })], 0)).toEqual({ files: [], active: 0 })
  })
})

describe('parseSession', () => {
  it('accepts a valid session', () => {
    expect(parseSession('{"files":[{"path":"/a.md"},{"path":"/b.md"}],"active":1}')).toEqual({
      files: [{ path: '/a.md' }, { path: '/b.md' }],
      active: 1,
    })
  })

  it('rejects structural garbage', () => {
    expect(parseSession(null)).toBeNull()
    expect(parseSession('')).toBeNull()
    expect(parseSession('not json')).toBeNull()
    expect(parseSession('42')).toBeNull()
    expect(parseSession('{"active":0}')).toBeNull()
    expect(parseSession('{"files":"nope","active":0}')).toBeNull()
  })

  it('drops entries with empty or missing paths', () => {
    expect(
      parseSession('{"files":[{"path":""},{"nope":1},{"path":"/keep.md"}],"active":0}'),
    ).toEqual({ files: [{ path: '/keep.md' }], active: 0 })
  })

  it('defaults a missing/invalid active index to 0', () => {
    expect(parseSession('{"files":[{"path":"/a.md"}]}')).toEqual({
      files: [{ path: '/a.md' }],
      active: 0,
    })
    expect(parseSession('{"files":[{"path":"/a.md"}],"active":-3}')).toEqual({
      files: [{ path: '/a.md' }],
      active: 0,
    })
  })

  it('clamps a stale out-of-range active index instead of discarding the session', () => {
    expect(parseSession('{"files":[{"path":"/a.md"}],"active":9}')).toEqual({
      files: [{ path: '/a.md' }],
      active: 0,
    })
  })
})

describe('useSession restoreSession', () => {
  beforeEach(() => {
    mockedReadAppData.mockReset()
    mockedWriteAppData.mockReset()
    mockedFileRead.mockReset()
  })

  function setup() {
    const openFiles = ref<FileSlot[]>([])
    const activeIndex = ref(-1)
    let idCounter = 0
    const switchedTo: string[] = []
    const { restoreSession } = useSession({
      openFiles,
      activeIndex,
      createFileSlot: (content, filename, filePath) => {
        const slot = makeSlot({
          id: `slot-${++idCounter}`,
          filePath,
          filename: filename ?? 'Untitled.md',
          lastSavedContent: content ?? '',
        })
        openFiles.value.push(slot)
        return slot
      },
      switchToFile: (id) => { switchedTo.push(id) },
    })
    return { openFiles, activeIndex, restoreSession, switchedTo }
  }

  it('restores saved files and activates the recorded one', async () => {
    mockedReadAppData.mockResolvedValue('{"files":[{"path":"/a.md"},{"path":"/b.md"}],"active":1}')
    mockedFileRead.mockImplementation((path) =>
      Promise.resolve(path === '/a.md' ? 'content a' : 'content b'))

    const { openFiles, activeIndex, restoreSession, switchedTo } = setup()
    const restored = await restoreSession()

    expect(restored).toBe(true)
    expect(openFiles.value.map((s) => s.filePath)).toEqual(['/a.md', '/b.md'])
    expect(openFiles.value.map((s) => s.lastSavedContent)).toEqual(['content a', 'content b'])
    // Active slot = recorded index 1 = '/b.md'
    expect(switchedTo).toEqual([openFiles.value[1].id])
    expect(activeIndex.value).toBe(-1) // switchToFile is a stub; index untouched
  })

  it('skips files that vanished and falls back to the first survivor', async () => {
    mockedReadAppData.mockResolvedValue('{"files":[{"path":"/gone.md"},{"path":"/here.md"}],"active":0}')
    mockedFileRead.mockImplementation((path) =>
      path === '/gone.md' ? Promise.reject(new Error('missing')) : Promise.resolve('here'))

    const { openFiles, restoreSession, switchedTo } = setup()
    const restored = await restoreSession()

    expect(restored).toBe(true)
    expect(openFiles.value.map((s) => s.filePath)).toEqual(['/here.md'])
    expect(switchedTo).toEqual([openFiles.value[0].id])
  })

  it('returns false and opens nothing when every file is unreadable', async () => {
    mockedReadAppData.mockResolvedValue('{"files":[{"path":"/gone.md"}],"active":0}')
    mockedFileRead.mockRejectedValue(new Error('missing'))

    const { openFiles, restoreSession, switchedTo } = setup()
    expect(await restoreSession()).toBe(false)
    expect(openFiles.value).toEqual([])
    expect(switchedTo).toEqual([])
  })

  it('returns false on an empty or missing session file', async () => {
    mockedReadAppData.mockResolvedValue('{"files":[],"active":0}')
    const { restoreSession } = setup()
    expect(await restoreSession()).toBe(false)

    mockedReadAppData.mockResolvedValue(null)
    expect(await restoreSession()).toBe(false)
    expect(mockedFileRead).not.toHaveBeenCalled()
  })
})

describe('useSession snapshot watcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockedReadAppData.mockReset()
    mockedWriteAppData.mockReset()
    mockedFileRead.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function setup() {
    const openFiles = ref<FileSlot[]>([])
    const activeIndex = ref(-1)
    useSession({
      openFiles,
      activeIndex,
      createFileSlot: () => makeSlot({}),
      switchToFile: () => {},
    })
    return { openFiles, activeIndex }
  }

  it('writes a debounced snapshot when the saved-file set changes', async () => {
    const { openFiles } = setup()

    openFiles.value.push(makeSlot({ id: 'a', filePath: '/a.md' }))
    openFiles.value.push(makeSlot({ id: 'b', filePath: '/b.md' }))
    await vi.advanceTimersByTimeAsync(499)
    expect(mockedWriteAppData).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(mockedWriteAppData).toHaveBeenCalledTimes(1)
    expect(mockedWriteAppData).toHaveBeenCalledWith('session.json', {
      files: [{ path: '/a.md' }, { path: '/b.md' }],
      active: 0,
    })
  })

  it('rewrites after the active slot switches', async () => {
    const { openFiles, activeIndex } = setup()
    openFiles.value.push(makeSlot({ id: 'a', filePath: '/a.md' }))
    openFiles.value.push(makeSlot({ id: 'b', filePath: '/b.md' }))
    await vi.advanceTimersByTimeAsync(500)
    mockedWriteAppData.mockClear()

    activeIndex.value = 1
    await vi.advanceTimersByTimeAsync(500)

    expect(mockedWriteAppData).toHaveBeenCalledWith('session.json', {
      files: [{ path: '/a.md' }, { path: '/b.md' }],
      active: 1,
    })
  })

  it('does not write while only untitled slots churn dirty state', async () => {
    const { openFiles } = setup()
    const untitled = makeSlot({ id: 'a' })
    openFiles.value.push(untitled)
    await vi.advanceTimersByTimeAsync(500)
    // Untitled-only session still snapshots (records the empty state)...
    expect(mockedWriteAppData).toHaveBeenCalledWith('session.json', { files: [], active: 0 })

    // ...but a dirty flip is not a tracked change: no further writes.
    mockedWriteAppData.mockClear()
    untitled.dirty = true
    await vi.advanceTimersByTimeAsync(500)
    expect(mockedWriteAppData).not.toHaveBeenCalled()
  })
})
