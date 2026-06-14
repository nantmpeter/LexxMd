# Markdown WYSIWYG Editor — Tauri 2.0 + Tiptap MVP Design

> Date: 2026-04-14
> Version: 2.0 (revised from v1)
> Status: Draft — pending approval

---

## 1. Goal

Build a Typora-style instant-rendering Markdown WYSIWYG desktop editor. The core UX: **cursor enters a block → show Markdown syntax markers; cursor leaves → show rendered result**. This is a production-ready MVP built on **Tauri 2.0 + Tiptap + Rust backend**, not a throwaway prototype.

Key principles:
- **End-state architecture from day one.** No prototype-to-production migration cost.
- **Progressive performance.** JS-first for speed-to-market; Rust backend interfaces reserved for later optimization.
- **Typora UX fidelity.** The dual-mode editing experience is the product's core differentiator and must be preserved.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Tauri 2.0 Desktop Shell                 │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Frontend (WebView / Vite)               │    │
│  │                                                       │    │
│  │  Tiptap Editor                                        │    │
│  │  ├── Core Extensions (StarterKit, Typography, etc.)  │    │
│  │  ├── Markdown Extension (doc ↔ md bidirectional)   │    │
│  │  ├── DualModeNodeView (custom Node Extension)         │    │
│  │  │     └── SelectionTracker: drives edit/render switch│    │
│  │  ├── CodeBlockHighlight (syntect via worker, later)  │    │
│  │  │     └── MVP: CSS class-based syntax highlighting   │    │
│  │  └── Table Extension (visual, no md source editing) │    │
│  │                                                       │    │
│  │  State Layer                                          │    │
│  │  └── editorStore: current doc, dirty flag, file path │    │
│  │                                                       │    │
│  │  UI Layer                                             │    │
│  │  └── Toolbar, Sidebar, StatusBar                     │    │
│  └──────────────────────┬────────────────────────────────┘    │
│                         │ Tauri IPC (invoke)                   │
│  ┌──────────────────────▼────────────────────────────────┐    │
│  │              Rust Backend (Tauri Commands)            │    │
│  │                                                       │    │
│  │  file_read(path)       → String                       │    │
│  │  file_write(path, md)  → Result<(), Error>           │    │
│  │  file_save_dialog()     → Option<PathBuf>             │    │
│  │  file_open_dialog()     → Option<(PathBuf, String)>    │    │
│  │  get_app_config()      → AppConfig                   │    │
│  │                                                       │    │
│  │  Future Rust optimizations (via trait interfaces):    │    │
│  │  ├── pulldown_cmark_parse(md) → AST (MarkdownExt)   │    │
│  │  ├── tree_sitter_highlight(src, lang) → Spans       │    │
│  │  └── typst_export(md) → PDF bytes                    │    │
│  └───────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Data flow:**

```
User types → Tiptap transaction → Markdown Extension serializes → Rust file_write()
File opened → Rust file_read() → Tiptap Markdown Extension parses → Editor doc
Cursor moves → SelectionTracker → NodeView mode switch (edit ↔ render)
```

---

## 3. Technology Choices

### 3.1 Tauri 2.0 (Rust Backend)

| Capability | Implementation |
|---|---|
| **File I/O** | `std::fs` — read/write `.md` files |
| **IPC** | Tauri 2.0 `invoke()` commands |
| **Window** | Native titlebar with menu bar |
| **Dialogs** | `@tauri-apps/plugin-dialog` for file open/save |
| **Config** | JSON in app data directory |

**Why not postpone Tauri?** Because the Rust backend is not optional complexity — file I/O is a first-class feature of a desktop Markdown editor. Starting with localStorage and migrating later means rewriting the entire data layer.

### 3.2 Tiptap (Frontend Editor)

Tiptap replaces all native ProseMirror packages.

| Package | Role |
|---|---|
| `@tiptap/core` | Core editor engine |
| `@tiptap/starter-kit` | Basic nodes (heading, paragraph, lists, etc.) |
| `@tiptap/extension-typography` | Smart quotes, dashes |
| `@tiptap/extension-link` | Link marks |
| `@tiptap/extension-code-block-lowlight` | Code block with syntax highlighting |
| `@tiptap/extension-table` | Visual table editing |
| `@tiptap/extension-table-row` | Table row |
| `@tiptap/extension-table-header` | Table header |
| `@tiptap/extension-table-cell` | Table cell |
| `@tiptap/extension-placeholder` | Empty doc placeholder |
| `@tiptap/extension-task-list` | GFM task lists |
| `@tiptap/extension-task-item` | Task list items |
| `@tiptap/pm` | ProseMirror core (included as peer dep) |
| `@tauri-apps/api` | Rust IPC bridge |
| `lowlight` | Syntax highlighting (highlight.js compat layer) |

**Removed from v1:**
- `markdown-it` (~50KB) — replaced by Tiptap Markdown Extension
- `turndown` (~30KB) — replaced by Tiptap Markdown Extension
- `prosemirror-state/view/model/inputrules/keymap` — replaced by Tiptap core
- `prosemirror-tables` — replaced by Tiptap Table Extension
- `prosemirror-history/dropcursor/gapcursor` — included in Tiptap StarterKit

### 3.3 Markdown Serialization (Tiptap-native)

Tiptap's `@tiptap/extension-markdown` (or the community `@tiptap-pro/extension-markdown`) provides:
- Bidirectional sync between editor document and Markdown string
- No separate parse/serialize pipeline in JS
- Future Rust path: the extension's `parse`/`serialize` functions will be replaced by Rust backend calls to `pulldown-cmark`

```typescript
// Tiptap handles this internally:
Editor.create({
  extensions: [
    StarterKit,
    Markdown.configure({
      // Tiptap serializes to/from Markdown on every transaction
      // JS implementation is the default; replace with Rust call:
      serialize: (doc) => invoke('rust_parse_document', { ast: doc }),
      parse: (md) => invoke('rust_serialize_document', { md }),
    }),
  ],
})
```

### 3.4 Code Block Highlighting (Simplified)

| Layer | MVP Approach | Future (Rust) |
|---|---|---|
| **Engine** | `lowlight` (highlight.js compat) | `syntect` via Tauri IPC |
| **Rendering** | CSS classes + highlight.js theme | Same — frontend stays the same |
| **Scope** | 20+ languages | 200+ languages via syntect |
| **Performance** | Good for small/medium blocks | Sub-millisecond for large files |

**Why remove CodeMirror 6?** Embedding a second complex editor (CodeMirror) inside ProseMirror NodeViews creates event collision problems, memory management complexity, and duplicated state. The `CodeBlockLowlight` extension uses a lightweight highlight layer instead, with zero external editor state.

### 3.5 Project Structure

```
mdeditor/
├── src/                          # Vite/TypeScript frontend
│   ├── main.ts                   # Tauri app entry
│   ├── App.ts                    # Root component
│   ├── editor/
│   │   ├── index.ts             # createEditor() — Tiptap instance
│   │   ├── extensions/
│   │   │   ├── dual-mode.ts     # DualModeNodeExtension (FocusTracker)
│   │   │   ├── code-block.ts    # CodeBlockLowlight config
│   │   │   └── markdown.ts       # Tiptap Markdown extension config
│   │   ├── nodeviews/           # (reserved for advanced overrides)
│   │   ├── commands.ts          # Custom Tiptap commands
│   │   └── style.css           # Editor styles + dual-mode CSS
│   ├── state/
│   │   └── editorStore.ts       # Zustand/Custom store: doc, path, dirty
│   ├── ui/
│   │   ├── Toolbar.ts           # Format toolbar
│   │   ├── Sidebar.ts           # File tree (MVP: single file)
│   │   └── StatusBar.ts         # Word count, dirty indicator
│   ├── tauri/
│   │   └── commands.ts          # Tauri IPC wrappers
│   └── lib/
│       └── utils.ts
├── src-tauri/                   # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs              # Tauri app entry
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── file_io.rs       # file_read, file_write
│   │   │   ├── dialog.rs        # save/open dialogs
│   │   │   └── config.rs        # app config
│   │   └── markdown/
│   │       ├── mod.rs           # Trait interface for Markdown processing
│   │       └── js_fallback.rs   # JS fallback (MVP)
│   │       └── pulldown.rs      # pulldown-cmark impl (future)
│   └── icons/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── SPEC.md                      # Acceptance criteria
└── docs/
    └── research/               # Feasibility studies
```

---

## 4. Dual-Mode Editing (Core UX)

### 4.1 Concept

Typora's UX: the document is always rendered visually, but the block under the cursor reveals its Markdown syntax. This creates the illusion of writing in rendered text while actually editing Markdown source.

### 4.2 Tiptap Implementation Strategy

Unlike native ProseMirror where we build NodeViews from scratch, Tiptap's extension model wraps ProseMirror's NodeView system. We implement a **DualMode Node Extension** that injects selection-tracking behavior into all relevant node types.

**Three layers:**

**Layer 1 — SelectionTracker (global, Plugin-level)**

```typescript
// DualModeNodeExtension — a Tiptap Extension that injects a ProseMirror Plugin
const DualModeExtension = Node.create({
  name: 'dualMode',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: dualModePluginKey,
        view() {
          let currentNodePos: number | null = null
          return {
            update(view, prevState) {
              const newPos = getFocusedBlockPos(view.state.selection)
              if (newPos !== currentNodePos) {
                // Switch old block to render mode
                if (currentNodePos !== null) {
                  getNodeView(currentNodePos)?.switchToRenderMode()
                }
                // Switch new block to edit mode
                if (newPos !== null) {
                  getNodeView(newPos)?.switchToEditMode()
                }
                currentNodePos = newPos
              }
            }
          }
        }
      })
    ]
  }
})
```

**Layer 2 — DualModeNodeView (per-node, ProseMirror NodeView interface)**

Each ProseMirror node type (heading, paragraph, list_item, blockquote) has a custom `NodeView` created via `addNodeView()`. Each NodeView maintains two DOM states:

```
Edit mode DOM:   [<span class="md-prefix">## </span><span contenteditable>Heading</span>]
Render mode DOM: [<h2>Heading</h2>]

Both modes share the SAME contenteditable <span> element.
Switching is a pure CSS display toggle (no DOM reparenting):
  .edit-mode .render-wrapper { display: none }
  .render-mode .edit-wrapper { display: none }
```

**Layer 3 — CSS visibility for inline marks**

Inline marks (bold `**`, italic `*`, code `` ` ``) use CSS `::before`/`::after` pseudo-elements on the mark spans in edit mode only:

```css
/* In edit mode, show Markdown markers inline */
.ProseMirror strong::before { content: '**'; color: #999 }
.ProseMirror strong::after  { content: '**'; color: #999 }
.ProseMirror em::before    { content: '*'; color: #999 }
.ProseMirror em::after     { content: '*'; color: #999 }

/* In render mode, hide markers */
.render-mode.ProseMirror strong::before,
.render-mode.ProseMirror strong::after,
.render-mode.ProseMirror em::before,
.render-mode.ProseMirror em::after { content: '' }
```

### 4.3 Block Behaviors

| Block Type | Render Mode | Edit Mode |
|---|---|---|
| Heading (h1-h6) | `<h1>Text</h1>` | `# ` prefix + contenteditable text |
| Paragraph | `<p>Text</p>` | Plain contenteditable (marks via CSS `::before/::after`) |
| Bullet List Item | `<li>Text</li>` | `- ` prefix + contenteditable text |
| Ordered List Item | `<li>Text</li>` | `1. ` prefix + contenteditable text |
| Blockquote | `<blockquote><p>Text</p></blockquote>` | `> ` prefix + contenteditable |
| Code Block | Syntax-highlighted pre | Same (lowlight handles both modes) |
| Table | Visual table | Visual table (always visual, prosemirror-tables) |

### 4.4 Performance Characteristics

- Only two blocks switch per cursor move (old + new)
- No full-document scan
- CSS display toggle: zero JS execution, zero DOM rebuild
- ProseMirror `NodeView` overhead: one instance per visible block (lazy instantiation)

---

## 5. Markdown Pipeline

### 5.1 MVP: Tiptap-native

```
Tiptap Editor Transaction
        │
        ▼
Tiptap Markdown Extension (built-in)
  serialize(doc → md):   Tiptap's JS serializer
  parse(md → doc):        Tiptap's JS parser
        │
        ├──► user edits → debounce 200ms → Tauri invoke('file_write')
        │
        └──► file open → Tauri invoke('file_read') → Tiptap parse → editor doc
```

**Debounce strategy:** File writes are debounced at 200ms. The editor always responds instantly; file persistence is fire-and-forget with dirty indicator.

### 5.2 Future: Rust Backend (preserved interface)

```rust
// src-tauri/src/markdown/mod.rs

pub trait MarkdownProcessor: Send + Sync {
    fn parse(&self, markdown: &str) -> Result<MarkdownAST, Error>;
    fn serialize(&self, ast: &MarkdownAST) -> Result<String, Error>;
    fn highlight(&self, code: &str, lang: &str) -> Result<Vec<HighlightSpan>, Error>;
}

// MVP implementation: delegates to JS (Tiptap's built-in)
// Future: pulldown-cmark via wasm-bindgen or direct Rust calls
```

This trait interface is defined in the MVP stage but implemented by a JS fallback. When Rust implementation is ready, it drops in without frontend changes.

---

## 6. File Operations (Rust Backend)

### 6.1 Tauri Commands

```rust
#[tauri::command]
fn file_read(path: String) -> Result<String, String>

#[tauri::command]
fn file_write(path: String, content: String) -> Result<(), String>

#[tauri::command]
fn file_save_dialog(default_name: Option<String>) -> Result<Option<SaveDialogResult>, String>

#[tauri::command]
fn file_open_dialog() -> Result<Option<OpenDialogResult>, String>

#[tauri::command]
fn get_recent_files() -> Result<Vec<RecentFile>, String>
```

### 6.2 Auto-save Strategy

- Dirty indicator in status bar when unsaved changes exist
- `Cmd/Ctrl+S` triggers immediate `file_write`
- Auto-save to temp file every 30 seconds (configurable)
- On app close with dirty doc: prompt to save

---

## 7. UI Components

### 7.1 Toolbar

```
[H1] [H2] [H3] | [B] [I] [S] [`] | [Link] | [UL] [OL] ["] | [Code] | [Table] | [Divider]
```

Implemented as Tiptap `command` invocations (`toggleHeading`, `toggleBold`, etc.) bound to toolbar button clicks.

### 7.2 Status Bar

```
[left] Untitled.md · 342 words · 2,108 chars     [right] Markdown · UTF-8 · LF
```

### 7.3 MVP Scope

| In MVP | Post-MVP |
|---|---|
| Single file editing | File tree / multi-tab |
| Basic toolbar | Floating format menu |
| Status bar (word count) | Sidebar with outline |
| Menu bar (File/Edit/View) | Command palette |
| Dark/Light theme toggle | Custom theme CSS |

---

## 8. Acceptance Criteria

1. Open a `.md` file from disk → renders with Typora-style WYSIWYG
2. Cursor enters heading → `#` prefix appears inline
3. Cursor leaves heading → `#` prefix hides, rendered heading visible
4. Type `# ` at line start → automatically creates heading
5. Type `**text**` → automatically wraps in bold mark (CSS shows `**` markers in edit mode)
6. Code block renders with syntax highlighting (lowlight)
7. Table renders visually; row/column operations work
8. Edit content → debounced auto-save to disk via Rust backend
9. File open dialog and file save dialog work via Tauri
10. App binary < 15 MB (Tauri advantage over Electron)
11. Editor input latency < 16ms (60fps)

---

## 9. Out of Scope (YAGNI)

- Math/LaTeX rendering
- Mermaid/diagram rendering
- Image upload or CDN integration
- Multi-file / tab management
- PDF/DOCX/HTML export (future: Typst via Rust)
- Collaborative editing (CRDT, Yjs)
- Plugin system (WASM, future)
- Full source code mode toggle
- Advanced theme system

---

## 10. Appendix: Why Not the v1 Approach

| v1 (Rejected) | v2 (This Spec) | Reason |
|---|---|---|
| Pure web → Tauri later | Tauri from day 1 | File I/O is core, not optional |
| Native ProseMirror | Tiptap | Tiptap = ProseMirror + ecosystem; markdown-it/turndown removed |
| markdown-it + turndown | Tiptap Markdown Extension | Bidirectional sync built-in, no dual parse/serialize pipeline |
| CodeMirror 6 in NodeView | CodeBlockLowlight + lowlight | Eliminates event collision, ~60KB saved |
| 7 separate ProseMirror packages | 4 Tiptap packages | Simpler dependency management |
| LocalStorage | Rust file I/O | Production-ready persistence |
| Hand-written FocusTrackerPlugin | DualModeExtension + NodeView | Same logic, cleaner Tiptap extension API |

The v1 approach's complexity was not accidental — it was necessary to understand the internals. But for a production MVP, Tiptap provides the same capabilities with a fraction of the boilerplate.
