import { onMounted, onBeforeUnmount } from 'vue'
import { toggleFullscreen } from '../tauri/commands'

interface ShortcutActions {
  handleNew: () => void
  handleOpen: () => void
  handleOpenFolder: () => void
  openQuickOpen: () => void
  handleSave: () => void
  openSearch: () => void
  handleClose: () => void
  toggleSourceMode: () => void
  handleExportPDF: () => void
  handleExportDOCX: () => void
  handleExportJPEG: () => void
  handleCycleNext: () => void
  handleCyclePrev: () => void
  isSourceMode: () => boolean
}

// Menu-event ids shared by the native menu (Tauri 'menu-event' listener) and
// the frontend MenuBar component (Windows). One map, two entry points.
export function useShortcuts(actions: ShortcutActions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let unlistenMenu: any = null

  const menuHandlers: Record<string, () => void> = {
    fn: actions.handleNew,
    fo: actions.handleOpen,
    ff: actions.handleOpenFolder,
    fq: actions.openQuickOpen,
    fs: actions.handleSave,
    ef: actions.openSearch,
    fc: actions.handleClose,
    vs: actions.toggleSourceMode,
    ep: actions.handleExportPDF,
    ed: actions.handleExportDOCX,
    ej: actions.handleExportJPEG,
  }

  function onMenuBarEvent(id: string) {
    if (id === 'vf') {
      toggleFullscreen().catch(() => {})
      return
    }
    menuHandlers[id]?.()
  }

  async function registerMenuEventListener(): Promise<void> {
    const { listen } = await import('@tauri-apps/api/event')
    unlistenMenu = await listen<string>('menu-event', (event) => {
      menuHandlers[event.payload]?.()
    })
  }

  // Keyboard shortcuts + tab cycling, merged into one dispatcher (previously
  // two window listeners with the accelerator branch first).
  function onKeydown(e: KeyboardEvent) {
    // ── Accelerators ─────────────────────────────────────────
    // (Menu accelerators may not forward to the frontend on all platforms,
    // so they are always registered.)
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'f') {
      if (actions.isSourceMode()) return
      e.preventDefault()
      actions.openSearch()
    }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'p') { e.preventDefault(); actions.openQuickOpen() }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 's') { e.preventDefault(); actions.handleSave() }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'o') { e.preventDefault(); actions.handleOpen() }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'O') { e.preventDefault(); actions.handleOpenFolder() }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'n') { e.preventDefault(); actions.handleNew() }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'w') { e.preventDefault(); actions.handleClose() }
    if (e.key === 'Escape' && actions.isSourceMode()) { e.preventDefault(); actions.toggleSourceMode() }

    // ── Tab cycling ──────────────────────────────────────────
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ']') {
      e.preventDefault()
      actions.handleCycleNext()
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '[') {
      e.preventDefault()
      actions.handleCyclePrev()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    if (unlistenMenu) unlistenMenu()
  })

  return {
    onMenuBarEvent,
    registerMenuEventListener,
  }
}
