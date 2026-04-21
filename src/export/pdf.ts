import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { cloneEditorContent } from './utils'

/**
 * Export the editor content as a PDF file.
 * Uses html2canvas to render the DOM, then jsPDF to create a PDF.
 * Opens a save dialog to choose the destination.
 */
export async function exportPDF(
  editorEl: HTMLElement,
  filename: string
): Promise<Blob> {
  const clone = cloneEditorContent(editorEl)

  clone.style.width = '800px'
  clone.style.padding = '40px 60px'
  clone.style.background = '#ffffff'
  clone.style.position = 'fixed'
  clone.style.left = '-9999px'
  clone.style.top = '0'
  clone.style.zIndex = '-1'
  document.body.appendChild(clone)

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    const imgWidth = 210 // A4 width in mm
    const pageHeight = 297 // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    const pdf = new jsPDF('p', 'mm', 'a4')
    let position = 0
    let remaining = imgHeight

    // First page
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.95),
      'JPEG',
      0,
      position,
      imgWidth,
      imgHeight
    )
    remaining -= pageHeight

    // Additional pages if content overflows
    while (remaining > 0) {
      position -= pageHeight
      pdf.addPage()
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.95),
        'JPEG',
        0,
        position,
        imgWidth,
        imgHeight
      )
      remaining -= pageHeight
    }

    return pdf.output('blob')
  } finally {
    document.body.removeChild(clone)
  }
}
