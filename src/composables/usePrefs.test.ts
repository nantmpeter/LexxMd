import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readAppDataJson, writeAppDataJson } from '../tauri/appData'
import { DEFAULT_PREFS, parsePrefs, usePrefs } from './usePrefs'

vi.mock('../tauri/appData', () => ({
  readAppDataJson: vi.fn(),
  writeAppDataJson: vi.fn(),
}))

const mockedReadAppData = vi.mocked(readAppDataJson)
const mockedWriteAppData = vi.mocked(writeAppDataJson)

describe('parsePrefs', () => {
  it('returns the defaults for null / empty / garbage input', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('')).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('not json')).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('42')).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('[]')).toEqual(DEFAULT_PREFS)
  })

  it('fills every missing field with its default', () => {
    expect(parsePrefs('{}')).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('{"theme":"dark"}')).toEqual({
      theme: 'dark',
      autosaveEnabled: DEFAULT_PREFS.autosaveEnabled,
      autosaveDelayMs: DEFAULT_PREFS.autosaveDelayMs,
      editorWidth: DEFAULT_PREFS.editorWidth,
    })
  })

  it('accepts a fully valid document', () => {
    expect(
      parsePrefs('{"theme":"light","autosaveEnabled":false,"autosaveDelayMs":5000,"editorWidth":1000}'),
    ).toEqual({ theme: 'light', autosaveEnabled: false, autosaveDelayMs: 5000, editorWidth: 1000 })
  })

  it('rejects an unknown theme and keeps the stored system default', () => {
    expect(parsePrefs('{"theme":"sepia"}').theme).toBe('system')
    expect(parsePrefs('{"theme":null}').theme).toBe('system')
  })

  it('clamps autosaveDelayMs into 1000–10000 and rounds fractions', () => {
    expect(parsePrefs('{"autosaveDelayMs":50}').autosaveDelayMs).toBe(1000)
    expect(parsePrefs('{"autosaveDelayMs":99999}').autosaveDelayMs).toBe(10000)
    expect(parsePrefs('{"autosaveDelayMs":2500.6}').autosaveDelayMs).toBe(2501)
    expect(parsePrefs('{"autosaveDelayMs":"fast"}').autosaveDelayMs).toBe(DEFAULT_PREFS.autosaveDelayMs)
  })

  it('clamps editorWidth into 600–1200', () => {
    expect(parsePrefs('{"editorWidth":100}').editorWidth).toBe(600)
    expect(parsePrefs('{"editorWidth":5000}').editorWidth).toBe(1200)
    expect(parsePrefs('{"editorWidth":733.4}').editorWidth).toBe(733)
    expect(parsePrefs('{"editorWidth":false}').editorWidth).toBe(DEFAULT_PREFS.editorWidth)
  })
})

describe('usePrefs', () => {
  beforeEach(() => {
    mockedReadAppData.mockReset()
    mockedWriteAppData.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.documentElement.removeAttribute('data-theme')
  })

  it('applies the theme to <html data-theme> immediately and on change', () => {
    const { prefs, savePrefs } = usePrefs()

    // Default theme applied at creation (before first paint of the host app).
    expect(document.documentElement.getAttribute('data-theme')).toBe('system')

    savePrefs({ ...prefs.value, theme: 'dark' })
    expect(prefs.value.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    savePrefs({ ...prefs.value, theme: 'light' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('loadPrefs reads prefs.json and merges over the defaults', async () => {
    mockedReadAppData.mockResolvedValue('{"theme":"dark","autosaveEnabled":false}')
    const { prefs, loadPrefs } = usePrefs()

    await loadPrefs()

    expect(prefs.value).toEqual({
      theme: 'dark',
      autosaveEnabled: false,
      autosaveDelayMs: DEFAULT_PREFS.autosaveDelayMs,
      editorWidth: DEFAULT_PREFS.editorWidth,
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('keeps defaults when prefs.json is missing or unreadable', async () => {
    mockedReadAppData.mockResolvedValue(null)
    const { prefs, loadPrefs } = usePrefs()
    await loadPrefs()
    expect(prefs.value).toEqual(DEFAULT_PREFS)

    mockedReadAppData.mockRejectedValue(new Error('boom'))
    await loadPrefs()
    expect(prefs.value).toEqual(DEFAULT_PREFS)
  })

  it('savePrefs persists the new value with a debounce', async () => {
    vi.useFakeTimers()
    mockedWriteAppData.mockResolvedValue(undefined)
    const { prefs, savePrefs } = usePrefs()

    savePrefs({ ...prefs.value, editorWidth: 1000 })
    expect(prefs.value.editorWidth).toBe(1000)
    expect(mockedWriteAppData).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(499)
    expect(mockedWriteAppData).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(mockedWriteAppData).toHaveBeenCalledTimes(1)
    expect(mockedWriteAppData).toHaveBeenCalledWith('prefs.json', {
      ...DEFAULT_PREFS,
      editorWidth: 1000,
    })
  })

  it('collapses rapid slider-style changes into one write of the latest value', async () => {
    vi.useFakeTimers()
    mockedWriteAppData.mockResolvedValue(undefined)
    const { prefs, savePrefs } = usePrefs()

    savePrefs({ ...prefs.value, editorWidth: 650 })
    savePrefs({ ...prefs.value, editorWidth: 700 })
    savePrefs({ ...prefs.value, editorWidth: 750 })
    await vi.advanceTimersByTimeAsync(500)

    expect(mockedWriteAppData).toHaveBeenCalledTimes(1)
    expect(mockedWriteAppData).toHaveBeenCalledWith('prefs.json', {
      ...DEFAULT_PREFS,
      editorWidth: 750,
    })
  })

  it('swallows a failed disk write: the change stays live in memory', async () => {
    vi.useFakeTimers()
    mockedWriteAppData.mockRejectedValue(new Error('disk full'))
    const { prefs, savePrefs } = usePrefs()

    savePrefs({ ...prefs.value, autosaveEnabled: false })
    await vi.advanceTimersByTimeAsync(500)

    expect(prefs.value.autosaveEnabled).toBe(false)
  })
})
