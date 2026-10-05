import { fileRead, updateWindowTitle, openFileInNewWindow, drainPendingFiles } from '../tauri/commands'
import type { Ref } from 'vue'
import type { FileSlot } from '../types'

interface UseStartupFilesOptions {
  workspaceRoot: Ref<string | null>
  openFiles: Ref<FileSlot[]>
  createFileSlot: (content?: string, filename?: string | null, filePath?: string | null) => FileSlot
  switchToFile: (id: string) => void
  openFileFromTree: (path: string) => void | Promise<void>
}

/**
 * Opens the files this window was created for: the `workspace`/`file` query
 * params (new window from folder/file open), then any paths the OS opened
 * during app startup before the frontend was ready. Returns false from the
 * internal probe when nothing was opened so the caller can create a blank
 * Untitled document instead.
 */
export function useStartupFiles(options: UseStartupFilesOptions) {
  const { workspaceRoot, openFiles, createFileSlot, switchToFile, openFileFromTree } = options

  async function openStartupFiles(): Promise<void> {
    // Track whether any file was opened from startup params
    let openedFile = false

    // Check for workspace query param (new window from folder open)
    try {
      const params = new URLSearchParams(window.location.search)
      const ws = params.get('workspace')
      if (ws) {
        workspaceRoot.value = ws
        const parts = ws.split(/[/\\]/)
        const folderName = parts[parts.length - 1] || 'Lexx'
        updateWindowTitle(folderName).catch(() => {})
      }
      // Check for file query param (new window from file open)
      const fp = params.get('file')
      if (fp) {
        openedFile = true
        try {
          const content = await fileRead(fp)
          const parts = fp.split(/[/\\]/)
          const fn = parts[parts.length - 1] || 'Untitled.md'
          const initialSlot = createFileSlot(content, fn, fp)
          switchToFile(initialSlot.id)
        } catch {
          // file read failed
        }
      }
    } catch {
      // not in browser context
    }

    // Check for files opened during app startup (before frontend was ready)
    try {
      const pending = await drainPendingFiles()
      for (const path of pending) {
        openedFile = true
        if (workspaceRoot.value) {
          openFileInNewWindow(path).catch(() => {})
        } else {
          openFileFromTree(path)
        }
      }
    } catch {
      // not in Tauri
    }

    // Only create an empty Untitled.md if nothing else was opened
    if (!openedFile && openFiles.value.length === 0) {
      const initialSlot = createFileSlot()
      switchToFile(initialSlot.id)
    }
  }

  return { openStartupFiles }
}
