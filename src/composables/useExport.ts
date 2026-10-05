import { ref } from 'vue'
import type { ComputedRef } from 'vue'
import { exportPDF, exportDOCX, exportJPEG } from '../export'
import { arrayBufferToBase64 } from '../export/utils'
import { saveFileDialogWithFilter, fileWriteBinary } from '../tauri/commands'
import type { FileSlot } from '../types'
import type { ToastFn } from './useQuickOpen'
import type { SyncSourceToSlot } from './useSourceMode'

interface UseExportOptions {
  activeFile: ComputedRef<FileSlot | null>
  activeFilename: ComputedRef<string>
  showToast: ToastFn
  /** Whether source (CodeMirror) mode is active: exports must sync first. */
  sourceMode: () => boolean
  /** Pushes the CodeMirror buffer into the slot's PM editor (no-op outside source mode). */
  syncSourceToSlot: SyncSourceToSlot
}

export function useExport(options: UseExportOptions) {
  const { activeFile, activeFilename, showToast, sourceMode, syncSourceToSlot } = options

  /**
   * Source mode: the CodeMirror buffer is the live copy of the document while
   * the hidden Tiptap doc lags behind (by up to the autosave interval, or by
   * every unsaved edit with autosave off). Exports and print serialize the
   * Tiptap pane, so push the buffer in first — the same internal sync
   * handleSave uses (convertImages: true so exported images resolve).
   */
  function syncSourceBuffer() {
    if (sourceMode()) syncSourceToSlot(activeFile.value, { convertImages: true })
  }

  /**
   * True while any export is running. App.vue renders a full-screen blocking
   * overlay from it (exports have no internal progress callback, so there is
   * deliberately no percentage — just a spinner).
   */
  const exporting = ref(false)

  /** Serialize exports: the overlay blocks clicks, this is the JS-side backstop. */
  async function runExclusive(task: () => Promise<void>) {
    if (exporting.value) return
    exporting.value = true
    try {
      await task()
    } finally {
      exporting.value = false
    }
  }

  async function doExportPDF() {
    syncSourceBuffer()
    const slot = activeFile.value
    if (!slot?.element) return
    try {
      const blob = await exportPDF(slot.element, activeFilename.value)
      const baseName = activeFilename.value.replace(/\.[^.]+$/, '')
      const chosenPath = await saveFileDialogWithFilter(
        `${baseName}.pdf`,
        [{ name: 'PDF Document', extensions: ['pdf'] }]
      )
      if (chosenPath) {
        const buffer = await blob.arrayBuffer()
        const base64 = arrayBufferToBase64(buffer)
        await fileWriteBinary(chosenPath, base64)
        showToast('Exported as PDF', 'success')
      }
    } catch (e) {
      showToast(`PDF export failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function doExportDOCX() {
    syncSourceBuffer()
    const slot = activeFile.value
    if (!slot?.element) return
    try {
      const { blob, imageStats } = await exportDOCX(slot.element)
      const baseName = activeFilename.value.replace(/\.[^.]+$/, '')
      const chosenPath = await saveFileDialogWithFilter(
        `${baseName}.docx`,
        [{ name: 'Word Document', extensions: ['docx'] }]
      )
      if (chosenPath) {
        const buffer = await blob.arrayBuffer()
        const base64 = arrayBufferToBase64(buffer)
        await fileWriteBinary(chosenPath, base64)
        const stats = imageStats.skipped > 0
          ? ` — images: ${imageStats.embedded} embedded, ${imageStats.skipped} skipped (${imageStats.firstSkipReason})`
          : imageStats.embedded > 0
            ? ` — images: ${imageStats.embedded} embedded`
            : ''
        showToast(`Exported as DOCX${stats}`, imageStats.skipped > 0 ? 'error' : 'success')
      }
    } catch (e) {
      showToast(`DOCX export failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function doExportJPEG() {
    syncSourceBuffer()
    const slot = activeFile.value
    if (!slot?.element) return
    try {
      const blob = await exportJPEG(slot.element)
      const baseName = activeFilename.value.replace(/\.[^.]+$/, '')
      const chosenPath = await saveFileDialogWithFilter(
        `${baseName}.jpg`,
        [{ name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }]
      )
      if (chosenPath) {
        const buffer = await blob.arrayBuffer()
        const base64 = arrayBufferToBase64(buffer)
        await fileWriteBinary(chosenPath, base64)
        showToast('Exported as JPEG', 'success')
      }
    } catch (e) {
      showToast(`JPEG export failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return {
    exporting,
    handleExportPDF: () => runExclusive(doExportPDF),
    handleExportDOCX: () => runExclusive(doExportDOCX),
    handleExportJPEG: () => runExclusive(doExportJPEG),
  }
}
