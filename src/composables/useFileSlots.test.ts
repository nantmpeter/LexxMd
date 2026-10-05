import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, computed } from 'vue'
import type { FileSlot } from '../types'
import type { createSourceEditor } from '../editor/source-editor'
import { useFileSlots } from './useFileSlots'

vi.mock('../tauri/commands', () => ({
  fileWrite: vi.fn(),
  saveFileDialog: vi.fn(),
  saveFileDialogWithFilter: vi.fn(),
  fileRead: vi.fn(),
  openFileDialog: vi.fn(),
  deleteTempFile: vi.fn(),
}))

vi.mock('../editor/index', () => ({
  createEditor: vi.fn(() => ({
    commands: {},
    on: vi.fn(),
    destroy: vi.fn(),
  })),
}))

vi.mock('../editor/extensions/lexx-image', () => ({
  convertLocalImagesInEditor: vi.fn(),
}))

function setup() {
  const openFiles = ref<FileSlot[]>([])
  const activeFileId = ref('')
  const activeFile = computed(() => openFiles.value.find(f => f.id === activeFileId.value) ?? null)
  const activeIndex = computed(() => openFiles.value.findIndex(f => f.id === activeFileId.value))
  const sourceMode = ref(false)
  // Only setContent is exercised by switchToFile; the rest of the shape is
  // filled in via the cast below.
  const sourceEditor = { setContent: vi.fn(), getContent: vi.fn(() => '') }
  const getSourceEditor = () => sourceEditor as unknown as ReturnType<typeof createSourceEditor>

  let api!: ReturnType<typeof useFileSlots>
  const Host = defineComponent({
    setup() {
      api = useFileSlots({
        openFiles, activeFileId, activeFile, activeIndex,
        // Distinguishes the mounted-editor path (serialization) from the
        // lastSavedContent fallback: returns null when there is no editor.
        getMarkdownContent: (slot) => slot.editor ? `serialized(${slot.lastSavedContent})` : null,
        showToast: vi.fn(),
        bumpDocVersion: vi.fn(),
        onActiveSlotDocumentChanged: vi.fn(),
        scheduleAutoSave: vi.fn(),
        clearAutoSaveTimer: vi.fn(),
        sourceMode,
        getSourceEditor,
        syncSourceToSlot: vi.fn(),
      })
      return () => h('div')
    },
  })
  mount(Host)

  return { api, openFiles, sourceMode, sourceEditor }
}

describe('useFileSlots switchToFile in source mode', () => {
  it('loads a freshly created slot from lastSavedContent while its editor is not mounted yet', () => {
    const { api, openFiles, sourceMode, sourceEditor } = setup()
    sourceMode.value = true

    // handleNew / openFileFromTree flow: createFileSlot + switchToFile run
    // back-to-back, so the slot has no editor until the next render.
    const slot = api.createFileSlot('# fresh file')
    api.switchToFile(slot.id)

    expect(sourceEditor.setContent).toHaveBeenCalledWith('# fresh file')
    // Guard the premise of the fix: the editor really is still unmounted here.
    expect(openFiles.value.find(f => f.id === slot.id)?.editor).toBeNull()
  })

  it('keeps using the serialized editor content once the slot editor is mounted', () => {
    const { api, sourceMode, sourceEditor } = setup()
    sourceMode.value = true

    const slot = api.createFileSlot('# original')
    slot.editor = { commands: {} } as unknown as FileSlot['editor']
    api.switchToFile(slot.id)

    expect(sourceEditor.setContent).toHaveBeenCalledWith('serialized(# original)')
  })
})
