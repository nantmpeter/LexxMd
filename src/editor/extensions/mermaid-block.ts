import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import type { NodeViewRendererProps } from '@tiptap/core'
import type { NodeView as ProseMirrorNodeView } from '@tiptap/pm/view'
import { render as peleRender } from 'pele'
import katex from 'katex'

function classifyDiagram(svg: SVGSVGElement, container: HTMLElement) {
  const vb = svg.getAttribute('viewBox')
  let ratio = 1
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number)
    const w = parts[2], h = parts[3]
    if (w > 0) ratio = h / w
  } else {
    const bbox = svg.getBBox()
    if (bbox.width > 0) ratio = bbox.height / bbox.width
  }

  container.classList.remove('diagram-tall', 'diagram-moderate', 'diagram-expanded')

  if (ratio > 3) {
    container.classList.add('diagram-tall')
  } else if (ratio > 1.5) {
    container.classList.add('diagram-moderate')
  }
}

// ── Renderers ──────────────────────────────────────────────────

// -- Mermaid (rendered by Pele, https://github.com/obsidianmd/pele) --

async function renderMermaid(definition: string): Promise<{ svg: string } | { error: string }> {
  // Pele is synchronous and needs no DOM; the async signature is kept so the
  // NodeView consumer is unchanged. Parse errors throw with a line-numbered
  // message, which the error box below displays.
  try {
    const { svg } = peleRender(definition)
    return { svg }
  } catch (err: any) {
    return { error: err?.message ?? String(err) }
  }
}

// -- KaTeX --

export function renderKaTeX(latex: string, displayMode: boolean): { html: string } | { error: string } {
  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      // Untrusted content: no \href/\url/\includegraphics/\html* escapes.
      // KaTeX degrades these to a red command-name placeholder instead of
      // producing links, remote images, or injected attributes.
      trust: false,
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
  renderContainer.addEventListener('click', () => {
    if (renderContainer.classList.contains('diagram-tall')) {
      renderContainer.classList.toggle('diagram-expanded')
    }
  })
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
            requestAnimationFrame(() => classifyDiagram(svg, renderContainer))
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

  addStorage() {
    return {
      markdown: {
        parse: {
          // ProseMirror's DOMParser loses indentation when reading content
          // through a nested <code> element inside <pre>.
          // Fix: flatten the structure — store language on <pre>, remove <code>,
          // put text directly inside <pre>. This lets preserveWhitespace:'full'
          // work correctly without code-mark interference.
          updateDOM(element: HTMLElement) {
            element.querySelectorAll('pre').forEach(pre => {
              const code = pre.querySelector('code')
              if (code) {
                const lang = code.getAttribute('class') ?? ''
                const text = code.textContent ?? ''
                code.remove()
                pre.textContent = text
                if (lang) pre.setAttribute('data-language', lang)
              }
            })
          },
        },
      },
    }
  },

  // Override parseHTML to read language from data-language attr (set by updateDOM).
  parseHTML() {
    return [{
      tag: 'pre',
      preserveWhitespace: 'full',
      getAttrs: (dom: HTMLElement) => ({
        language: dom.getAttribute('data-language')?.replace('language-', '') || null,
      }),
    }]
  },

  addNodeView() {
    return (props: NodeViewRendererProps) => {
      if (RICH_LANGUAGES.has(props.node.attrs.language)) {
        return createRichCodeBlockNodeView(props)
      }
      return createDefaultCodeBlockNodeView(props)
    }
  },
})
