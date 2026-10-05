/**
 * BubbleToolbar — floating toolbar using Tiptap's BubbleMenu extension.
 * Shows on text selection with formatting buttons.
 */
import { Extension } from '@tiptap/core'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { PluginKey } from '@tiptap/pm/state'

function renderToolbar(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'bubble-toolbar'
  el.setAttribute('role', 'toolbar')

  const btns: [string, string, string][] = [
    ['bold', 'B', 'Bold (⌘B)'],
    ['italic', 'I', 'Italic (⌘I)'],
    ['strike', 'S', 'Strikethrough'],
  ]

  for (const [cmd, label, title] of btns) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.dataset.cmd = cmd
    btn.title = title
    btn.textContent = label
    el.appendChild(btn)
  }

  const sep1 = document.createElement('span')
  sep1.className = 'bubble-sep'
  el.appendChild(sep1)

  const advanced: [string, string, string][] = [
    ['taskItem', '☐', 'Checkbox'],
    ['highlight', 'H', 'Highlight (==text==)'],
    ['code', '<>', 'Inline Code (`code`)'],
    ['link', '🔗', 'Link'],
    ['subscript', 'X₂', 'Subscript (~text~)'],
    ['superscript', 'X²', 'Superscript (^text^)'],
    ['underline', 'U̲', 'Underline (++text++)'],
  ]

  for (const [cmd, label, title] of advanced) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.dataset.cmd = cmd
    btn.title = title
    btn.textContent = label
    el.appendChild(btn)
  }

  return el
}

// ── Link popup ──────────────────────────────────────────────

function showLinkPopup(editor: any, selectionRect: DOMRect | null) {
  document.querySelector('.link-popup')?.remove()

  const existingHref = editor.getAttributes('link').href || ''

  const popup = document.createElement('div')
  popup.className = 'link-popup'
  popup.innerHTML = `
    <input type="url" class="link-popup-input" placeholder="Paste or type a URL…" value="${existingHref}" />
    <div class="link-popup-actions">
      <button type="button" class="link-popup-cancel">Cancel</button>
      ${existingHref ? '<button type="button" class="link-popup-remove">Remove</button>' : ''}
      <button type="button" class="link-popup-ok">OK</button>
    </div>
  `
  document.body.appendChild(popup)

  // Position below the cached selection rect (captured before mousedown altered it)
  const popupRect = popup.getBoundingClientRect()
  let left: number, top: number
  if (selectionRect) {
    left = selectionRect.left + selectionRect.width / 2 - popupRect.width / 2
    top = selectionRect.bottom + 8
  } else {
    left = window.innerWidth / 2 - popupRect.width / 2
    top = window.innerHeight / 2 - popupRect.height / 2
  }
  if (left < 12) left = 12
  if (left + popupRect.width > window.innerWidth - 12) left = window.innerWidth - popupRect.width - 12
  if (top + popupRect.height > window.innerHeight - 12) {
    top = (selectionRect ? selectionRect.top : window.innerHeight / 2) - popupRect.height - 8
  }

  popup.style.left = `${left}px`
  popup.style.top = `${top}px`
  popup.style.transform = 'none'

  const input = popup.querySelector('.link-popup-input') as HTMLInputElement
  input.focus()
  input.select()

  const close = () => popup.remove()

  popup.querySelector('.link-popup-ok')!.addEventListener('click', () => {
    const url = input.value.trim()
    if (url) editor.chain().focus().setLink({ href: url }).run()
    close()
  })

  popup.querySelector('.link-popup-cancel')!.addEventListener('click', close)

  const removeBtn = popup.querySelector('.link-popup-remove')
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      editor.chain().focus().unsetLink().run()
      close()
    })
  }

  input.addEventListener('keydown', (e) => {
    // IME guard: the Enter that confirms a composition candidate must neither
    // submit the popup nor cut the composition short (same guard as useShortcuts).
    if (e.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter') { e.preventDefault(); popup.querySelector<HTMLButtonElement>('.link-popup-ok')!.click() }
    if (e.key === 'Escape') close()
  })

  setTimeout(() => {
    document.addEventListener('mousedown', function handler(e) {
      if (!popup.contains(e.target as Node)) { close(); document.removeEventListener('mousedown', handler) }
    })
  }, 0)
}

// ── Commands ────────────────────────────────────────────────

function execCommand(editor: any, cmd: string, selectionRect: DOMRect | null) {
  switch (cmd) {
    case 'bold':        editor.chain().focus().toggleBold().run(); break
    case 'italic':      editor.chain().focus().toggleItalic().run(); break
    case 'strike':      editor.chain().focus().toggleStrike().run(); break
    case 'highlight':   editor.chain().focus().toggleHighlight().run(); break
    case 'code':        editor.chain().focus().toggleCode().run(); break
    case 'link':        showLinkPopup(editor, selectionRect); break
    case 'subscript':   editor.chain().focus().toggleSubscript().run(); break
    case 'superscript': editor.chain().focus().toggleSuperscript().run(); break
    case 'underline':   editor.chain().focus().toggleUnderline().run(); break
    case 'taskItem': {
      if (editor.isActive('taskItem')) {
        editor.chain().focus().liftListItem('taskItem').run()
      } else if (editor.isActive('listItem')) {
        editor.chain().focus().splitListItem('listItem').run()
      } else {
        editor.chain().focus().toggleTaskList().run()
      }
      break
    }
  }
}

function updateActiveStates(editor: any, element: HTMLElement) {
  element.querySelectorAll('button').forEach(btn => {
    const cmd = btn.dataset.cmd!
    let active = false
    switch (cmd) {
      case 'bold':        active = editor.isActive('bold'); break
      case 'italic':      active = editor.isActive('italic'); break
      case 'strike':      active = editor.isActive('strike'); break
      case 'highlight':   active = editor.isActive('highlight'); break
      case 'code':        active = editor.isActive('code'); break
      case 'link':        active = editor.isActive('link'); break
      case 'subscript':   active = editor.isActive('subscript'); break
      case 'superscript': active = editor.isActive('superscript'); break
      case 'underline':   active = editor.isActive('underline'); break
      case 'taskItem':    active = editor.isActive('taskItem'); break
    }
    btn.classList.toggle('active', active)
  })
}

export const BubbleToolbar = Extension.create({
  name: 'bubbleToolbar',

  addProseMirrorPlugins() {
    const editor = this.editor
    const element = renderToolbar()

    // Cache selection position before button click might alter it
    let cachedSelectionRect: DOMRect | null = null

    element.addEventListener('mousedown', (e) => {
      const btn = (e.target as HTMLElement).closest('button')
      if (!btn) return

      // Use ProseMirror's internal selection state (preserved by preventDefault)
      // rather than browser DOM selection which may have shifted when mouse moved to toolbar
      const { head } = editor.state.selection
      const coords = editor.view.coordsAtPos(head)
      cachedSelectionRect = new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top)

      e.preventDefault()
      e.stopPropagation()
      execCommand(editor, btn.dataset.cmd!, cachedSelectionRect)
    })

    return [
      BubbleMenuPlugin({
        editor,
        element,
        pluginKey: new PluginKey('bubbleToolbar'),
        shouldShow: ({ state }) => {
          const { from, to, empty } = state.selection
          if (empty) return false
          if (editor.isActive('codeBlock')) return false
          return true
        },
        tippyOptions: {
          maxWidth: 'none',
          placement: 'bottom',
          getReferenceClientRect: () => {
            const { head } = editor.state.selection
            const coords = editor.view.coordsAtPos(head)
            // Return a rect centered on the selection head
            return new DOMRect(coords.left - 50, coords.top, 100, coords.bottom - coords.top)
          },
        },
      }),
    ]
  },
})
