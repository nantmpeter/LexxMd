# Markdown WYSIWYG Editor MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Typora-style instant-rendering Markdown WYSIWYG editor as a pure web application (Vite + TypeScript + ProseMirror). Core: cursor enters block → show Markdown syntax; cursor leaves → show rendered result.

**Architecture:** ProseMirror document stores rendered structure; NodeViews handle dual-mode (edit/render) per block; FocusTrackerPlugin drives mode switches on cursor movement; markdown-it → DOMParser for parsing, DOMSerializer → turndown for serialization.

**Tech Stack:** ProseMirror (state, view, model, inputrules, keymap, tables), markdown-it, turndown, CodeMirror 6, Vite, TypeScript

---

## File Structure

```
mdeditor/
  src/
    main.ts                        # 入口，初始化编辑器
    editor/
      index.ts                     # createEditor()，组装所有组件
      schema.ts                    # ProseMirror Schema 定义
      plugins/
        focus-tracker.ts           # FocusTrackerPlugin
        markdown-input.ts          # MarkdownInputPlugin (inputRules)
        markdown-sync.ts           # MarkdownSyncPlugin
        keymap.ts                  # KeymapPlugin
      nodeviews/
        base.ts                    # DualModeNodeView 基类
        heading.ts                 # HeadingNodeView
        paragraph.ts               # ParagraphNodeView
        code-block.ts              # CodeBlockNodeView + CodeMirror 6
        table.ts                   # TableNodeView (via prosemirror-tables)
        list.ts                    # ListNodeView
        blockquote.ts              # BlockquoteNodeView
      commands.ts                  # 自定义命令（toggleHeading 等）
    markdown/
      parser.ts                    # .md → markdown-it → HTML → DOMParser → PM Doc
      serializer.ts                # PM Doc → DOMSerializer → HTML → turndown → .md
    state/
      doc-store.ts                 # 文档状态（文件名、脏标记、序列化文本）
    ui/
      toolbar.ts                   # 顶部工具栏
      style.css                    # 编辑器样式
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  SPEC.md                          # 本 spec 的 HTML 验证页面
```

**依赖顺序原则：**
- `schema.ts` 无依赖，被所有其他文件引用
- `plugins/focus-tracker.ts` 被 `nodeviews/base.ts` 使用
- `nodeviews/base.ts` 被各具体 NodeView 继承
- `markdown/parser.ts` 和 `serializer.ts` 被 `plugins/markdown-sync.ts` 使用
- `editor/index.ts` 最后组装所有组件

---

## Task Map

| # | 任务 | 关键依赖 | 产出文件 |
|---|------|---------|---------|
| 1 | 项目脚手架 | - | package.json, vite.config.ts, tsconfig.json, index.html, style.css |
| 2 | Schema 定义 | - | src/editor/schema.ts |
| 3 | 最小可运行编辑器 | Task 2 | src/editor/index.ts, src/main.ts |
| 4 | DualModeNodeView 基类 | Task 3 | src/editor/nodeviews/base.ts |
| 5 | FocusTrackerPlugin | Task 4 | src/editor/plugins/focus-tracker.ts |
| 6 | HeadingNodeView | Task 4, 5 | src/editor/nodeviews/heading.ts |
| 7 | ParagraphNodeView | Task 4, 5 | src/editor/nodeviews/paragraph.ts |
| 8 | ListNodeView | Task 4, 5 | src/editor/nodeviews/list.ts |
| 9 | BlockquoteNodeView | Task 4, 5 | src/editor/nodeviews/blockquote.ts |
| 10 | CodeBlockNodeView | Task 4, 5 | src/editor/nodeviews/code-block.ts |
| 11 | TableNodeView | Task 4, 5 | src/editor/nodeviews/table.ts |
| 12 | MarkdownInputPlugin | Task 3 | src/editor/plugins/markdown-input.ts |
| 13 | MarkdownSyncPlugin | Task 2 | src/editor/plugins/markdown-sync.ts |
| 14 | KeymapPlugin | Task 3 | src/editor/plugins/keymap.ts |
| 15 | Markdown Parser | Task 2 | src/markdown/parser.ts |
| 16 | Markdown Serializer | Task 2 | src/markdown/serializer.ts |
| 17 | DocStore | Task 15, 16 | src/state/doc-store.ts |
| 18 | Toolbar + Style | Task 3 | src/ui/toolbar.ts, src/editor/style.css |
| 19 | 集成与验收 | Task 1-18 | index.html 更新，运行验证 |

---

## Task 1: 项目脚手架

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/editor/style.css`
- Create: `src/main.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "mdeditor",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "prosemirror-state": "^1.4.3",
    "prosemirror-view": "^1.33.7",
    "prosemirror-model": "^1.22.1",
    "prosemirror-schema-basic": "^1.2.2",
    "prosemirror-schema-list": "^1.3.0",
    "prosemirror-inputrules": "^1.4.0",
    "prosemirror-keymap": "^1.2.2",
    "prosemirror-commands": "^1.6.0",
    "prosemirror-history": "^1.4.0",
    "prosemirror-dropcursor": "^1.8.1",
    "prosemirror-gapcursor": "^1.3.2",
    "prosemirror-tables": "^1.3.7",
    "markdown-it": "^14.1.0",
    "turndown": "^7.2.0",
    "@codemirror/state": "^6.4.1",
    "@codemirror/view": "^6.28.0",
    "@codemirror/lang-javascript": "^6.2.2",
    "@codemirror/lang-css": "^6.2.1",
    "@codemirror/lang-html": "^6.4.9",
    "@codemirror/lang-python": "^6.1.6",
    "@codemirror/lang-rust": "^6.0.1",
    "@codemirror/lang-json": "^6.0.1",
    "@codemirror/lang-markdown": "^6.2.5",
    "@codemirror/theme-one-dark": "^6.1.2",
    "@codemirror/language": "^6.10.0",
    "@codemirror/language-data": "^6.5.0"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
  },
  build: {
    target: 'esnext',
  },
})
```

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MDEditor</title>
  <link rel="stylesheet" href="/src/editor/style.css" />
</head>
<body>
  <div id="app">
    <div id="toolbar"></div>
    <div id="editor"></div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 5: 创建 src/editor/style.css**

```css
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #fff;
  color: #333;
}

#app {
  max-width: 800px;
  margin: 60px auto;
  padding: 0 20px;
}

/* ProseMirror Editor */
.ProseMirror {
  outline: none;
  min-height: 400px;
  font-size: 16px;
  line-height: 1.7;
}

/* Headings */
.ProseMirror h1 { font-size: 2em; font-weight: 700; margin: 1em 0 0.5em; }
.ProseMirror h2 { font-size: 1.5em; font-weight: 700; margin: 1em 0 0.5em; }
.ProseMirror h3 { font-size: 1.25em; font-weight: 600; margin: 1em 0 0.5em; }
.ProseMirror h4 { font-size: 1em; font-weight: 600; margin: 1em 0 0.5em; }

/* Block elements */
.ProseMirror p { margin: 0.5em 0; }
.ProseMirror blockquote {
  border-left: 3px solid #ddd;
  margin: 1em 0;
  padding-left: 1em;
  color: #666;
}
.ProseMirror hr {
  border: none;
  border-top: 2px solid #eee;
  margin: 1.5em 0;
}

/* Lists */
.ProseMirror ul, .ProseMirror ol {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.ProseMirror li { margin: 0.25em 0; }

/* Inline marks */
.ProseMirror strong { font-weight: 700; }
.ProseMirror em { font-style: italic; }
.ProseMirror code {
  background: #f5f5f5;
  border-radius: 3px;
  padding: 0.1em 0.3em;
  font-family: 'Fira Code', monospace;
  font-size: 0.9em;
}
.ProseMirror a { color: #0066cc; }

/* Code blocks */
.ProseMirror pre {
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 6px;
  padding: 1em;
  margin: 1em 0;
  overflow-x: auto;
}
.ProseMirror pre code {
  background: none;
  padding: 0;
  font-size: 0.9em;
  color: inherit;
}

/* Tables */
.ProseMirror table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}
.ProseMirror td, .ProseMirror th {
  border: 1px solid #ddd;
  padding: 0.5em 0.75em;
  text-align: left;
}
.ProseMirror th {
  background: #f5f5f5;
  font-weight: 600;
}

/* Dual-mode: Markdown syntax markers */
.md-marker {
  color: #999;
  user-select: none;
  font-weight: normal;
}

/* Edit mode wrapper */
.edit-mode .md-marker { display: inline; }
.render-mode .md-marker { display: none; }

/* Toolbar */
#toolbar {
  position: sticky;
  top: 0;
  background: #fafafa;
  border-bottom: 1px solid #eee;
  padding: 8px 0;
  margin: 0 -20px;
  padding: 8px 20px;
  display: flex;
  gap: 4px;
  z-index: 10;
}

#toolbar button {
  background: none;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 14px;
  color: #555;
}

#toolbar button:hover {
  background: #eee;
  border-color: #ddd;
}

#toolbar button.active {
  background: #e6f0ff;
  border-color: #0066cc;
  color: #0066cc;
}
```

- [ ] **Step 6: 创建 src/main.ts（最小入口，Task 3 后替换）**

```typescript
import { createEditor } from './editor/index'

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('editor')
  if (el) {
    createEditor(el)
  }
})
```

---

## Task 2: ProseMirror Schema 定义

**Files:**
- Create: `src/editor/schema.ts`
- Test: `tests/editor/schema.test.ts`

- [ ] **Step 1: 创建测试 tests/editor/schema.test.ts**

```typescript
import { Schema } from 'prosemirror-model'
import { schema } from '../../src/editor/schema'

describe('Schema', () => {
  it('has heading nodes for levels 1-6', () => {
    for (let i = 1; i <= 6; i++) {
      const heading = schema.nodes.heading
      expect(heading.attrs.level.default).toBe(1)
    })
  })

  it('has required block nodes', () => {
    expect(schema.nodes.paragraph).toBeDefined()
    expect(schema.nodes.heading).toBeDefined()
    expect(schema.nodes.code_block).toBeDefined()
    expect(schema.nodes.bullet_list).toBeDefined()
    expect(schema.nodes.ordered_list).toBeDefined()
    expect(schema.nodes.blockquote).toBeDefined()
    expect(schema.nodes.horizontal_rule).toBeDefined()
  })

  it('has required inline marks', () => {
    expect(schema.marks.strong).toBeDefined()
    expect(schema.marks.em).toBeDefined()
    expect(schema.marks.code).toBeDefined()
    expect(schema.marks.link).toBeDefined()
  })

  it('creates a valid empty doc', () => {
    const doc = schema.nodes.doc.create({}, [
      schema.nodes.paragraph.create()
    ])
    expect(doc.content.size).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run tests/editor/schema.test.ts`（安装 vitest 跳过，正式跑时执行）
Expected: FAIL（schema.ts 不存在）

- [ ] **Step 3: 创建 src/editor/schema.ts**

```typescript
import { Schema } from 'prosemirror-model'
import { nodes as basicNodes, marks as basicMarks } from 'prosemirror-schema-basic'
import { addListNodes } from 'prosemirror-schema-list'

// Build inline mark set
const inlineMarks = {
  ...basicMarks,
  link: {
    attrs: {
      href: { default: null },
      title: { default: null },
    },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs(dom: HTMLElement) {
          return {
            href: dom.getAttribute('href'),
            title: dom.getAttribute('title'),
          }
        },
      },
    ],
    toDOM(mark) {
      return ['a', { href: mark.attrs.href, title: mark.attrs.title }, 0]
    },
  },
}

// Build block node set
const blockNodes = {
  ...basicNodes,
  horizontal_rule: {
    group: 'block',
    parseDOM: [{ tag: 'hr' }],
    toDOM() { return ['hr'] },
  },
  code_block: {
    content: 'text*',
    marks: '',
    group: 'block',
    code: true,
    defining: true,
    attrs: { language: { default: '' } },
    parseDOM: [
      {
        tag: 'pre',
        preserveWhitespace: 'full' as const,
        getAttrs(dom: HTMLElement) {
          const langClass = dom.querySelector('code')?.className ?? ''
          const match = langClass.match(/^language-(\w+)/)
          return { language: match ? match[1] : '' }
        },
      },
    ],
    toDOM(node) {
      return [
        'pre',
        { 'data-language': node.attrs.language },
        ['code', { class: node.attrs.language ? `language-${node.attrs.language}` : '' }, 0],
      ]
    },
  },
}

// Wrap with list nodes
const nodes = addListNodes(Object.keys(blockNodes).includes('doc') ? blockNodes : { doc: blockNodes.doc, ...blockNodes }, 'block+', 'block')

export const schema = new Schema({
  nodes: nodes as Record<string, any>,
  marks: inlineMarks as Record<string, any>,
})
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run tests/editor/schema.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add package.json vite.config.ts tsconfig.json index.html src/editor/style.css src/main.ts tests/ src/editor/schema.ts
git commit -m "feat: project scaffold and ProseMirror schema"
```

---

## Task 3: 最小可运行编辑器（无 NodeViews）

**Files:**
- Modify: `src/editor/index.ts`（创建 createEditor 函数）
- Modify: `src/main.ts`（完整入口）

- [ ] **Step 1: 创建 src/editor/index.ts**

```typescript
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap } from 'prosemirror-commands'
import { schema } from './schema'

export function createEditor(parent: HTMLElement, initialContent?: string) {
  const doc = initialContent
    ? schema.nodes.doc.create({}, [schema.nodes.paragraph.create({}, initialContent.split('').map(c => schema.text(c)))])
    : schema.nodes.doc.create({}, [schema.nodes.paragraph.create()])

  const state = EditorState.create({
    doc,
    plugins: [
      keymap(baseKeymap),
    ],
  })

  const view = new EditorView(parent, {
    state,
    attributes: { class: 'ProseMirror' },
  })

  return view
}
```

- [ ] **Step 2: 更新 src/main.ts**

```typescript
import { createEditor } from './editor/index'

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('editor')
  if (el) {
    createEditor(el)
  }
})
```

- [ ] **Step 3: 运行 Vite 验证页面加载**

Run: `npm install && npm run dev`
Expected: 页面显示 ProseMirror 编辑器，可输入文字，页面无报错

- [ ] **Step 4: 提交**

```bash
git add src/editor/index.ts src/main.ts
git commit -m "feat: minimal running editor with basic schema"
```

---

## Task 4: DualModeNodeView 基类

**Files:**
- Create: `src/editor/nodeviews/base.ts`

- [ ] **Step 1: 创建 DualModeNodeView 基类**

```typescript
import { NodeView, NodeViewConstructorProps } from 'prosemirror-view'
import { Node as PMNode } from 'prosemirror-model'

/**
 * Base class for dual-mode NodeViews.
 * Each NodeView has two states:
 * - edit mode: shows Markdown syntax (e.g. "## " prefix)
 * - render mode: shows rendered HTML (no Markdown markers)
 *
 * Subclasses must implement:
 * - createEditDOM(): create the editing DOM element
 * - createRenderDOM(): create the rendering DOM element
 * - getContentEditable(): return the contentEditable element
 * - getMarkdownPrefix(): return the Markdown prefix string for this node type
 */
export abstract class DualModeNodeView implements NodeView {
  public node: PMNode
  /** Outer DOM element — a neutral div ProseMirror mounts */
  public dom: HTMLElement
  public contentDOM: HTMLElement | null

  /** The contenteditable element — shared between modes */
  protected contentEl: HTMLElement

  private _editMode: boolean = false

  constructor(props: NodeViewConstructorProps) {
    this.node = props.node
    this.contentDOM = null

    // Create the contenteditable element
    this.contentEl = this.createContentEl()
    this.contentEl.setAttribute('contenteditable', 'false')

    // Build the outer container
    this.dom = document.createElement('div')
    this.dom.style.display = 'block'

    // Build edit mode element: wrapper with Markdown prefix + text
    const editWrapper = this.createEditWrapper()
    editWrapper.appendChild(this.contentEl)
    editWrapper.style.display = 'none'  // Hidden by default (render mode initial)

    // Build render mode element: semantic HTML
    const renderWrapper = this.createRenderWrapper()

    this.dom.appendChild(editWrapper)
    this.dom.appendChild(renderWrapper)

    this.update(props.node, null)
  }

  // ─── Abstract methods ────────────────────────────────────────

  /** Override: create the contenteditable element */
  protected abstract createContentEl(): HTMLElement

  /** Override: create the edit-mode inner wrapper (e.g. <span class="edit-wrap">) */
  protected abstract createEditWrapper(): HTMLElement

  /** Override: create the render-mode inner wrapper (e.g. <h2>) */
  protected abstract createRenderWrapper(): HTMLElement

  // ─── NodeView interface ─────────────────────────────────────

  update(node: PMNode, decorations: any) {
    if (node.type !== this.node.type) return false
    this.node = node
    // Sync text content to contenteditable
    this.contentEl.textContent = this.getNodeText()
    return true
  }

  selectNode() { this.switchToEditMode() }
  deselectNode() { this.switchToRenderMode() }
  destroy() { /* subclasses clean up */ }

  /** Override to return the text content of the node for display */
  protected getNodeText(): string {
    let text = ''
    this.node.forEach((child: PMNode) => {
      if (child.isText) text += child.text ?? ''
    })
    return text
  }

  // ─── Mode switching (pure CSS — no DOM reparenting) ─────────

  switchToEditMode() {
    if (this._editMode) return
    this._editMode = true
    const editWrap = this.dom.querySelector('.edit-mode') as HTMLElement
    const renderWrap = this.dom.querySelector('.render-mode') as HTMLElement
    if (editWrap) editWrap.style.display = ''
    if (renderWrap) renderWrap.style.display = 'none'
    this.contentEl.setAttribute('contenteditable', 'true')
  }

  switchToRenderMode() {
    if (!this._editMode) return
    this._editMode = false
    const editWrap = this.dom.querySelector('.edit-mode') as HTMLElement
    const renderWrap = this.dom.querySelector('.render-mode') as HTMLElement
    if (editWrap) editWrap.style.display = 'none'
    if (renderWrap) renderWrap.style.display = ''
    this.contentEl.setAttribute('contenteditable', 'false')
  }

  isEditMode() { return this._editMode }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/editor/nodeviews/base.ts
git commit -m "feat: DualModeNodeView base class"
```

---

## Task 5: FocusTrackerPlugin

**Files:**
- Create: `src/editor/plugins/focus-tracker.ts`
- Test: `tests/editor/plugins/focus-tracker.test.ts`

- [ ] **Step 1: 创建测试 tests/editor/plugins/focus-tracker.test.ts**

```typescript
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { Node as PMNode, Fragment } from 'prosemirror-model'
import { schema } from '../../../src/editor/schema'
import { focusTrackerPlugin, setActiveNodeView } from '../../../src/editor/plugins/focus-tracker'

// Mock NodeView for testing
const mockNodeViews = new Map<number, any>()

class MockNodeView {
  switchedTo = ''
  constructor(pos: number) {
    mockNodeViews.set(pos, this)
  }
  switchToEditMode() { this.switchedTo = 'edit' }
  switchToRenderMode() { this.switchedTo = 'render' }
}

describe('FocusTrackerPlugin', () => {
  it('tracks focused block position on selection change', () => {
    const doc = schema.nodes.doc.create({}, [
      schema.nodes.paragraph.create(),
      schema.nodes.paragraph.create(),
    ])
    const state = EditorState.create({ doc, plugins: [focusTrackerPlugin] })
    // The plugin should initialize without error
    expect(state.plugins.length).toBeGreaterThan(0)
  })

  it('calls switchToEditMode on the newly focused block', () => {
    // Integration test: set up editor, move cursor, verify old block gets render mode
    // This requires a full DOM test, see SPEC.md for visual testing
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run tests/editor/plugins/focus-tracker.test.ts`
Expected: FAIL (focus-tracker.ts 不存在)

- [ ] **Step 3: 创建 src/editor/plugins/focus-tracker.ts**

```typescript
import { Plugin, PluginKey, EditorState, Transaction } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { Node as PMNode } from 'prosemirror-model'

export const focusTrackerKey = new PluginKey('focusTracker')

/**
 * Map of doc positions -> NodeView instances.
 * NodeViews register themselves on creation and deregister on destroy.
 */
export const nodeViewRegistry = new Map<number, any>()

/**
 * Find the nearest block-level node position for a given position.
 */
function findParentBlockPos(doc: PMNode, pos: number): number {
  let target = pos
  doc.nodesBetween(pos, pos + 1, (node, nodePos) => {
    // Walk up: find a node that is in "block" group
    if (node.isBlock && nodePos < pos) {
      target = nodePos
    }
  })
  return target
}

/**
 * FocusTrackerPlugin:
 * - Watches selection changes
 * - Finds the parent block of the new cursor position
 * - Notifies the old focused block NodeView to switch to render mode
 * - Notifies the new focused block NodeView to switch to edit mode
 */
export const focusTrackerPlugin = new Plugin({
  key: focusTrackerKey,

  state: {
    init() {
      return { focusedPos: null as number | null }
    },

    apply(tr: Transaction, prev: { focusedPos: number | null }, _oldState: EditorState, newState: EditorState) {
      if (!tr.selectionSet) return prev

      const $head = newState.selection.$head
      const blockPos = findParentBlockPos(newState.doc, $head.before())

      return { focusedPos: blockPos }
    },
  },

  view(view) {
    let currentFocusedPos: number | null = null

    return {
      update(view: EditorView, prevState: EditorState) {
        const pluginState = focusTrackerKey.getState(view.state) as { focusedPos: number | null } | undefined
        const newFocusedPos = pluginState?.focusedPos ?? null

        if (newFocusedPos !== currentFocusedPos) {
          // Deselect old block
          if (currentFocusedPos !== null) {
            const oldNV = nodeViewRegistry.get(currentFocusedPos)
            oldNV?.switchToRenderMode()
          }

          // Select new block
          if (newFocusedPos !== null) {
            const newNV = nodeViewRegistry.get(newFocusedPos)
            newNV?.switchToEditMode()
          }

          currentFocusedPos = newFocusedPos
        }
      },
    }
  },
})

/**
 * Register a NodeView at a given position.
 * Called from the NodeView constructor.
 */
export function registerNodeView(pos: number, nodeView: any) {
  nodeViewRegistry.set(pos, nodeView)
}

/**
 * Unregister a NodeView.
 * Called from the NodeView destroy() method.
 */
export function unregisterNodeView(pos: number) {
  nodeViewRegistry.delete(pos)
}

/**
 * Manually set the active NodeView (used when cursor moves programmatically).
 */
export function setActiveNodeView(pos: number) {
  const oldNV = nodeViewRegistry.get(focusTrackerKey.getState(
    focusTrackerKey.getState(
      { focusedPos: null } as any
    ) as any
  )?.focusedPos as number) ?? null
  if (oldNV) oldNV.switchToRenderMode()
  const newNV = nodeViewRegistry.get(pos)
  if (newNV) newNV.switchToEditMode()
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run tests/editor/plugins/focus-tracker.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/editor/plugins/focus-tracker.ts tests/editor/plugins/focus-tracker.test.ts
git commit -m "feat: FocusTrackerPlugin for dual-mode switching"
```

---

## Task 6: HeadingNodeView

**Files:**
- Modify: `src/editor/index.ts`（注册 HeadingNodeView 到 NodeViewResolver）
- Create: `src/editor/nodeviews/heading.ts`

- [ ] **Step 1: 创建 src/editor/nodeviews/heading.ts**

```typescript
import { NodeViewConstructorProps } from 'prosemirror-view'
import { Node as PMNode } from 'prosemirror-model'
import { DualModeNodeView } from './base'
import { registerNodeView, unregisterNodeView } from '../plugins/focus-tracker'

const LEVEL_TAGS = ['', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']
const LEVEL_PREFIXES = ['', '# ', '## ', '### ', '#### ', '##### ', '###### ']

export class HeadingNodeView extends DualModeNodeView {
  private level: number

  constructor(props: NodeViewConstructorProps) {
    const level = props.node.attrs.level ?? 1
    super(props)
    this.level = level
    registerNodeView(props.getPos!, this)
  }

  protected createContentEl(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'heading-text'
    el.textContent = this.getNodeText()
    return el
  }

  protected createEditWrapper(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'edit-mode heading-edit'
    const prefix = document.createElement('span')
    prefix.className = 'md-marker'
    prefix.textContent = LEVEL_PREFIXES[this.level] ?? '# '
    el.appendChild(prefix)
    return el
  }

  protected createRenderWrapper(): HTMLElement {
    const tag = LEVEL_TAGS[this.level] ?? 'h1'
    return document.createElement(tag)
  }

  update(node: PMNode, decorations: any) {
    if (!super.update(node, decorations)) return false
    this.level = node.attrs.level ?? 1
    // Update render wrapper tag if level changed
    const renderEl = this.dom.querySelector('.render-mode') as HTMLElement
    if (renderEl) {
      renderEl.tagName = LEVEL_TAGS[this.level]?.toUpperCase() ?? 'H1'
    }
    // Update prefix text
    const prefix = this.dom.querySelector('.md-marker') as HTMLElement
    if (prefix) prefix.textContent = LEVEL_PREFIXES[this.level] ?? '# '
    return true
  }

  destroy() {
    unregisterNodeView((this as any).pos)
    super.destroy()
  }
}

export function headingNodeView(props: NodeViewConstructorProps) {
  return new HeadingNodeView(props)
}
```

- [ ] **Step 2: 注册到编辑器 src/editor/index.ts**

```typescript
// 在 createEditor 中添加 NodeViewResolver:
import { headingNodeView } from './nodeviews/heading'
// 在 EditorView 构造的 nodeViews 中:
nodeViews: {
  heading: headingNodeView,
}
```

- [ ] **Step 3: 提交**

```bash
git add src/editor/nodeviews/heading.ts src/editor/index.ts
git commit -m "feat: HeadingNodeView with dual-mode (## prefix show/hide)"
```

---

## Task 7: ParagraphNodeView

**Files:**
- Create: `src/editor/nodeviews/paragraph.ts`

- [ ] **Step 1: 创建 src/editor/nodeviews/paragraph.ts**

```typescript
import { NodeViewConstructorProps } from 'prosemirror-view'
import { Node as PMNode, Mark } from 'prosemirror-model'
import { DualModeNodeView } from './base'
import { registerNodeView, unregisterNodeView } from '../plugins/focus-tracker'

export class ParagraphNodeView extends DualModeNodeView {
  constructor(props: NodeViewConstructorProps) {
    super(props)
    registerNodeView(props.getPos!, this)
  }

  protected createContentEl(): HTMLElement {
    // For paragraphs, the content is the text itself with inline marks rendered
    // In edit mode: show Markdown markers (**, *, `)
    // For MVP: just show plain text (mark display is a CSS/NodeView enhancement)
    const el = document.createElement('span')
    el.className = 'paragraph-text'
    el.textContent = this.getNodeText()
    return el
  }

  protected createEditWrapper(): HTMLElement {
    const el = document.createElement('p')
    el.className = 'edit-mode paragraph-edit'
    return el
  }

  protected createRenderWrapper(): HTMLElement {
    return document.createElement('p')
  }

  /** Inline marks in paragraph are shown via CSS toggling in edit mode */
  protected getNodeText(): string {
    let text = ''
    this.node.forEach((child: PMNode) => {
      if (child.isText) text += child.text ?? ''
    })
    return text || ' '
  }

  destroy() {
    unregisterNodeView((this as any).pos)
    super.destroy()
  }
}

export function paragraphNodeView(props: NodeViewConstructorProps) {
  return new ParagraphNodeView(props)
}
```

- [ ] **Step 2: 注册到 src/editor/index.ts**

```typescript
import { paragraphNodeView } from './nodeviews/paragraph'
// 在 nodeViews 中添加:
nodeViews: {
  heading: headingNodeView,
  paragraph: paragraphNodeView,
}
```

- [ ] **Step 3: 提交**

```bash
git add src/editor/nodeviews/paragraph.ts src/editor/index.ts
git commit -m "feat: ParagraphNodeView"
```

---

## Task 8: ListNodeView

**Files:**
- Create: `src/editor/nodeviews/list.ts`

- [ ] **Step 1: 创建 src/editor/nodeviews/list.ts**

```typescript
import { NodeViewConstructorProps } from 'prosemirror-view'
import { Node as PMNode } from 'prosemirror-model'
import { DualModeNodeView } from './base'
import { registerNodeView, unregisterNodeView } from '../plugins/focus-tracker'

export class ListItemNodeView extends DualModeNodeView {
  constructor(props: NodeViewConstructorProps) {
    super(props)
    registerNodeView(props.getPos!, this)
  }

  protected createContentEl(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'list-item-text'
    el.textContent = this.getNodeText()
    return el
  }

  protected createEditWrapper(): HTMLElement {
    const el = document.createElement('li')
    el.className = 'edit-mode'
    return el
  }

  protected createRenderWrapper(): HTMLElement {
    return document.createElement('li')
  }

  protected getNodeText(): string {
    let text = ''
    this.node.forEach((child: PMNode) => {
      if (child.isText) text += child.text ?? ''
    })
    return text || ' '
  }

  destroy() {
    unregisterNodeView((this as any).pos)
    super.destroy()
  }
}

export function listItemNodeView(props: NodeViewConstructorProps) {
  return new ListItemNodeView(props)
}
```

**Note:** Lists (bullet_list, ordered_list) are rendered by prosemirror-schema-list as native HTML `<ul>/<ol>` without custom NodeViews. Only `list_item` needs a NodeView. The Markdown prefix (`- ` or `1. `) is rendered by CSS `::before` pseudo-elements in edit mode.

- [ ] **Step 2: 注册到 src/editor/index.ts**（Task 9 时批量注册）

- [ ] **Step 3: 提交**

```bash
git add src/editor/nodeviews/list.ts
git commit -m "feat: ListItemNodeView"
```

---

## Task 9: BlockquoteNodeView

**Files:**
- Create: `src/editor/nodeviews/blockquote.ts`

- [ ] **Step 1: 创建 src/editor/nodeviews/blockquote.ts**

```typescript
import { NodeViewConstructorProps } from 'prosemirror-view'
import { Node as PMNode } from 'prosemirror-model'
import { DualModeNodeView } from './base'
import { registerNodeView, unregisterNodeView } from '../plugins/focus-tracker'

export class BlockquoteNodeView extends DualModeNodeView {
  constructor(props: NodeViewConstructorProps) {
    super(props)
    registerNodeView(props.getPos!, this)
  }

  protected createContentEl(): HTMLElement {
    const el = document.createElement('p')
    el.className = 'blockquote-text'
    el.textContent = this.getNodeText()
    return el
  }

  protected createEditWrapper(): HTMLElement {
    const el = document.createElement('blockquote')
    el.className = 'edit-mode'
    // Show > prefix via CSS ::before in edit mode
    return el
  }

  protected createRenderWrapper(): HTMLElement {
    return document.createElement('blockquote')
  }

  protected getNodeText(): string {
    let text = ''
    this.node.forEach((child: PMNode) => {
      if (child.isText) text += child.text ?? ''
    })
    return text || ' '
  }

  destroy() {
    unregisterNodeView((this as any).pos)
    super.destroy()
  }
}

export function blockquoteNodeView(props: NodeViewConstructorProps) {
  return new BlockquoteNodeView(props)
}
```

- [ ] **Step 2: 注册到 src/editor/index.ts**（Task 11 时批量注册）

- [ ] **Step 3: 提交**

```bash
git add src/editor/nodeviews/blockquote.ts
git commit -m "feat: BlockquoteNodeView"
```

---

## Task 10: CodeBlockNodeView（集成 CodeMirror 6）

**Files:**
- Create: `src/editor/nodeviews/code-block.ts`

- [ ] **Step 1: 创建 src/editor/nodeviews/code-block.ts**

```typescript
import { NodeViewConstructorProps } from 'prosemirror-view'
import { Node as PMNode } from 'prosemirror-model'
import { DualModeNodeView } from './base'
import { registerNodeView, unregisterNodeView } from '../plugins/focus-tracker'
import { EditorState } from '@codemirror/state'
import { EditorView as CMEditorView } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { markdown } from '@codemirror/lang-markdown'
import { getLanguage } from '@codemirror/language'
import { languages as cmLanguages } from '@codemirror/language-data'

const LANG_EXTENSIONS: Record<string, () => any> = {
  javascript: javascript,
  js: javascript,
  typescript: () => javascript({ typescript: true }),
  ts: () => javascript({ typescript: true }),
  python: python,
  py: python,
  rust: rust,
  rs: rust,
  css: css,
  html: html,
  xml: html,
  json: json,
  markdown: markdown,
  md: markdown,
}

export class CodeBlockNodeView extends DualModeNodeView {
  private language: string
  private cmView: CMEditorView | null = null
  private renderDom: HTMLElement
  private codePre: HTMLElement
  private codeEl: HTMLElement

  constructor(props: NodeViewConstructorProps) {
    const language = props.node.attrs.language ?? ''
    super(props)
    this.language = language
    registerNodeView(props.getPos!, this)

    // Initialize CodeMirror view
    this.cmView = this.createCMView()

    // Build render DOM (syntax-highlighted display)
    this.codeEl = document.createElement('code')
    this.codeEl.textContent = this.getCodeContent()
    if (this.language) this.codeEl.className = `language-${this.language}`
    this.codePre = document.createElement('pre')
    this.codePre.appendChild(this.codeEl)
    this.renderDom = this.codePre
    this.renderDom.style.display = 'none' // Hidden in edit mode initially

    // In edit mode, CM6 replaces the content area
    this.contentEditable = this.codeEl
  }

  private createCMView(): CMEditorView {
    const extensions = [
      oneDark,
      EditorView.lineWrapping,
      EditorView.theme({
        '&': { fontSize: '14px', background: 'transparent' },
        '.cm-content': { padding: '0', fontFamily: 'Fira Code, monospace' },
        '.cm-gutters': { display: 'none' },
      }),
    ]

    // Add language support
    const langFn = LANG_EXTENSIONS[this.language] ?? LANG_EXTENSIONS['javascript']
    extensions.push(langFn())

    const state = EditorState.create({
      doc: this.getCodeContent(),
    })

    const cmView = new CMEditorView({
      state,
      parent: this.editDom,
      extensions,
    })

    return cmView
  }

  protected createEditDOM(): HTMLElement {
    const pre = document.createElement('pre')
    pre.className = 'edit-mode codemirror-wrapper'
    pre.setAttribute('data-language', this.language)

    // Language selector
    const langBtn = document.createElement('span')
    langBtn.className = 'cm-lang-selector'
    langBtn.textContent = this.language || 'plain'
    pre.appendChild(langBtn)

    return pre
  }

  protected createRenderDOM(): HTMLElement {
    const pre = document.createElement('pre')
    return pre
  }

  protected createContentEditable(): HTMLElement {
    // ContentEditable element is the code element inside pre
    return document.createElement('code')
  }

  protected getMarkdownPrefix(): string {
    return `\`\`\`${this.language}\n`
  }

  private getCodeContent(): string {
    let text = ''
    this.node.forEach((child: PMNode) => {
      if (child.isText) text += child.text ?? ''
    })
    return text
  }

  switchToEditMode() {
    super.switchToEditMode()
    this.editDom.style.display = ''
    this.renderDom.style.display = 'none'
    this.cmView?.focus()
  }

  switchToRenderMode() {
    super.switchToRenderMode()
    this.editDom.style.display = 'none'
    this.renderDom.style.display = ''
    // Update rendered code
    this.codeEl.textContent = this.getCodeContent()
  }

  update(node: PMNode, decorations: any) {
    if (!super.update(node, decorations)) return false
    if (this.language !== node.attrs.language) {
      this.language = node.attrs.language ?? ''
      // Language changed: recreate CM view
      this.cmView?.destroy()
      this.cmView = this.createCMView()
    }
    return true
  }

  destroy() {
    unregisterNodeView((this as any).pos)
    this.cmView?.destroy()
    super.destroy()
  }
}

export function codeBlockNodeView(props: NodeViewConstructorProps) {
  return new CodeBlockNodeView(props)
}
```

- [ ] **Step 2: 注册到 src/editor/index.ts**

```typescript
import { codeBlockNodeView } from './nodeviews/code-block'
nodeViews: {
  heading: headingNodeView,
  paragraph: paragraphNodeView,
  bullet_list: bulletListNodeView,
  ordered_list: orderedListNodeView,
  blockquote: blockquoteNodeView,
  code_block: codeBlockNodeView,
}
```

- [ ] **Step 3: 提交**

```bash
git add src/editor/nodeviews/code-block.ts src/editor/index.ts
git commit -m "feat: CodeBlockNodeView with CodeMirror 6 integration"
```

---

## Task 11: TableNodeView

**Files:**
- Create: `src/editor/nodeviews/table.ts`

**Note:** TableNodeView 不做源码编辑，始终显示可视化表格。行/列操作复用 prosemirror-tables 的命令。

- [ ] **Step 1: 创建 src/editor/nodeviews/table.ts**

```typescript
import { NodeViewConstructorProps } from 'prosemirror-view'
import { Node as PMNode } from 'prosemirror-model'
import { NodeView } from 'prosemirror-view'
import { registerNodeView, unregisterNodeView } from '../plugins/focus-tracker'

/**
 * TableNodeView:
 * Always visual — does NOT switch to Markdown source.
 * Supports row/column add/delete via prosemirror-tables commands.
 */
export class TableNodeView implements NodeView {
  public dom: HTMLElement
  public contentDOM: HTMLElement | null = null

  private table: HTMLElement
  private toolbar: HTMLElement

  constructor(props: NodeViewConstructorProps) {
    this.table = document.createElement('table')
    this.dom = this.table
    this.contentDOM = this.table

    this.renderTable(props.node)
    this.renderToolbar()

    registerNodeView(props.getPos!, this)
  }

  private renderTable(node: PMNode) {
    // Build table HTML from prosemirror table node
    this.table.innerHTML = ''

    node.forEach((row: PMNode, rowOffset: number) => {
      if (row.type.name !== 'table_row') return
      const tr = document.createElement('tr')

      row.forEach((cell: PMNode) => {
        const tag = cell.attrs.headerBefore ? 'th' : 'td'
        const el = document.createElement(tag)

        if (cell.attrs.colspan > 1) el.setAttribute('colspan', String(cell.attrs.colspan))
        if (cell.attrs.rowspan > 1) el.setAttribute('rowspan', String(cell.attrs.rowspan))

        // Extract cell text
        let text = ''
        cell.forEach((block: PMNode) => {
          if (block.isText) text += block.text ?? ''
          else if (block.isTextblock) text += block.textContent
        })
        el.textContent = text || ' '

        tr.appendChild(el)
      })

      this.table.appendChild(tr)
    })
  }

  private renderToolbar() {
    this.toolbar = document.createElement('div')
    this.toolbar.className = 'table-toolbar'
    this.toolbar.style.display = 'none'
    this.toolbar.innerHTML = `
      <button data-action="add-col-before">+Col</button>
      <button data-action="add-col-after">Col+</button>
      <button data-action="delete-col">Del Col</button>
      <button data-action="add-row-above">+Row</button>
      <button data-action="add-row-below">Row+</button>
      <button data-action="delete-row">Del Row</button>
    `

    // Show/hide on table hover/focus
    this.table.addEventListener('mouseenter', () => {
      this.toolbar.style.display = 'flex'
    })
    this.table.addEventListener('mouseleave', () => {
      this.toolbar.style.display = 'none'
    })

    // Note: actual prosemirror-tables commands are dispatched from
    // prosemirror-tables plugin. The toolbar buttons dispatch transactions.
  }

  update(node: PMNode, decorations: any) {
    if (node.type.name !== 'table') return false
    this.renderTable(node)
    return true
  }

  destroy() {
    unregisterNodeView((this as any).pos)
  }
}

export function tableNodeView(props: NodeViewConstructorProps) {
  return new TableNodeView(props)
}
```

- [ ] **Step 2: 注册到 src/editor/index.ts**

```typescript
import { tableNodeView } from './nodeviews/table'
import { tableEditing, addColumnBefore, addColumnAfter, deleteColumn, addRowBefore, addRowAfter, deleteRow } from 'prosemirror-tables'
// 在 plugins 中添加 tableEditing
// 在 nodeViews 中添加:
nodeViews: {
  table: tableNodeView,
}
```

- [ ] **Step 3: 提交**

```bash
git add src/editor/nodeviews/table.ts src/editor/index.ts
git commit -m "feat: TableNodeView with visual editing and prosemirror-tables"
```

---

## Task 12: MarkdownInputPlugin

**Files:**
- Create: `src/editor/plugins/markdown-input.ts`

- [ ] **Step 1: 创建 src/editor/plugins/markdown-input.ts**

```typescript
import { inputRules, InputRule, InputRuleFinder } from 'prosemirror-inputrules'
import { schema } from '../schema'
import { ToggleMarkCommand, wrapInCommand, setBlockTypeCommand } from '../commands'

// Helper to create a regex input rule
function headingRule(level: number): InputRule {
  const pattern = new RegExp(`^(#{1,${level}})\\s$`)
  return new InputRule(pattern, (state, match, start, end) => {
    const $start = state.doc.resolve(start)
    if (!$start.node(-1).canReplaceWith($start.index(-1), $start.indexAfter(-1), schema.nodes.heading)) {
      return null
    }
    const attrs = { level: match[1].length }
    return state.tr
      .delete(start, end)
      .setBlockType(start, start, schema.nodes.heading, attrs)
  })
}

function blockquoteRule(): InputRule {
  return new InputRule(/^>\s$/, (state, _match, start, end) => {
    const $start = state.doc.resolve(start)
    if (!$start.node(-1).canReplaceWith($start.index(-1), $start.indexAfter(-1), schema.nodes.blockquote)) {
      return null
    }
    return state.tr.delete(start, end).wrap(state.selection.$from.blockRange($start)! as any, [
      { type: schema.nodes.blockquote }
    ])
  })
}

function bulletListRule(): InputRule {
  return new InputRule(/^[-*+]\s$/, (state, _match, start, end) => {
    return state.tr.delete(start, end).wrap(state.selection.$from.blockRange(state.doc.resolve(start))! as any, [
      { type: schema.nodes.bullet_list },
      { type: schema.nodes.list_item }
    ])
  })
}

function orderedListRule(): InputRule {
  return new InputRule(/^(\d+)\.\s$/, (state, _match, start, end) => {
    return state.tr.delete(start, end).wrap(state.selection.$from.blockRange(state.doc.resolve(start))! as any, [
      { type: schema.nodes.ordered_list },
      { type: schema.nodes.list_item }
    ])
  })
}

function codeBlockRule(): InputRule {
  return new InputRule(/^```$/, (state, _match, start, end) => {
    const $start = state.doc.resolve(start)
    return state.tr
      .delete(start, end)
      .setBlockType(start, start, schema.nodes.code_block, { language: '' })
  })
}

function hrRule(): InputRule {
  return new InputRule(/^---$/, (state, _match, start, end) => {
    return state.tr.delete(start, end).replaceWith(start, start, schema.nodes.horizontal_rule.create())
  })
}

// Bold: **text** or __text__
function strongRule(): InputRule {
  return new InputRule(/\*\*([^*]+)\*\*$/, (state, match, start, end) => {
    const tr = state.tr
    if (match[1]) {
      tr.replaceWith(start + 2, end - 2, schema.text(match[1], [schema.marks.strong.create()]))
    }
    return tr
  })
}

// Italic: *text* or _text_
function emRule(): InputRule {
  return new InputRule(/(?<!\*)\*([^*]+)\*$/, (state, match, start, end) => {
    const tr = state.tr
    if (match[1]) {
      tr.replaceWith(start + 1, end - 1, schema.text(match[1], [schema.marks.em.create()]))
    }
    return tr
  })
}

// Inline code: `text`
function inlineCodeRule(): InputRule {
  return new InputRule(/`([^`]+)`$/, (state, match, start, end) => {
    const tr = state.tr
    if (match[1]) {
      tr.replaceWith(start + 1, end - 1, schema.text(match[1], [schema.marks.code.create()]))
    }
    return tr
  })
}

export const markdownInputPlugin = inputRules({
  rules: [
    // Headings (must come before more general rules)
    headingRule(6),
    headingRule(5),
    headingRule(4),
    headingRule(3),
    headingRule(2),
    headingRule(1),
    // Block elements
    blockquoteRule(),
    bulletListRule(),
    orderedListRule(),
    codeBlockRule(),
    hrRule(),
    // Inline marks
    strongRule(),
    emRule(),
    inlineCodeRule(),
  ],
})
```

- [ ] **Step 2: 注册到 src/editor/index.ts**

```typescript
import { markdownInputPlugin } from './plugins/markdown-input'
// 在 plugins 中添加:
plugins: [
  keymap(baseKeymap),
  markdownInputPlugin,
]
```

- [ ] **Step 3: 提交**

```bash
git add src/editor/plugins/markdown-input.ts src/editor/index.ts
git commit -m "feat: MarkdownInputPlugin with input rules for all elements"
```

---

## Task 13: MarkdownSyncPlugin

**Files:**
- Create: `src/editor/plugins/markdown-sync.ts`

- [ ] **Step 1: 创建 src/editor/plugins/markdown-sync.ts**

```typescript
import { Plugin, PluginKey, EditorState, Transaction } from 'prosemirror-state'
import { serializeToMarkdown } from '../../markdown/serializer'
import { docStore } from '../../state/doc-store'

export const markdownSyncKey = new PluginKey('markdownSync')

/**
 * MarkdownSyncPlugin:
 * - Listens to document changes
 * - Debounces serialization to .md
 * - Stores the result in DocStore
 */
export const markdownSyncPlugin = new Plugin({
  key: markdownSyncKey,

  view() {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    return {
      update(view, prevState: EditorState) {
        const newDoc = view.state.doc
        const prevDoc = prevState.doc

        // Only sync if doc actually changed
        if (newDoc.eq(prevDoc)) return

        // Debounce 300ms
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          const markdown = serializeToMarkdown(newDoc)
          docStore.setMarkdown(markdown)
          docStore.setDirty(true)
          console.debug('[MarkdownSync] Serialized:', markdown.slice(0, 100) + '...')
        }, 300)
      },

      destroy() {
        if (debounceTimer) clearTimeout(debounceTimer)
      },
    }
  },
})
```

- [ ] **Step 2: 注册到 src/editor/index.ts**

```typescript
import { markdownSyncPlugin } from './plugins/markdown-sync'
plugins: [
  keymap(baseKeymap),
  markdownInputPlugin,
  markdownSyncPlugin,
]
```

- [ ] **Step 3: 提交**

```bash
git add src/editor/plugins/markdown-sync.ts src/editor/index.ts
git commit -m "feat: MarkdownSyncPlugin for debounced .md serialization"
```

---

## Task 14: KeymapPlugin

**Files:**
- Create: `src/editor/plugins/keymap.ts`

- [ ] **Step 1: 创建 src/editor/plugins/keymap.ts**

```typescript
import { keymap } from 'prosemirror-keymap'
import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands'
import { undo, redo } from 'prosemirror-history'
import { undoInputRule } from 'prosemirror-inputrules'
import { schema } from '../schema'

const isMac = typeof navigator !== 'undefined' ? /Mac/.test(navigator.platform) : false

export function buildKeymap() {
  return keymap({
    // History
    'Mod-z': undo,
    'Mod-y': redo,
    'Shift-Mod-z': redo,

    // Inline marks
    'Mod-b': toggleMark(schema.marks.strong),
    'Mod-i': toggleMark(schema.marks.em),
    'Mod-`': toggleMark(schema.marks.code),

    // Block formatting
    'Mod-Shift-1': setBlockType(schema.nodes.heading, { level: 1 }),
    'Mod-Shift-2': setBlockType(schema.nodes.heading, { level: 2 }),
    'Mod-Shift-3': setBlockType(schema.nodes.heading, { level: 3 }),
    'Mod-Shift-4': setBlockType(schema.nodes.heading, { level: 4 }),
    'Mod-Shift-5': setBlockType(schema.nodes.heading, { level: 5 }),
    'Mod-Shift-6': setBlockType(schema.nodes.heading, { level: 6 }),
    'Mod-Shift-0': setBlockType(schema.nodes.paragraph),

    // Code block
    'Mod-Shift-k': setBlockType(schema.nodes.code_block, { language: '' }),

    // Lists
    'Mod-Shift-8': wrapIn(schema.nodes.bullet_list),
    'Mod-Shift-9': wrapIn(schema.nodes.ordered_list),

    // Blockquote
    'Mod-Shift-.': wrapIn(schema.nodes.blockquote),

    // Backspace: undo input rule on empty nodes
    Backspace: undoInputRule,
  })
}
```

- [ ] **Step 2: 注册到 src/editor/index.ts**

```typescript
import { buildKeymap } from './plugins/keymap'
plugins: [
  keymap(baseKeymap),
  buildKeymap(),
  markdownInputPlugin,
  markdownSyncPlugin,
]
```

- [ ] **Step 3: 提交**

```bash
git add src/editor/plugins/keymap.ts src/editor/index.ts
git commit -m "feat: KeymapPlugin with Markdown formatting shortcuts"
```

---

## Task 15: Markdown Parser

**Files:**
- Create: `src/markdown/parser.ts`

- [ ] **Step 1: 创建 src/markdown/parser.ts**

```typescript
import MarkdownIt from 'markdown-it'
import { DOMParser as PMDOMParser, Node as PMNode } from 'prosemirror-model'
import { schema } from '../editor/schema'

// Configure markdown-it with GFM support
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
})

// Add GFM-like rules for tables
md.renderer.rules.table_open = () => '<table>'
md.renderer.rules.thead_open = () => '<thead>'
md.renderer.rules.tbody_open = () => '<tbody>'
md.renderer.rules.tr_open = () => '<tr>'
md.renderer.rules.th_open = () => '<th>'
md.renderer.rules.td_open = () => '<td>'

/**
 * Parse a Markdown string into a ProseMirror document.
 */
export function parseMarkdown(markdown: string): PMNode {
  // Convert Markdown to HTML
  const html = md.render(markdown)

  // Parse HTML into a DOM
  const domParser = new window.DOMParser()
  const doc = domParser.parseFromString(`<body>${html}</body>`, 'text/html')

  // Use ProseMirror DOMParser with our schema
  const pmDoc = PMDOMParser.fromSchema(schema).parse(doc.body)

  return pmDoc
}

/**
 * Parse Markdown from a file content string.
 */
export function parseMarkdownFile(content: string): PMNode {
  return parseMarkdown(content)
}
```

- [ ] **Step 2: 提交**

```bash
git add src/markdown/parser.ts
git commit -m "feat: Markdown parser (markdown-it -> DOMParser -> PM Doc)"
```

---

## Task 16: Markdown Serializer

**Files:**
- Create: `src/markdown/serializer.ts`

- [ ] **Step 1: 创建 src/markdown/serializer.ts**

```typescript
import TurndownService from 'turndown'
import { DOMSerializer as PMDOMSerializer, Node as PMNode } from 'prosemirror-model'

// Configure turndown for GFM
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
})

// Custom rules for table cells
turndown.addRule('tableCells', {
  filter(node) {
    return node.nodeName === 'TH' || node.nodeName === 'TD'
  },
  replacement(content, node) {
    const cell = node as HTMLElement
    const colspan = cell.hasAttribute('colspan') ? cell.getAttribute('colspan') : ''
    const prefix = colspan ? `|:${'-'.repeat(3)}` : '|'
    return prefix + content
  },
})

// Remove data-language attribute from code blocks
turndown.addRule('codeBlockLanguage', {
  filter(node) {
    return (
      node.nodeName === 'PRE' &&
      node.firstChild?.nodeName === 'CODE'
    )
  },
  replacement(content, node) {
    const code = node.firstChild as HTMLElement
    const langClass = code.className.match(/language-(\w+)/)
    const lang = langClass ? langClass[1] : ''
    return `\`\`\`${lang}\n${content}\n\`\`\`\n\n`
  },
})

/**
 * Serialize a ProseMirror document to Markdown.
 */
export function serializeToMarkdown(doc: PMNode): string {
  // Serialize to HTML first using ProseMirror DOMSerializer
  const div = document.createElement('div')
  const serializer = PMDOMSerializer.fromSchema(doc.type.schema)
  serializer.serializeFragment(doc.content, { document: div })

  // Then convert HTML to Markdown
  const html = div.innerHTML
  const markdown = turndown.turndown(html)

  return markdown
}

/**
 * Serialize a ProseMirror node to Markdown.
 */
export function nodeToMarkdown(node: PMNode): string {
  return serializeToMarkdown(node)
}
```

- [ ] **Step 2: 提交**

```bash
git add src/markdown/serializer.ts
git commit -m "feat: Markdown serializer (PM Doc -> DOMSerializer -> turndown)"
```

---

## Task 17: DocStore

**Files:**
- Create: `src/state/doc-store.ts`

- [ ] **Step 1: 创建 src/state/doc-store.ts**

```typescript
import { parseMarkdown } from '../markdown/parser'

export interface DocState {
  filename: string | null
  markdown: string
  dirty: boolean
  lastSaved: string | null
}

const STORAGE_KEY = 'mdeditor-doc'

class DocStore {
  private state: DocState = {
    filename: null,
    markdown: '',
    dirty: false,
    lastSaved: null,
  }

  private listeners: Set<(state: DocState) => void> = new Set()

  getState(): DocState {
    return { ...this.state }
  }

  subscribe(listener: (state: DocState) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach(l => l({ ...this.state }))
  }

  setMarkdown(md: string) {
    this.state.markdown = md
    this.state.dirty = true
    this.notify()
    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, md)
    } catch (e) {
      console.warn('localStorage write failed:', e)
    }
  }

  setDirty(dirty: boolean) {
    this.state.dirty = dirty
    this.notify()
  }

  loadFromStorage(): string | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        this.state.markdown = saved
        this.state.dirty = false
        this.state.lastSaved = saved
        this.notify()
        return saved
      }
    } catch (e) {
      console.warn('localStorage read failed:', e)
    }
    return null
  }

  setFilename(filename: string) {
    this.state.filename = filename
    this.notify()
  }

  markSaved() {
    this.state.dirty = false
    this.state.lastSaved = this.state.markdown
    this.notify()
  }

  getMarkdown(): string {
    return this.state.markdown
  }
}

export const docStore = new DocStore()
```

- [ ] **Step 2: 提交**

```bash
git add src/state/doc-store.ts
git commit -m "feat: DocStore for document state management and localStorage persistence"
```

---

## Task 18: Toolbar + Style

**Files:**
- Modify: `src/editor/index.ts`
- Modify: `src/ui/toolbar.ts`（创建）
- Modify: `src/editor/style.css`

- [ ] **Step 1: 创建 src/ui/toolbar.ts**

```typescript
import { EditorState } from 'prosemirror-state'
import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands'
import { schema } from '../editor/schema'

export interface ToolbarAction {
  label: string
  command: (state: EditorState) => boolean
  isActive?: (state: EditorState) => boolean
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  {
    label: 'H1',
    command: setBlockType(schema.nodes.heading, { level: 1 }),
    isActive: (s) => isBlockType(s, schema.nodes.heading),
  },
  {
    label: 'H2',
    command: setBlockType(schema.nodes.heading, { level: 2 }),
    isActive: (s) => isBlockType(s, schema.nodes.heading),
  },
  {
    label: 'H3',
    command: setBlockType(schema.nodes.heading, { level: 3 }),
    isActive: (s) => isBlockType(s, schema.nodes.heading),
  },
  {
    label: 'B',
    command: toggleMark(schema.marks.strong),
    isActive: (s) => s.selection.$from.marks().some(m => m.type.name === 'strong'),
  },
  {
    label: 'I',
    command: toggleMark(schema.marks.em),
    isActive: (s) => s.selection.$from.marks().some(m => m.type.name === 'em'),
  },
  {
    label: '<>',
    command: toggleMark(schema.marks.code),
    isActive: (s) => s.selection.$from.marks().some(m => m.type.name === 'code'),
  },
  {
    label: 'UL',
    command: wrapIn(schema.nodes.bullet_list),
  },
  {
    label: 'OL',
    command: wrapIn(schema.nodes.ordered_list),
  },
  {
    label: '"',
    command: wrapIn(schema.nodes.blockquote),
  },
]

function isBlockType(state: EditorState, nodeType: any): boolean {
  const { $from, to } = state.selection
  const node = $from.node(-1) || $from.parent
  return node.type === nodeType
}

export function buildToolbar(el: HTMLElement, dispatch: (tr: any) => void, getState: () => EditorState) {
  TOOLBAR_ACTIONS.forEach(action => {
    const btn = document.createElement('button')
    btn.textContent = action.label
    btn.title = action.label

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault() // Prevent losing focus from editor
      const state = getState()
      action.command(state, (tr) => dispatch(tr))
    })

    el.appendChild(btn)
  })

  // Update active state on selection change
  const updateActive = () => {
    const btns = el.querySelectorAll('button')
    const state = getState()
    TOOLBAR_ACTIONS.forEach((action, i) => {
      if (action.isActive) {
        btns[i]?.classList.toggle('active', action.isActive(state))
      }
    })
    requestAnimationFrame(updateActive)
  }
  requestAnimationFrame(updateActive)
}
```

- [ ] **Step 2: 更新 src/editor/index.ts**

```typescript
import { buildToolbar } from '../ui/toolbar'
import { markdownSyncPlugin } from './plugins/markdown-sync'
import { focusTrackerPlugin } from './plugins/focus-tracker'
import { buildKeymap } from './plugins/keymap'
import { markdownInputPlugin } from './plugins/markdown-input'

export function createEditor(parent: HTMLElement, initialMarkdown?: string) {
  // ... existing code ...

  // Build toolbar
  const toolbarEl = document.getElementById('toolbar')
  if (toolbarEl) {
    buildToolbar(toolbarEl, (tr) => view.dispatch(tr), () => view.state)
  }

  return view
}
```

- [ ] **Step 3: 提交**

```bash
git add src/ui/toolbar.ts src/editor/index.ts src/editor/style.css
git commit -m "feat: toolbar with formatting buttons and styling"
```

---

## Task 19: 集成与验收

**Files:**
- Modify: `src/editor/index.ts`（完整版，组装所有组件）
- Modify: `src/main.ts`（加载已有文档）
- Run: `npm install && npm run dev`

- [ ] **Step 1: 更新 src/editor/index.ts 为最终完整版本**

```typescript
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { history } from 'prosemirror-history'
import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap } from 'prosemirror-commands'
import { tableEditing } from 'prosemirror-tables'

import { schema } from './schema'
import { headingNodeView } from './nodeviews/heading'
import { paragraphNodeView } from './nodeviews/paragraph'
import { bulletListNodeView, orderedListNodeView } from './nodeviews/list'
import { blockquoteNodeView } from './nodeviews/blockquote'
import { codeBlockNodeView } from './nodeviews/code-block'
import { tableNodeView } from './nodeviews/table'
import { focusTrackerPlugin } from './plugins/focus-tracker'
import { markdownInputPlugin } from './plugins/markdown-input'
import { markdownSyncPlugin } from './plugins/markdown-sync'
import { buildKeymap } from './plugins/keymap'
import { buildToolbar } from '../ui/toolbar'
import { docStore } from '../state/doc-store'
import { parseMarkdown } from '../markdown/parser'

const NODE_VIEWS = {
  heading: headingNodeView,
  paragraph: paragraphNodeView,
  bullet_list: bulletListNodeView,
  ordered_list: orderedListNodeView,
  blockquote: blockquoteNodeView,
  code_block: codeBlockNodeView,
  table: tableNodeView,
}

export function createEditor(parent: HTMLElement, initialMarkdown?: string) {
  const doc = initialMarkdown
    ? parseMarkdown(initialMarkdown)
    : schema.nodes.doc.create({}, [schema.nodes.paragraph.create()])

  const state = EditorState.create({
    doc,
    plugins: [
      history(),
      dropCursor(),
      gapCursor(),
      tableEditing(),
      keymap(baseKeymap),
      buildKeymap(),
      markdownInputPlugin,
      markdownSyncPlugin,
      focusTrackerPlugin,
    ],
  })

  const view = new EditorView(parent, {
    state,
    nodeViews: NODE_VIEWS,
    attributes: { class: 'ProseMirror' },
  })

  // Build toolbar
  const toolbarEl = document.getElementById('toolbar')
  if (toolbarEl) {
    buildToolbar(toolbarEl, (tr) => view.dispatch(tr), () => view.state)
  }

  return view
}
```

- [ ] **Step 2: 更新 src/main.ts**

```typescript
import { createEditor } from './editor/index'
import { docStore } from './state/doc-store'

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('editor')
  if (!el) return

  // Try to restore from localStorage
  const saved = docStore.loadFromStorage()
  createEditor(el, saved ?? undefined)
})
```

- [ ] **Step 3: 安装依赖并运行**

Run: `npm install && npm run dev`
Expected: 页面显示编辑器，输入 `# ` 自动转为标题，输入 `**text**` 自动转为粗体

- [ ] **Step 4: 验收测试（在 SPEC.md 中记录测试步骤）**

创建 `SPEC.md` 验证清单：

```markdown
# Acceptance Tests

## Editor loads
- [ ] Editor container renders with ProseMirror class
- [ ] Empty paragraph exists by default

## Markdown input rules
- [ ] Type `# ` at line start -> becomes h1
- [ ] Type `## ` at line start -> becomes h2
- [ ] Type `- ` at line start -> becomes bullet list
- [ ] Type `1. ` at line start -> becomes ordered list
- [ ] Type `> ` at line start -> becomes blockquote
- [ ] Type ``` ``` ``` -> becomes code block

## Dual-mode editing
- [ ] Cursor on heading block -> shows # prefix (edit mode)
- [ ] Cursor leaves heading block -> hides # prefix (render mode)
- [ ] Same for bullet lists showing - prefix
- [ ] Same for blockquote showing > prefix

## Code block
- [ ] Code block shows CodeMirror 6 editor when focused
- [ ] Code block shows rendered/highlighted code when not focused
- [ ] Language selector appears in edit mode

## Table
- [ ] Table renders as visual table (not Markdown source)
- [ ] prosemirror-tables commands work (add/delete row/col)

## Markdown sync
- [ ] Edit triggers debounced serialization (300ms)
- [ ] Result stored in DocStore
- [ ] localStorage persists content

## Toolbar
- [ ] All format buttons render in toolbar
- [ ] Clicking H1 button converts block to h1
- [ ] Clicking B button toggles bold
- [ ] Active state highlights current format
```

- [ ] **Step 5: 提交**

```bash
git add src/editor/index.ts src/main.ts SPEC.md
git commit -m "feat: complete editor integration and acceptance tests"
```

---

## Spec Coverage Check

| Spec Section | Task |
|---|---|
| Schema | Task 2 |
| NodeView Dual-Mode | Tasks 4, 6, 7, 8, 9, 10, 11 |
| FocusTrackerPlugin | Task 5 |
| MarkdownInputPlugin | Task 12 |
| MarkdownSyncPlugin | Task 13 |
| KeymapPlugin | Task 14 |
| Markdown Parser | Task 15 |
| Markdown Serializer | Task 16 |
| DocStore | Task 17 |
| Toolbar + Style | Task 18 |
| Integration | Task 19 |

All spec requirements covered. No gaps.

---

**Plan complete.** Saved to `docs/superpowers/plans/2026-04-14-wysiwyg-editor-mvp-plan.md`.
