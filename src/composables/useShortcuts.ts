import { onMounted, onBeforeUnmount } from 'vue'
import { toggleFullscreen } from '../tauri/commands'

interface ShortcutActions {
  handleNew: () => void
  handleOpen: () => void
  handleOpenFolder: () => void
  openQuickOpen: () => void
  handleSave: () => void
  handleSaveAs: () => void
  openSearch: () => void
  handleClose: () => void
  toggleSourceMode: () => void
  handleExportPDF: () => void
  handleExportDOCX: () => void
  handleExportJPEG: () => void
  handleCycleNext: () => void
  handleCyclePrev: () => void
  handlePrint: () => void
  openPreferences: () => void
  isSourceMode: () => boolean
  /** True while QuickOpen / Settings / FindBar is open: they own Escape. */
  isAnyOverlayOpen?: () => boolean
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
    sa: actions.handleSaveAs,
    ef: actions.openSearch,
    fc: actions.handleClose,
    vs: actions.toggleSourceMode,
    ep: actions.handleExportPDF,
    ed: actions.handleExportDOCX,
    ej: actions.handleExportJPEG,
    pr: actions.handlePrint,
    prefs: actions.openPreferences,
  }

  function onMenuBarEvent(id: string) {
    if (id === 'vf') {
      toggleFullscreen().catch(() => {})
      return
    }
    menuHandlers[id]?.()
  }

  async function registerMenuEventListener(): Promise<void> {
    // Scoped to THIS window on purpose: the backend emits 'menu-event' only
    // to the focused window, and delivery targeting requires the listener to
    // register the window as its event target. The bare listen() helper from
    // '@tauri-apps/api/event' registers EventTarget::Any (global sniffer) and
    // would fire the menu action in every open window.
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    unlistenMenu = await getCurrentWebviewWindow().listen<string>('menu-event', (event) => {
      menuHandlers[event.payload]?.()
    })
  }

  // Keyboard shortcuts + tab cycling, merged into one dispatcher (previously
  // two window listeners with the accelerator branch first).
  function onKeydown(e: KeyboardEvent) {
    // IME composition in progress: every keystroke is part of the composing
    // text (keyCode 229 is the synthetic code browsers report for keys
    // handled by the IME). Acting on them would fire shortcuts from pinyin
    // keystrokes or from Escape-to-dismiss-candidates (which bubbles up
    // from the editor even in source mode) and kill the composition.
    if (e.isComposing || e.keyCode === 229) return

    // ── Accelerators ─────────────────────────────────────────
    // (Menu accelerators may not forward to the frontend on all platforms,
    // so they are always registered.)
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'f') {
      if (actions.isSourceMode()) return
      e.preventDefault()
      actions.openSearch()
    }
    // Cmd+P (no Alt) stays Quick Open; Cmd+Alt+P is Print — without the
    // altKey guard on the Quick Open branch, the print accelerator would
    // trigger both handlers.
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); actions.openQuickOpen() }
    if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); actions.handlePrint() }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 's') { e.preventDefault(); actions.handleSave() }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') { e.preventDefault(); actions.handleSaveAs() }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'o') { e.preventDefault(); actions.handleOpen() }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'O') { e.preventDefault(); actions.handleOpenFolder() }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'n') { e.preventDefault(); actions.handleNew() }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'w') { e.preventDefault(); actions.handleClose() }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === ',') { e.preventDefault(); actions.openPreferences() }
    if (e.key === 'Escape') {
      // Layered Escape: an open overlay (QuickOpen / Settings / FindBar)
      // closes itself on Escape; the window-level handler must not also exit
      // source mode on the same keystroke (double trigger). Overlays can be
      // open in source mode legally (Cmd+P / Cmd+, are not guarded there).
      if (actions.isAnyOverlayOpen?.()) return
      if (actions.isSourceMode()) { e.preventDefault(); actions.toggleSourceMode() }
    }

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
