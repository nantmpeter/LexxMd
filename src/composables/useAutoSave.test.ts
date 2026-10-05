import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computed, ref } from 'vue'

vi.mock('../tauri/commands', () => ({
  fileRead: vi.fn(),
  fileWrite: vi.fn(),
  tempSave: vi.fn(),
}))

import { fileRead, fileWrite, tempSave } from '../tauri/commands'
import { useAutoSave } from './useAutoSave'
import { DEFAULT_PREFS } from './usePrefs'
import type { ToastFn } from './useQuickOpen'
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

function createComposable(slot: FileSlot, showToast: ToastFn = () => {}, prefsOverride = {}) {
  return useAutoSave({
    activeFile: computed(() => slot),
    getMarkdownContent: () => 'edited content',
    syncSourceToSlot: () => {},
    showToast,
    prefs: ref({ ...DEFAULT_PREFS, ...prefsOverride }),
  })
}

describe('useAutoSave external-change guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips the write and keeps dirty when the file changed on disk since the last save', async () => {
    const slot = createSlot()
    const showToast = vi.fn<ToastFn>()
    const { performAutoSave } = createComposable(slot, showToast)

    mockFileRead.mockResolvedValue('externally edited content')

    const result = await performAutoSave(slot)

    expect(result).toBe(false)
    expect(mockFileWrite).not.toHaveBeenCalled()
    // The toast must steer the user to Save As: "reopen" would drop the
    // user's own unsaved changes, so the copy is part of the contract.
    expect(showToast).toHaveBeenCalledWith('File changed outside Lexx — use Save As to keep both versions')
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

describe('useAutoSave prefs-driven scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not arm a timer when autosaveEnabled is false', async () => {
    const slot = createSlot()
    const { scheduleAutoSave } = createComposable(slot, () => {}, { autosaveEnabled: false })

    scheduleAutoSave(slot)
    await vi.advanceTimersByTimeAsync(60000)

    expect(mockFileWrite).not.toHaveBeenCalled()
    // Dirty state is preserved: only the timer is suppressed.
    expect(slot.dirty).toBe(true)
  })

  it('schedules with autosaveDelayMs instead of the old hardcoded delay', async () => {
    const slot = createSlot()
    const { scheduleAutoSave } = createComposable(slot, () => {}, { autosaveDelayMs: 10000 })

    scheduleAutoSave(slot)
    mockFileRead.mockResolvedValue('saved content')
    mockFileWrite.mockResolvedValue(undefined)

    await vi.advanceTimersByTimeAsync(9999)
    expect(mockFileWrite).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(mockFileWrite).toHaveBeenCalledWith('/docs/test.md', 'edited content')
  })

  it('reacts to a live prefs flip: re-enabling autosave arms the next timer', async () => {
    const slot = createSlot()
    const prefs = ref({ ...DEFAULT_PREFS, autosaveEnabled: false })
    const { scheduleAutoSave } = useAutoSave({
      activeFile: computed(() => slot),
      getMarkdownContent: () => 'edited content',
      syncSourceToSlot: () => {},
      showToast: () => {},
      prefs,
    })

    scheduleAutoSave(slot)
    await vi.advanceTimersByTimeAsync(10000)
    expect(mockFileWrite).not.toHaveBeenCalled()

    prefs.value = { ...prefs.value, autosaveEnabled: true }
    scheduleAutoSave(slot)
    mockFileRead.mockResolvedValue('saved content')
    mockFileWrite.mockResolvedValue(undefined)
    await vi.advanceTimersByTimeAsync(DEFAULT_PREFS.autosaveDelayMs)

    expect(mockFileWrite).toHaveBeenCalledWith('/docs/test.md', 'edited content')
  })

  it('clears already-armed timers the moment autosave is switched off', async () => {
    const slot = createSlot()
    const prefs = ref({ ...DEFAULT_PREFS, autosaveEnabled: true })
    const { scheduleAutoSave } = useAutoSave({
      activeFile: computed(() => slot),
      getMarkdownContent: () => 'edited content',
      syncSourceToSlot: () => {},
      showToast: () => {},
      prefs,
    })

    mockFileRead.mockResolvedValue('saved content')
    mockFileWrite.mockResolvedValue(undefined)

    // Arm a timer, then flip the pref off before it fires: the pending
    // autosave must be dropped immediately, not silently run afterwards.
    scheduleAutoSave(slot)
    prefs.value = { ...prefs.value, autosaveEnabled: false }
    await vi.advanceTimersByTimeAsync(DEFAULT_PREFS.autosaveDelayMs * 10)

    expect(mockFileWrite).not.toHaveBeenCalled()
    expect(slot.dirty).toBe(true)
  })
})
