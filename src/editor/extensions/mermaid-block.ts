import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import type { NodeViewRendererProps } from '@tiptap/core'
import type { NodeView as ProseMirrorNodeView } from '@tiptap/pm/view'
import mermaid from 'mermaid'
import katex from 'katex'

// ── Renderers ──────────────────────────────────────────────────

// -- Mermaid --

let mermaidReady = false

function initMermaid() {
  if (!mermaidReady) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict',
    })
    mermaidReady = true
  }
}

let svgIdCounter = 0

async function renderMermaid(definition: string): Promise<{ svg: string } | { error: string }> {
  initMermaid()
  const id = `mermaid-svg-${++svgIdCounter}`
  try {
    const { svg } = await mermaid.render(id, definition)
    return { svg }
  } catch (err: any) {
    return { error: err?.message ?? String(err) }
  }
}

// -- KaTeX --

function renderKaTeX(latex: string, displayMode: boolean): { html: string } | { error: string } {
  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      trust: true,
    })
    return { html }
  } catch (err: any) {
    return { error: err?.message ?? String(err) }
  }
}

// ── Shared helpers ─────────────────────────────────────────────

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getModeFromDeco(outerDeco: readonly any[]): 'edit' | 'render' | null {
  for (const deco of outerDeco) {
    const cls = deco?.type?.attrs?.class ?? ''
    if (cls.includes('block-edit-mode')) return 'edit'
    if (cls.includes('block-render-mode')) return 'render'
  }
  return null
}

function getModeFromDOM(wrapper: HTMLElement): 'edit' | 'render' | null {
  if (wrapper.classList.contains('block-edit-mode')) return 'edit'
  if (wrapper.classList.contains('block-render-mode')) return 'render'
  return null
}

// ── Rich code block NodeView (mermaid / math) ──────────────────

/** Languages that get rich rendering instead of plain syntax highlighting. */
const RICH_LANGUAGES = new Set(['mermaid', 'math', 'latex', 'katex'])

function createRichCodeBlockNodeView(props: NodeViewRendererProps): ProseMirrorNodeView {
  const { node, view, getPos } = props
  const lang = node.attrs.language ?? ''

  const wrapper = document.createElement('div')
  wrapper.setAttribute('data-language', lang)
  wrapper.setAttribute('data-type', 'rich-code-block')
  wrapper.classList.add('rich-block-wrapper')

  const editContainer = document.createElement('pre')
  const codeEl = document.createElement('code')
  codeEl.classList.add(`language-${lang}`)
  editContainer.appendChild(codeEl)
  wrapper.appendChild(editContainer)

  const renderContainer = document.createElement('div')
  renderContainer.classList.add('rich-render-container')
  renderContainer.style.display = 'none'
  wrapper.appendChild(renderContainer)

  let lastRenderedSource = ''
  let renderTimeout: ReturnType<typeof setTimeout> | null = null
  let currentMode: 'edit' | 'render' | null = null

  function getSource(): string {
    const pos = getPos()
    if (pos == null) return ''
    const currentNode = view.state.doc.nodeAt(pos)
    return currentNode?.textContent ?? ''
  }

  function renderContent() {
    const source = getSource()
    if (source === lastRenderedSource && renderContainer.innerHTML) return
    lastRenderedSource = source

    if (!source.trim()) {
      renderContainer.innerHTML = '<p class="rich-empty">Empty content</p>'
      return
    }

    if (lang === 'mermaid') {
      renderMermaid(source).then(result => {
        if ('error' in result) {
          renderContainer.innerHTML = `<div class="rich-error"><strong>Mermaid syntax error</strong><pre>${escapeHTML(result.error)}</pre></div>`
        } else {
          renderContainer.innerHTML = result.svg
          const svg = renderContainer.querySelector('svg')
          if (svg) {
            svg.removeAttribute('width')
            svg.removeAttribute('style')
          }
        }
      })
    } else {
      // KaTeX math
      const result = renderKaTeX(source, true)
      if ('error' in result) {
        renderContainer.innerHTML = `<div class="rich-error"><strong>LaTeX syntax error</strong><pre>${escapeHTML(result.error)}</pre></div>`
      } else {
        renderContainer.innerHTML = result.html
      }
    }
  }

  function scheduleRender() {
    if (renderTimeout) clearTimeout(renderTimeout)
    renderTimeout = setTimeout(() => renderContent(), 300)
  }

  function setMode(mode: 'edit' | 'render') {
    if (mode === currentMode) return
    currentMode = mode

    if (mode === 'edit') {
      editContainer.style.display = ''
      renderContainer.style.display = 'none'
    } else {
      editContainer.style.display = 'none'
      renderContainer.style.display = ''
      lastRenderedSource = ''
      scheduleRender()
    }
  }

  requestAnimationFrame(() => {
    const mode = getModeFromDOM(wrapper)
    if (mode) setMode(mode)
  })

  return {
    dom: wrapper,
    contentDOM: codeEl,

    update(newNode: any, outerDeco: readonly any[]) {
      if (newNode.type.name !== node.type.name) return false
      if (!RICH_LANGUAGES.has(newNode.attrs.language)) return false

      const mode = getModeFromDeco(outerDeco)
      if (mode) setMode(mode)

      lastRenderedSource = ''
      return true
    },

    ignoreMutation(mutation: any) {
      if (mutation.target === codeEl || mutation.target.parentNode === codeEl) return false
      return true
    },

    destroy() {
      if (renderTimeout) clearTimeout(renderTimeout)
    },
  }
}

// ── Default NodeView for plain code blocks ─────────────────────

function createDefaultCodeBlockNodeView(props: NodeViewRendererProps): ProseMirrorNodeView {
  const { node } = props

  const pre = document.createElement('pre')
  pre.setAttribute('data-language', node.attrs.language ?? 'plaintext')
  pre.classList.add('code-block')

  const code = document.createElement('code')
  if (node.attrs.language) {
    code.classList.add(`language-${node.attrs.language}`)
  }
  pre.appendChild(code)

  return {
    dom: pre,
    contentDOM: code,
    update(newNode: any) {
      if (newNode.type.name !== node.type.name) return false
      if (newNode.attrs.language !== node.attrs.language) {
        pre.setAttribute('data-language', newNode.attrs.language ?? 'plaintext')
        code.className = newNode.attrs.language ? `language-${newNode.attrs.language}` : ''
      }
      return true
    },
    destroy() {},
  }
}

// ── Extension ──────────────────────────────────────────────────

export const MermaidBlockExtension = CodeBlockLowlight.extend({
  name: 'codeBlock',

  addNodeView() {
    return (props: NodeViewRendererProps) => {
      if (RICH_LANGUAGES.has(props.node.attrs.language)) {
        return createRichCodeBlockNodeView(props)
      }
      return createDefaultCodeBlockNodeView(props)
    }
  },
})
