import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { updateWindowTitle, directoryOpenDialog, openFolderInNewWindow } from '../tauri/commands'
import type { FileSlot, SidebarMode } from '../types'
import type { ToastFn } from './useQuickOpen'

interface UseWorkspaceOptions {
  openFiles: Ref<FileSlot[]>
  showToast: ToastFn
}

export function useWorkspace(options: UseWorkspaceOptions) {
  const { openFiles, showToast } = options

  const workspaceRoot = ref<string | null>(null)

  const effectiveSidebarMode = computed<SidebarMode>(() => {
    if (workspaceRoot.value) return 'tree'
    if (openFiles.value.length > 1) return 'flat'
    return 'hidden'
  })

  async function handleOpenFolder() {
    try {
      // If in flat mode (multiple files), open folder in a new window
      if (effectiveSidebarMode.value === 'flat') {
        const dirPath = await directoryOpenDialog()
        if (dirPath) {
          await openFolderInNewWindow(dirPath)
        }
        return
      }

      const dirPath = await directoryOpenDialog()
      if (dirPath) {
        workspaceRoot.value = dirPath
        const parts = dirPath.split(/[/\\]/)
        const folderName = parts[parts.length - 1] || 'Lexx'
        updateWindowTitle(folderName).catch(() => {})
      }
    } catch (e) {
      showToast(`Open folder failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return {
    workspaceRoot,
    effectiveSidebarMode,
    handleOpenFolder,
  }
}
