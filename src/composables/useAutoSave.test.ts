import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed } from 'vue'

vi.mock('../tauri/commands', () => ({
  fileRead: vi.fn(),
  fileWrite: vi.fn(),
  tempSave: vi.fn(),
}))

import { fileRead, fileWrite, tempSave } from '../tauri/commands'
import { useAutoSave } from './useAutoSave'
import type { FileSlot } from '../types'

const mockFileRead = vi.mocked(fileRead)
const mockFileWrite = vi.mocked(fileWrite)
const mockTempSave = vi.mocked(tempSave)

function createSlot(overrides: Partial<FileSlot> = {}): FileSlot {
  return {
    id: 'slot-1',
    filePath: '/docs/test.md',
    filename: 'test.md',
    dirty: true,
    editor: {} as FileSlot['editor'],
    element: null,
    lastSavedContent: 'saved content',
    tempPath: null,
    ...overrides,
  }
}

function createComposable(slot: FileSlot) {
  return useAutoSave({
    activeFile: computed(() => slot),
    getMarkdownContent: () => 'edited content',
    syncSourceToSlot: () => {},
    showToast: vi.fn(),
  })
}

describe('useAutoSave external-change guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips the write and keeps dirty when the file changed on disk since the last save', async () => {
    const slot = createSlot()
    const { performAutoSave } = createComposable(slot)

    mockFileRead.mockResolvedValue('externally edited content')

    const result = await performAutoSave(slot)

    expect(result).toBe(false)
    expect(mockFileWrite).not.toHaveBeenCalled()
    // The user's in-editor edits must survive: dirty stays, last saved
    // baseline unchanged, so nothing is silently clobbered.
    expect(slot.dirty).toBe(true)
    expect(slot.lastSavedContent).toBe('saved content')
  })

  it('writes normally when the disk content still matches lastSavedContent', async () => {
    const slot = createSlot()
    const { performAutoSave } = createComposable(slot)

    mockFileRead.mockResolvedValue('saved content')
    mockFileWrite.mockResolvedValue(undefined)

    const result = await performAutoSave(slot)

    expect(result).toBe(true)
    expect(mockFileWrite).toHaveBeenCalledWith('/docs/test.md', 'edited content')
    expect(slot.dirty).toBe(false)
    expect(slot.lastSavedContent).toBe('edited content')
  })

  it('untitled slots bypass the disk check and go through tempSave', async () => {
    const slot = createSlot({ filePath: null, filename: 'Untitled 1.md' })
    const { performAutoSave } = createComposable(slot)

    mockTempSave.mockResolvedValue('/temp/Untitled 1.md')

    const result = await performAutoSave(slot)

    expect(result).toBe(true)
    expect(mockFileRead).not.toHaveBeenCalled()
    expect(mockTempSave).toHaveBeenCalledWith('Untitled 1.md', 'edited content')
    expect(slot.lastSavedContent).toBe('edited content')
  })
})
