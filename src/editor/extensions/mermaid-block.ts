import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import type { NodeViewRendererProps } from '@tiptap/core'
import type { NodeView as ProseMirrorNodeView } from '@tiptap/pm/view'
import mermaid from 'mermaid'

// ── Mermaid singleton ──────────────────────────────────────────

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

async function renderMermaidToSVG(definition: string): Promise<{ svg: string } | { error: string }> {
  initMermaid()
  const id = `mermaid-svg-${++svgIdCounter}`
  try {
    const { svg } = await mermaid.render(id, definition)
    return { svg }
  } catch (err: any) {
    return { error: err?.message ?? String(err) }
  }
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Mermaid NodeView ───────────────────────────────────────────

function createMermaidNodeView(props: NodeViewRendererProps): ProseMirrorNodeView {
  const { node } = props

  // Wrapper div — receives .block-edit-mode / .block-render-mode from DualModeExtension
  const wrapper = document.createElement('div')
  wrapper.setAttribute('data-language', 'mermaid')
  wrapper.setAttribute('data-type', 'mermaid-block')
  wrapper.classList.add('mermaid-block-wrapper')

  // Edit container: pre > code with contenteditable text
  const editContainer = document.createElement('pre')
  const codeEl = document.createElement('code')
  codeEl.classList.add('language-mermaid')
  editContainer.appendChild(codeEl)
  wrapper.appendChild(editContainer)

  // Render container: holds the rendered SVG
  const renderContainer = document.createElement('div')
  renderContainer.classList.add('mermaid-render-container')
  renderContainer.style.display = 'none'
  wrapper.appendChild(renderContainer)

  // State
  let lastRenderedSource = ''
  let renderTimeout: ReturnType<typeof setTimeout> | null = null

  async function renderDiagram() {
    // Read text from the actual node content
    const source = node.textContent
    if (source === lastRenderedSource && renderContainer.innerHTML) return
    lastRenderedSource = source

    if (!source.trim()) {
      renderContainer.innerHTML = '<p class="mermaid-empty">Empty diagram</p>'
      return
    }

    const result = await renderMermaidToSVG(source)
    if ('error' in result) {
      renderContainer.innerHTML = `<div class="mermaid-error"><strong>Mermaid syntax error</strong><pre>${escapeHTML(result.error)}</pre></div>`
    } else {
      renderContainer.innerHTML = result.svg
    }
  }

  function scheduleRender() {
    if (renderTimeout) clearTimeout(renderTimeout)
    renderTimeout = setTimeout(() => renderDiagram(), 300)
  }

  function setMode(editMode: boolean) {
    if (editMode) {
      editContainer.style.display = ''
      renderContainer.style.display = 'none'
    } else {
      editContainer.style.display = 'none'
      renderContainer.style.display = ''
      lastRenderedSource = '' // force re-render
      scheduleRender()
    }
  }

  // Watch for DualModeExtension's class changes on this wrapper
  const observer = new MutationObserver(() => {
    if (wrapper.classList.contains('block-edit-mode')) {
      setMode(true)
    } else if (wrapper.classList.contains('block-render-mode')) {
      setMode(false)
    }
  })
  observer.observe(wrapper, { attributes: true, attributeFilter: ['class'] })

  return {
    dom: wrapper,
    contentDOM: codeEl,
    update(newNode: any) {
      if (newNode.type.name !== node.type.name) return false
      if (newNode.attrs.language !== 'mermaid') return false
      lastRenderedSource = '' // invalidate cache
      return true
    },
    destroy() {
      observer.disconnect()
      if (renderTimeout) clearTimeout(renderTimeout)
    },
  }
}

// ── Default NodeView for non-mermaid code blocks ───────────────

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
      if (props.node.attrs.language === 'mermaid') {
        return createMermaidNodeView(props)
      }
      return createDefaultCodeBlockNodeView(props)
    }
  },
})
