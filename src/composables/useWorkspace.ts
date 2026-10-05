import { ref, computed, watch } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { updateWindowTitle, directoryOpenDialog, openFolderInNewWindow } from '../tauri/commands'
import type { FileSlot, SidebarMode } from '../types'
import type { ToastFn } from './useQuickOpen'

interface UseWorkspaceOptions {
  openFiles: Ref<FileSlot[]>
  /** Filename of the visible slot, for the native window title. */
  activeFilename: ComputedRef<string>
  showToast: ToastFn
}

export function useWorkspace(options: UseWorkspaceOptions) {
  const { openFiles, activeFilename, showToast } = options

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

  // Sync filename to native window title
  watch(activeFilename, (fn) => {
    updateWindowTitle(fn).catch(() => { /* not in Tauri */ })
  }, { immediate: true })

  return {
    workspaceRoot,
    effectiveSidebarMode,
    handleOpenFolder,
  }
}
