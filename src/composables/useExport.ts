import type { ComputedRef } from 'vue'
import { exportPDF, exportDOCX, exportJPEG } from '../export'
import { arrayBufferToBase64 } from '../export/utils'
import { saveFileDialogWithFilter, fileWriteBinary } from '../tauri/commands'
import type { FileSlot } from '../types'
import type { ToastFn } from './useQuickOpen'

interface UseExportOptions {
  activeFile: ComputedRef<FileSlot | null>
  activeFilename: ComputedRef<string>
  showToast: ToastFn
}

export function useExport(options: UseExportOptions) {
  const { activeFile, activeFilename, showToast } = options

  async function handleExportPDF() {
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

  async function handleExportDOCX() {
    const slot = activeFile.value
    if (!slot?.element) return
    try {
      const blob = await exportDOCX(slot.element)
      const baseName = activeFilename.value.replace(/\.[^.]+$/, '')
      const chosenPath = await saveFileDialogWithFilter(
        `${baseName}.docx`,
        [{ name: 'Word Document', extensions: ['docx'] }]
      )
      if (chosenPath) {
        const buffer = await blob.arrayBuffer()
        const base64 = arrayBufferToBase64(buffer)
        await fileWriteBinary(chosenPath, base64)
        showToast('Exported as DOCX', 'success')
      }
    } catch (e) {
      showToast(`DOCX export failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleExportJPEG() {
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
    handleExportPDF,
    handleExportDOCX,
    handleExportJPEG,
  }
}
