import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, ref } from 'vue'
import { exportPDF, exportDOCX, exportJPEG } from '../export'
import type { FileSlot } from '../types'
import { useExport } from './useExport'

vi.mock('../export', () => ({
  exportPDF: vi.fn(async () => new Blob()),
  exportDOCX: vi.fn(async () => ({ blob: new Blob(), imageStats: { embedded: 0, skipped: 0, firstSkipReason: '' } })),
  exportJPEG: vi.fn(async () => new Blob()),
}))

vi.mock('../export/utils', () => ({
  arrayBufferToBase64: vi.fn(() => ''),
}))

vi.mock('../tauri/commands', () => ({
  saveFileDialogWithFilter: vi.fn(async () => null),
  fileWriteBinary: vi.fn(),
}))

function setup({ sourceMode }: { sourceMode: boolean }) {
  const element = document.createElement('div')
  element.innerHTML = '<p>stale dom</p>'
  const slot: FileSlot = {
    id: 'slot-1',
    filePath: null,
    filename: 'doc.md',
    dirty: false,
    editor: {},
    element,
    lastSavedContent: 'stale dom',
    tempPath: null,
  }
  const sourceModeRef = ref(sourceMode)
  // Stand-in for the live CM buffer: the real sync pushes this content into
  // the slot's PM editor / DOM.
  const cmBuffer = ref('edited in source mode')
  const syncSourceToSlot = vi.fn((target: Parameters<Parameters<typeof useExport>[0]['syncSourceToSlot']>[0]) => {
    if (target?.element) target.element.innerHTML = `<p>${cmBuffer.value}</p>`
  })

  const api = useExport({
    activeFile: computed(() => slot),
    activeFilename: computed(() => 'doc.md'),
    showToast: vi.fn(),
    sourceMode: () => sourceModeRef.value,
    syncSourceToSlot,
  })

  return { api, element, syncSourceToSlot, sourceModeRef, cmBuffer }
}

describe('useExport source-mode sync', () => {
  beforeEach(() => {
    vi.mocked(exportPDF).mockClear()
    vi.mocked(exportDOCX).mockClear()
    vi.mocked(exportJPEG).mockClear()
  })

  it('pushes the source buffer into the document before exporting PDF', async () => {
    const { api, element, syncSourceToSlot } = setup({ sourceMode: true })

    await api.handleExportPDF()

    expect(syncSourceToSlot).toHaveBeenCalledTimes(1)
    expect(exportPDF).toHaveBeenCalledTimes(1)
    // The exported element must contain the CM edit, not the stale DOM.
    expect(exportPDF).toHaveBeenCalledWith(element, 'doc.md')
    expect(element.innerHTML).toContain('edited in source mode')
  })

  it('pushes the source buffer before exporting DOCX', async () => {
    const { api, element } = setup({ sourceMode: true })

    await api.handleExportDOCX()

    expect(exportDOCX).toHaveBeenCalledWith(element)
    expect(element.innerHTML).toContain('edited in source mode')
  })

  it('pushes the source buffer before exporting JPEG', async () => {
    const { api, element } = setup({ sourceMode: true })

    await api.handleExportJPEG()

    expect(exportJPEG).toHaveBeenCalledWith(element)
    expect(element.innerHTML).toContain('edited in source mode')
  })

  it('does not sync when source mode is off', async () => {
    const { api, element, syncSourceToSlot } = setup({ sourceMode: false })

    await api.handleExportPDF()

    expect(syncSourceToSlot).not.toHaveBeenCalled()
    expect(element.innerHTML).toContain('stale dom')
  })
})
