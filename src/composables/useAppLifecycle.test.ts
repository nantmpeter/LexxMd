import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

vi.mock('../tauri/commands', () => ({
  listTempFiles: vi.fn(),
  deleteTempFile: vi.fn(),
  fileRead: vi.fn(),
  openFileInNewWindow: vi.fn(),
}))

vi.mock('../editor/extensions/lexx-image', () => ({
  convertLocalImagesInEditor: vi.fn(),
}))

import { fileRead } from '../tauri/commands'
import { convertLocalImagesInEditor } from '../editor/extensions/lexx-image'
import { useAppLifecycle } from './useAppLifecycle'
import type { FileSlot } from '../types'

const mockedFileRead = vi.mocked(fileRead)
const mockedConvert = vi.mocked(convertLocalImagesInEditor)

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

function makeEditor() {
  return {
    commands: {
      setContent: vi.fn(),
    },
  }
}

function setup(openFiles: FileSlot[]) {
  return useAppLifecycle({
    openFiles: ref(openFiles),
    workspaceRoot: ref(null),
    showToast: vi.fn(),
    performAutoSave: vi.fn(),
    clearAllAutoSaveTimers: vi.fn(),
    confirmDiscardChanges: vi.fn(),
    createFileSlot: () => makeSlot({}),
    switchToFile: vi.fn(),
  })
}

describe('checkExternalChanges auto-reload', () => {
  beforeEach(() => {
    mockedFileRead.mockReset()
    mockedConvert.mockReset()
    mockedConvert.mockResolvedValue(undefined)
  })

  it('reloads a clean saved file whose disk content changed, and re-baselines it', async () => {
    const editor = makeEditor()
    const slot = makeSlot({
      filePath: '/docs/a.md',
      filename: 'a.md',
      lastSavedContent: 'old content',
      editor: editor as unknown as FileSlot['editor'],
    })
    const { checkExternalChanges } = setup([slot])
    mockedFileRead.mockResolvedValue('external content')

    await checkExternalChanges()

    // emitUpdate=false: the reloaded doc mirrors disk, so it must not go
    // through the dirty/autosave path.
    expect(editor.commands.setContent).toHaveBeenCalledWith('external content', false)
    // Image conversion contract: same call shape as an initial open.
    expect(mockedConvert).toHaveBeenCalledWith(editor, '/docs/a.md')
    expect(slot.lastSavedContent).toBe('external content')
    expect(slot.dirty).toBe(false)
    expect(slot.externalChangeNotified).toBeUndefined()
  })

  it('toasts the reload with the file name', async () => {
    const showToast = vi.fn()
    const slot = makeSlot({
      id: 's',
      filePath: '/docs/note.md',
      filename: 'note.md',
      lastSavedContent: 'old',
      editor: makeEditor() as unknown as FileSlot['editor'],
    })
    const lifecycle = useAppLifecycle({
      openFiles: ref([slot]),
      workspaceRoot: ref(null),
      showToast,
      performAutoSave: vi.fn(),
      clearAllAutoSaveTimers: vi.fn(),
      confirmDiscardChanges: vi.fn(),
      createFileSlot: () => makeSlot({}),
      switchToFile: vi.fn(),
    })
    mockedFileRead.mockResolvedValue('new')

    await lifecycle.checkExternalChanges()

    expect(showToast).toHaveBeenCalledWith('Reloaded note.md (changed outside Lexx)')
  })

  it('never touches a dirty slot (user edits outrank the disk version)', async () => {
    const editor = makeEditor()
    const slot = makeSlot({
      filePath: '/docs/dirty.md',
      dirty: true,
      lastSavedContent: 'old content',
      editor: editor as unknown as FileSlot['editor'],
    })
    const { checkExternalChanges } = setup([slot])
    mockedFileRead.mockResolvedValue('external content')

    await checkExternalChanges()

    expect(editor.commands.setContent).not.toHaveBeenCalled()
    expect(mockedConvert).not.toHaveBeenCalled()
    expect(slot.lastSavedContent).toBe('old content')
  })

  it('does nothing when the disk content still matches the baseline', async () => {
    const editor = makeEditor()
    const slot = makeSlot({
      filePath: '/docs/same.md',
      lastSavedContent: 'same',
      editor: editor as unknown as FileSlot['editor'],
    })
    const { checkExternalChanges } = setup([slot])
    mockedFileRead.mockResolvedValue('same')

    await checkExternalChanges()

    expect(editor.commands.setContent).not.toHaveBeenCalled()
    expect(mockedConvert).not.toHaveBeenCalled()
  })

  it('reloads again on a second external change (no sticky notify flag)', async () => {
    const editor = makeEditor()
    const slot = makeSlot({
      filePath: '/docs/a.md',
      lastSavedContent: 'v1',
      editor: editor as unknown as FileSlot['editor'],
    })
    const { checkExternalChanges } = setup([slot])

    mockedFileRead.mockResolvedValue('v2')
    await checkExternalChanges()
    mockedFileRead.mockResolvedValue('v3')
    await checkExternalChanges()

    expect(editor.commands.setContent).toHaveBeenCalledTimes(2)
    expect(slot.lastSavedContent).toBe('v3')
  })

  it('skips slots without an editor instead of crashing', async () => {
    const slot = makeSlot({
      filePath: '/docs/noeditor.md',
      lastSavedContent: 'old',
      editor: null,
    })
    const { checkExternalChanges } = setup([slot])
    mockedFileRead.mockResolvedValue('external content')

    await expect(checkExternalChanges()).resolves.toBeUndefined()
    expect(mockedConvert).not.toHaveBeenCalled()
    expect(slot.lastSavedContent).toBe('old')
  })

  it('ignores unreadable files (deleted/moved) and leaves the slot alone', async () => {
    const editor = makeEditor()
    const slot = makeSlot({
      filePath: '/docs/gone.md',
      lastSavedContent: 'old',
      editor: editor as unknown as FileSlot['editor'],
    })
    const { checkExternalChanges } = setup([slot])
    mockedFileRead.mockRejectedValue(new Error('missing'))

    await expect(checkExternalChanges()).resolves.toBeUndefined()
    expect(editor.commands.setContent).not.toHaveBeenCalled()
    expect(slot.lastSavedContent).toBe('old')
  })
})
