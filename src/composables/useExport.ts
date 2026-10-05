import { ref } from 'vue'
import type { ComputedRef } from 'vue'
import { exportPDF, exportDOCX, exportJPEG } from '../export'
import { arrayBufferToBase64 } from '../export/utils'
import { saveFileDialogWithFilter, fileWriteBinary, updateWindowTitle } from '../tauri/commands'
import type { FileSlot } from '../types'
import type { ToastFn } from './useQuickOpen'

interface UseExportOptions {
  activeFile: ComputedRef<FileSlot | null>
  activeFilename: ComputedRef<string>
  showToast: ToastFn
}

export function useExport(options: UseExportOptions) {
  const { activeFile, activeFilename, showToast } = options

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
        // ponytail: temporary diagnosis channel — packaged webview console is
        // unreachable (devtools stripped in release); remove after root cause
        updateWindowTitle(`DBG ${imageStats.embedded}e/${imageStats.skipped}s ${imageStats.firstSkipReason.slice(0, 100)}`)
      }
    } catch (e) {
      showToast(`DOCX export failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function doExportJPEG() {
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
