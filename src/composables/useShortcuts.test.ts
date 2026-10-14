import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useShortcuts } from './useShortcuts'

function createActions() {
  return {
    handleNew: vi.fn(),
    handleOpen: vi.fn(),
    handleOpenFolder: vi.fn(),
    openQuickOpen: vi.fn(),
    handleSave: vi.fn(),
    handleSaveAs: vi.fn(),
    openSearch: vi.fn(),
    handleClose: vi.fn(),
    toggleSourceMode: vi.fn(),
    handleExportPDF: vi.fn(),
    handleExportDOCX: vi.fn(),
    handleExportJPEG: vi.fn(),
    handleCycleNext: vi.fn(),
    handleCyclePrev: vi.fn(),
    handlePrint: vi.fn(),
    openPreferences: vi.fn(),
    isSourceMode: vi.fn(() => false),
    isAnyOverlayOpen: vi.fn(() => false),
  }
}

function mountShortcuts(actions: ReturnType<typeof createActions>) {
  const Host = defineComponent({
    setup() {
      useShortcuts(actions)
      return () => h('div')
    },
  })
  return mount(Host)
}

// happy-dom ignores unknown KeyboardEventInit members, so keyCode is patched
// onto the event afterwards; cancelable must be set for preventDefault().
function fireKeydown(init: KeyboardEventInit & { keyCode?: number }): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { ...init, cancelable: true })
  if (init.keyCode !== undefined) {
    Object.defineProperty(e, 'keyCode', { value: init.keyCode, configurable: true })
  }
  window.dispatchEvent(e)
  return e
}

describe('useShortcuts IME composition guard', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('Cmd+F opens search when not composing', () => {
    const actions = createActions()
    wrapper = mountShortcuts(actions)

    const e = fireKeydown({ key: 'f', metaKey: true })

    expect(actions.openSearch).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
  })

  it('Cmd+F is ignored while composing (isComposing)', () => {
    const actions = createActions()
    wrapper = mountShortcuts(actions)

    const e = fireKeydown({ key: 'f', metaKey: true, isComposing: true })

    expect(actions.openSearch).not.toHaveBeenCalled()
    expect(e.defaultPrevented).toBe(false)
  })

  it('Cmd+F is ignored for the synthetic IME keyCode 229', () => {
    const actions = createActions()
    wrapper = mountShortcuts(actions)

    const e = fireKeydown({ key: 'f', metaKey: true, keyCode: 229 })

    expect(actions.openSearch).not.toHaveBeenCalled()
    expect(e.defaultPrevented).toBe(false)
  })

  it('Escape during composition does not exit source mode, and fires after composition ends', () => {
    const actions = createActions()
    actions.isSourceMode.mockReturnValue(true)
    wrapper = mountShortcuts(actions)

    // While composing, Escape dismisses the candidate window and must not
    // bubble into the source-mode toggle.
    const composingEscape = fireKeydown({ key: 'Escape', isComposing: true })
    expect(actions.toggleSourceMode).not.toHaveBeenCalled()
    expect(composingEscape.defaultPrevented).toBe(false)

    // Composition over: Escape toggles source mode as usual.
    const plainEscape = fireKeydown({ key: 'Escape' })
    expect(actions.toggleSourceMode).toHaveBeenCalledTimes(1)
    expect(plainEscape.defaultPrevented).toBe(true)
  })

  it('Escape with an overlay open does not exit source mode', () => {
    const actions = createActions()
    actions.isSourceMode.mockReturnValue(true)
    actions.isAnyOverlayOpen.mockReturnValue(true)
    wrapper = mountShortcuts(actions)

    const e = fireKeydown({ key: 'Escape' })

    // The overlay (QuickOpen / Settings / FindBar) closes itself; the
    // window-level handler must not also toggle source mode.
    expect(actions.toggleSourceMode).not.toHaveBeenCalled()
    expect(e.defaultPrevented).toBe(false)
  })

  it('Escape exits source mode again once the overlay closes', () => {
    const actions = createActions()
    actions.isSourceMode.mockReturnValue(true)
    actions.isAnyOverlayOpen.mockReturnValue(true)
    wrapper = mountShortcuts(actions)

    fireKeydown({ key: 'Escape' })
    expect(actions.toggleSourceMode).not.toHaveBeenCalled()

    actions.isAnyOverlayOpen.mockReturnValue(false)
    fireKeydown({ key: 'Escape' })
    expect(actions.toggleSourceMode).toHaveBeenCalledTimes(1)
  })

  it('a shortcut typed after composition ends still works', () => {
    const actions = createActions()
    wrapper = mountShortcuts(actions)

    fireKeydown({ key: 'f', metaKey: true, isComposing: true })
    fireKeydown({ key: 'f', metaKey: true, isComposing: false })

    expect(actions.openSearch).toHaveBeenCalledTimes(1)
  })

  it('Cmd+Shift+S triggers Save As', () => {
    const actions = createActions()
    wrapper = mountShortcuts(actions)

    const e = fireKeydown({ key: 'S', metaKey: true, shiftKey: true })

    expect(actions.handleSaveAs).toHaveBeenCalledTimes(1)
    expect(actions.handleSave).not.toHaveBeenCalled()
    expect(e.defaultPrevented).toBe(true)
  })

  it('the sa menu event routes to Save As', () => {
    const actions = createActions()
    const exposed: { onMenuBarEvent?: (id: string) => void } = {}
    const Host = defineComponent({
      setup() {
        const api = useShortcuts(actions)
        exposed.onMenuBarEvent = api.onMenuBarEvent
        return () => h('div')
      },
    })
    wrapper = mount(Host)

    exposed.onMenuBarEvent?.('sa')

    expect(actions.handleSaveAs).toHaveBeenCalledTimes(1)
  })

  it('the prefs menu event and Cmd+, both open preferences', () => {
    const actions = createActions()
    const exposed: { onMenuBarEvent?: (id: string) => void } = {}
    const Host = defineComponent({
      setup() {
        const api = useShortcuts(actions)
        exposed.onMenuBarEvent = api.onMenuBarEvent
        return () => h('div')
      },
    })
    wrapper = mount(Host)

    exposed.onMenuBarEvent?.('prefs')
    expect(actions.openPreferences).toHaveBeenCalledTimes(1)

    fireKeydown({ key: ',', metaKey: true })
    expect(actions.openPreferences).toHaveBeenCalledTimes(2)
  })

  it('Cmd+Alt+P prints without tripping Quick Open, and vice versa', () => {
    const actions = createActions()
    const exposed: { onMenuBarEvent?: (id: string) => void } = {}
    const Host = defineComponent({
      setup() {
        const api = useShortcuts(actions)
        exposed.onMenuBarEvent = api.onMenuBarEvent
        return () => h('div')
      },
    })
    wrapper = mount(Host)

    fireKeydown({ key: 'p', metaKey: true, altKey: true })
    expect(actions.handlePrint).toHaveBeenCalledTimes(1)
    expect(actions.openQuickOpen).not.toHaveBeenCalled()

    fireKeydown({ key: 'p', metaKey: true })
    expect(actions.handlePrint).toHaveBeenCalledTimes(1)
    expect(actions.openQuickOpen).toHaveBeenCalledTimes(1)

    exposed.onMenuBarEvent?.('pr')
    expect(actions.handlePrint).toHaveBeenCalledTimes(2)
  })
})

describe('Cmd+/ toggles source mode', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('calls toggleSourceMode on Cmd+/', () => {
    const actions = createActions()
    wrapper = mountShortcuts(actions)

    fireKeydown({ key: '/', metaKey: true })

    expect(actions.toggleSourceMode).toHaveBeenCalledTimes(1)
  })

  it('is ignored while composing', () => {
    const actions = createActions()
    wrapper = mountShortcuts(actions)

    fireKeydown({ key: '/', metaKey: true, isComposing: true })

    expect(actions.toggleSourceMode).not.toHaveBeenCalled()
  })
})
