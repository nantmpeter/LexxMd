import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  basename,
  parseRecents,
  pushRecent,
  RECENT_FILES_MAX,
  toQuickOpenFiles,
  useRecentFiles,
} from './useRecentFiles'
import { readAppDataJson, writeAppDataJson } from '../tauri/appData'

vi.mock('../tauri/appData', () => ({
  readAppDataJson: vi.fn(),
  writeAppDataJson: vi.fn(),
}))

const mockedReadAppData = vi.mocked(readAppDataJson)
const mockedWriteAppData = vi.mocked(writeAppDataJson)

function entry(path: string, ts = 0) {
  return { path, name: basename(path), ts }
}

describe('pushRecent', () => {
  it('prepends the file with its basename and timestamp', () => {
    const next = pushRecent([entry('/old.md', 1)], '/docs/new.md', 99)
    expect(next).toEqual([
      { path: '/docs/new.md', name: 'new.md', ts: 99 },
      entry('/old.md', 1),
    ])
  })

  it('dedupes by path and moves the existing entry to the front', () => {
    const list = [entry('/a.md', 1), entry('/b.md', 2), entry('/a.md', 0)]
    const next = pushRecent(list, '/a.md', 10)
    expect(next.map((f) => f.path)).toEqual(['/a.md', '/b.md'])
    expect(next[0].ts).toBe(10)
  })

  it('caps the list at the configured maximum', () => {
    const list = Array.from({ length: RECENT_FILES_MAX }, (_, i) => entry(`/f${i}.md`, i))
    const next = pushRecent(list, '/newest.md', 999)
    expect(next).toHaveLength(RECENT_FILES_MAX)
    expect(next[0].path).toBe('/newest.md')
    expect(next.at(-1)?.path).toBe(`/f${RECENT_FILES_MAX - 2}.md`)
  })

  it('handles Windows separators in basenames', () => {
    expect(pushRecent([], 'C:\\docs\\note.md', 1)[0].name).toBe('note.md')
  })
})

describe('parseRecents', () => {
  it('degrades everything malformed to an empty list', () => {
    expect(parseRecents(null)).toEqual([])
    expect(parseRecents('')).toEqual([])
    expect(parseRecents('garbage')).toEqual([])
    expect(parseRecents('{"not":"an array"}')).toEqual([])
    expect(parseRecents('[{"nope":1},{"path":""}]')).toEqual([])
  })

  it('accepts valid entries and backfills missing name/ts', () => {
    expect(parseRecents('[{"path":"/a.md"},{"path":"/b.md","name":"b.md","ts":5}]')).toEqual([
      entry('/a.md'),
      entry('/b.md', 5),
    ])
  })
})

describe('toQuickOpenFiles', () => {
  it('uses the folder as the secondary line, falling back to the full path', () => {
    expect(toQuickOpenFiles([entry('/docs/notes/a.md')])).toEqual([
      { name: 'a.md', path: '/docs/notes/a.md', relativePath: '/docs/notes' },
    ])
    expect(toQuickOpenFiles([entry('README.md')])).toEqual([
      { name: 'README.md', path: 'README.md', relativePath: 'README.md' },
    ])
  })
})

describe('useRecentFiles IO', () => {
  beforeEach(() => {
    mockedReadAppData.mockReset()
    mockedWriteAppData.mockReset()
  })

  it('initRecents loads the store into the ref', async () => {
    mockedReadAppData.mockResolvedValue('[{"path":"/a.md","name":"a.md","ts":1}]')
    const { recentFiles, initRecents } = useRecentFiles()
    await initRecents()
    expect(recentFiles.value).toEqual([
      { name: 'a.md', path: '/a.md', relativePath: '/a.md' },
    ])
  })

  it('recordRecentFile appends, updates the ref, and persists', async () => {
    mockedReadAppData.mockResolvedValue('[{"path":"/a.md","name":"a.md","ts":1}]')
    const { recentFiles, recordRecentFile } = useRecentFiles()

    await recordRecentFile('/docs/b.md')

    expect(recentFiles.value).toEqual([
      { name: 'b.md', path: '/docs/b.md', relativePath: '/docs' },
      { name: 'a.md', path: '/a.md', relativePath: '/a.md' },
    ])
    expect(mockedWriteAppData).toHaveBeenCalledWith('recent.json', [
      { path: '/docs/b.md', name: 'b.md', ts: expect.any(Number) },
      { path: '/a.md', name: 'a.md', ts: 1 },
    ])
  })

  it('swallows storage failures without touching the ref', async () => {
    mockedReadAppData.mockRejectedValue(new Error('not in Tauri'))
    const { recentFiles, recordRecentFile } = useRecentFiles()
    await expect(recordRecentFile('/a.md')).resolves.toBeUndefined()
    expect(recentFiles.value).toEqual([])
    expect(mockedWriteAppData).not.toHaveBeenCalled()
  })
})
