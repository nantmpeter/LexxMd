import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { markRaw, ref } from 'vue'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

vi.mock('../tauri/commands', () => ({
  listTempFiles: vi.fn(),
  deleteTempFile: vi.fn(),
  fileRead: vi.fn(),
  openFileInNewWindow: vi.fn(),
  consumePendingFile: vi.fn(),
}))

vi.mock('../editor/extensions/lexx-image', () => ({
  convertLocalImagesInEditor: vi.fn(),
}))

import { fileRead } from '../tauri/commands'
import { convertLocalImagesInEditor } from '../editor/extensions/lexx-image'
import { FixContentParsing } from '../editor/extensions/fix-content-parsing'
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

/**
 * Mock of the reload call path: checkExternalChanges pins addToHistory=false
 * on the shared chain transaction, then setContent(content, false) runs
 * inside the same chain. `metas` records every setMeta for assertions.
 */
function makeEditor() {
  const metas: Array<[string, unknown]> = []
  const editor = {
    metas,
    commands: {
      setContent: vi.fn(),
    },
    chain() {
      const tr = {
        setMeta: (key: string, value: unknown) => {
          metas.push([key, value])
        },
      }
      const api = {
        command: (cb: (props: { tr: typeof tr }) => boolean) => {
          cb({ tr })
          return api
        },
        setContent: (...args: unknown[]) => {
          editor.commands.setContent(...args)
          return api
        },
        run: () => true,
      }
      return api
    },
  }
  return editor
}

/** Real editor (same parse stack as preserve-blocks.test.ts) for undo assertions. */
function createRealEditor() {
  // Production markRaw's slot editors (useFileSlots); mirroring that keeps
  // the deep `ref(openFiles)` from handing checkExternalChanges a proxy.
  return markRaw(new Editor({
    extensions: [StarterKit, Markdown.configure({ html: true }), FixContentParsing],
  }))
}

function setup(openFiles: FileSlot[], isSlotInSourceMode: (slot: FileSlot) => boolean = () => false) {
  return useAppLifecycle({
    openFiles: ref(openFiles),
    workspaceRoot: ref(null),
    showToast: vi.fn(),
    performAutoSave: vi.fn(),
    clearAllAutoSaveTimers: vi.fn(),
    confirmDiscardChanges: vi.fn(),
    createFileSlot: () => makeSlot({}),
    switchToFile: vi.fn(),
    isSlotInSourceMode,
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
  })

  it('pins addToHistory=false onto the reload transaction (emitUpdate stays false)', async () => {
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

    // The reload rides the same transaction setContent dispatches (tiptap
    // chain): undo must skip it while preventUpdate still suppresses updates.
    expect(editor.metas).toContainEqual(['addToHistory', false])
    expect(editor.commands.setContent).toHaveBeenCalledWith('external content', false)
    expect(slot.lastSavedContent).toBe('external content')
  })

  it('keeps the external reload out of undo history (undo cannot resurrect stale content)', async () => {
    const editor = createRealEditor()
    editor.commands.setContent('old content', false)
    const slot = makeSlot({
      filePath: '/docs/a.md',
      filename: 'a.md',
      lastSavedContent: 'old content',
      editor: editor as unknown as FileSlot['editor'],
    })
    const { checkExternalChanges } = setup([slot])
    mockedFileRead.mockResolvedValue('external content')

    await checkExternalChanges()

    expect(slot.lastSavedContent).toBe('external content')
    expect(editor.state.doc.textContent).toBe('external content')
    // lastSavedContent was re-baselined to the disk text; an undo that
    // resurrected 'old content' would look like a user edit and the autosave
    // guard would silently write the stale document back over the disk file.
    // The initial load legitimately occupies a history entry (pre-existing
    // behavior), so drain whatever history exists and assert the pre-reload
    // document never comes back. Had the reload leaked into history, the
    // first undo step would restore 'old content' and fail inside the loop.
    let guard = 0
    while (editor.commands.undo() === true && guard++ < 10) {
      expect(editor.state.doc.textContent).not.toBe('old content')
    }
    expect(editor.commands.undo()).toBe(false)
    expect(editor.state.doc.textContent).not.toBe('old content')
    editor.destroy()
  })

  it('control: a real user edit after the reload is still undoable back to the disk content', async () => {
    vi.useFakeTimers()
    const editor = createRealEditor()
    editor.commands.setContent('old content', false)
    const slot = makeSlot({
      filePath: '/docs/a.md',
      filename: 'a.md',
      lastSavedContent: 'old content',
      editor: editor as unknown as FileSlot['editor'],
    })
    const { checkExternalChanges } = setup([slot])
    mockedFileRead.mockResolvedValue('external content')

    await checkExternalChanges()

    // Only the reload itself is excluded from history; subsequent user edits
    // must keep normal undo semantics. Advance past prosemirror-history's
    // newGroupDelay so the edit does not merge into the initial-load entry.
    vi.advanceTimersByTime(1000)
    editor.commands.insertContentAt(editor.state.doc.content.size, '!')
    expect(editor.state.doc.textContent).toBe('external content!')
    expect(editor.commands.undo()).toBe(true)
    expect(editor.state.doc.textContent).toBe('external content')
    vi.useRealTimers()
    editor.destroy()
  })

  it('does not re-baseline when the reload command fails', async () => {
    const metas: Array<[string, unknown]> = []
    const editor = {
      metas,
      commands: { setContent: vi.fn() },
      chain() {
        const tr = { setMeta: () => {} }
        const api = {
          command: () => api,
          setContent: () => api,
          run: () => false, // command chain failed (e.g. missing md parser)
        }
        return api
      },
    }
    const slot = makeSlot({
      filePath: '/docs/a.md',
      lastSavedContent: 'old content',
      editor: editor as unknown as FileSlot['editor'],
    })
    const { checkExternalChanges } = setup([slot])
    mockedFileRead.mockResolvedValue('external content')

    await checkExternalChanges()

    // Baseline must stay on the old text: re-baselining without a reload
    // would make autosave write the stale editor content over the disk file.
    expect(slot.lastSavedContent).toBe('old content')
    expect(mockedConvert).not.toHaveBeenCalled()
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
      isSlotInSourceMode: () => false,
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

  it('notifies instead of reloading a clean slot open in source mode (baseline untouched)', async () => {
    const editor = makeEditor()
    const showToast = vi.fn()
    const slot = makeSlot({
      filePath: '/docs/src.md',
      filename: 'src.md',
      lastSavedContent: 'old content',
      editor: editor as unknown as FileSlot['editor'],
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
      isSlotInSourceMode: () => true,
    })
    mockedFileRead.mockResolvedValue('external content')

    await lifecycle.checkExternalChanges()

    // No reload into the (stale) Tiptap doc and no re-baseline: leaving the
    // baseline alone keeps the autosave guard armed against the source pane
    // writing its pre-reload buffer back on exit, and the next focus after
    // leaving source mode reloads the file normally.
    expect(editor.commands.setContent).not.toHaveBeenCalled()
    expect(mockedConvert).not.toHaveBeenCalled()
    expect(slot.lastSavedContent).toBe('old content')
    expect(slot.dirty).toBe(false)
    expect(showToast).toHaveBeenCalledWith(
      'File changed outside Lexx — src.md will reload when you leave source mode'
    )
  })

  it('applies the source-mode predicate per slot, reloading only the others', async () => {
    const srcEditor = makeEditor()
    const plainEditor = makeEditor()
    const inSource = makeSlot({
      id: 'src-slot',
      filePath: '/docs/src.md',
      lastSavedContent: 'old',
      editor: srcEditor as unknown as FileSlot['editor'],
    })
    const regular = makeSlot({
      id: 'plain-slot',
      filePath: '/docs/plain.md',
      lastSavedContent: 'old',
      editor: plainEditor as unknown as FileSlot['editor'],
    })
    const { checkExternalChanges } = setup(
      [inSource, regular],
      (slot) => slot.id === 'src-slot'
    )
    mockedFileRead.mockImplementation(async (path: string) =>
      path === '/docs/src.md' ? 'new src' : 'new plain'
    )

    await checkExternalChanges()

    expect(srcEditor.commands.setContent).not.toHaveBeenCalled()
    expect(inSource.lastSavedContent).toBe('old')
    expect(plainEditor.commands.setContent).toHaveBeenCalledWith('new plain', false)
    expect(regular.lastSavedContent).toBe('new plain')
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
