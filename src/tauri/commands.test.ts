import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fileRead,
  fileReadBinary,
  fileWrite,
  openFileDialog,
  saveFileDialog,
  tempSave,
  listTempFiles,
  deleteTempFile,
  updateWindowTitle,
  drainPendingFiles,
  consumePendingFile,
} from './commands'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
const mockedInvoke = invoke as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockedInvoke.mockReset()
})

describe('fileRead', () => {
  it('calls invoke with correct command and path', async () => {
    mockedInvoke.mockResolvedValue('file content')
    const result = await fileRead('/path/to/file.md')
    expect(mockedInvoke).toHaveBeenCalledWith('file_read', { path: '/path/to/file.md' })
    expect(result).toBe('file content')
  })

  it('propagates errors from invoke', async () => {
    mockedInvoke.mockRejectedValue(new Error('File not found'))
    await expect(fileRead('/missing.md')).rejects.toThrow('File not found')
  })
})

describe('fileReadBinary', () => {
  it('calls invoke with correct command and path, returns base64', async () => {
    mockedInvoke.mockResolvedValue('aGVsbG8=')
    const result = await fileReadBinary('/path/to/image.png')
    expect(mockedInvoke).toHaveBeenCalledWith('file_read_binary', { path: '/path/to/image.png' })
    expect(result).toBe('aGVsbG8=')
  })

  it('propagates errors from invoke', async () => {
    mockedInvoke.mockRejectedValue(new Error('File not found'))
    await expect(fileReadBinary('/missing.png')).rejects.toThrow('File not found')
  })
})

describe('fileWrite', () => {
  it('calls invoke with path and content', async () => {
    mockedInvoke.mockResolvedValue(undefined)
    await fileWrite('/path/to/file.md', '# Hello')
    expect(mockedInvoke).toHaveBeenCalledWith('file_write', { path: '/path/to/file.md', content: '# Hello' })
  })
})

describe('openFileDialog', () => {
  it('returns array of FileDialogResult', async () => {
    const files = [{ path: '/a.md', content: '# A' }]
    mockedInvoke.mockResolvedValue(files)
    const result = await openFileDialog()
    expect(mockedInvoke).toHaveBeenCalledWith('file_open_dialog')
    expect(result).toEqual(files)
  })

  it('returns empty array when cancelled', async () => {
    mockedInvoke.mockResolvedValue([])
    const result = await openFileDialog()
    expect(result).toEqual([])
  })
})

describe('saveFileDialog', () => {
  it('calls invoke with defaultName', async () => {
    mockedInvoke.mockResolvedValue('/saved.md')
    const result = await saveFileDialog('untitled.md')
    expect(mockedInvoke).toHaveBeenCalledWith('file_save_dialog', { defaultName: 'untitled.md' })
    expect(result).toBe('/saved.md')
  })

  it('returns null when cancelled', async () => {
    mockedInvoke.mockResolvedValue(null)
    const result = await saveFileDialog()
    expect(result).toBeNull()
  })
})

describe('tempSave', () => {
  it('calls invoke with filename and content', async () => {
    mockedInvoke.mockResolvedValue('/temp/autosave.md')
    const result = await tempSave('autosave.md', 'content')
    expect(mockedInvoke).toHaveBeenCalledWith('temp_save', { filename: 'autosave.md', content: 'content' })
    expect(result).toBe('/temp/autosave.md')
  })
})

describe('listTempFiles', () => {
  it('returns temp file list', async () => {
    const files = [{ path: '/temp/a.md', filename: 'a.md', modified: 12345 }]
    mockedInvoke.mockResolvedValue(files)
    const result = await listTempFiles()
    expect(mockedInvoke).toHaveBeenCalledWith('list_temp_files')
    expect(result).toEqual(files)
  })
})

describe('deleteTempFile', () => {
  it('calls invoke with path', async () => {
    mockedInvoke.mockResolvedValue(undefined)
    await deleteTempFile('/temp/a.md')
    expect(mockedInvoke).toHaveBeenCalledWith('delete_temp_file', { path: '/temp/a.md' })
  })
})

describe('updateWindowTitle', () => {
  it('calls invoke with title', async () => {
    mockedInvoke.mockResolvedValue(undefined)
    await updateWindowTitle('My Document')
    expect(mockedInvoke).toHaveBeenCalledWith('update_window_title', { title: 'My Document' })
  })
})

describe('drainPendingFiles', () => {
  it('calls invoke and returns pending paths', async () => {
    mockedInvoke.mockResolvedValue(['/a.md', '/b.md'])
    const result = await drainPendingFiles()
    expect(mockedInvoke).toHaveBeenCalledWith('drain_pending_files')
    expect(result).toEqual(['/a.md', '/b.md'])
  })
})

describe('consumePendingFile', () => {
  it('calls invoke with the consumed path', async () => {
    mockedInvoke.mockResolvedValue(undefined)
    await consumePendingFile('/a.md')
    expect(mockedInvoke).toHaveBeenCalledWith('consume_pending_file', { path: '/a.md' })
  })
})
