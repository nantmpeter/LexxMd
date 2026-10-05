# Current Status

Snapshot date: 2026-06-11

Lexx is a Tauri 2 desktop Markdown editor built with Vue 3, Tiptap, CodeMirror 6, and Rust commands. The current product direction is a minimal, "stealth UI" writing app: write Markdown directly, keep the interface quiet, and show rendered content wherever possible.

## Implemented

### Editor Core

- Tiptap editor initialization with Markdown serialization and parsing.
- Dual-mode WYSIWYG editing: the focused block exposes Markdown-like editing affordances while unfocused content renders cleanly.
- Source Mode backed by CodeMirror 6, including line numbers, Markdown syntax highlighting, history, search keymaps, bracket matching, and line wrapping.
- Markdown input and formatting support for headings, lists, blockquotes, code blocks, links, task lists, tables, typography, highlight, subscript, superscript, underline, and images.
- Bubble toolbar for common inline formatting and link editing.
- WYSIWYG document search and replace with `Cmd/Ctrl+F`, a find bar, replacement input, match highlighting, active-match navigation, match count, replace current, and replace all.
- Rich code block rendering:
  - Mermaid code blocks render SVG diagrams.
  - `math`, `latex`, and `katex` code blocks render display math through KaTeX.
  - Other code blocks use lowlight/highlight.js-compatible syntax highlighting.

### Files And Workspace

- Native file open/save dialogs through Tauri.
- Multiple open files in one app window.
- Folder workspace mode with a lazy-loaded sidebar tree.
- Quick Open for workspace Markdown files with `Cmd/Ctrl+P`, recursive scanning, filename filtering, and keyboard selection.
- Flat open-file sidebar when multiple files are open without a workspace.
- OS file-open handling:
  - macOS opened-file events are buffered and emitted.
  - Windows command-line file arguments are buffered at startup.
- New-window flows for opening a folder or file when the current context would conflict.
- Window title updates based on the current file or folder.

### Reliability

- Dirty-state tracking per open file.
- Debounced auto-save after edits.
- Temporary-save crash recovery for unsaved files.
- Close-window handling attempts to auto-save dirty files before destroying the window.
- Basic Rust-side tests cover file I/O and temp-file deletion guards.

### Export

- PDF export using DOM cloning, html2canvas, and jsPDF.
- DOCX export with document structure conversion.
- JPEG export using html2canvas.
- Export writes binary output through a Tauri command.

### UI

- Native macOS menu bar.
- Frontend menu bar for non-macOS platforms.
- Status bar with saved/unsaved state, word count, character count, and Source Mode toggle.
- Floating outline view with heading extraction, active-heading tracking, click-to-scroll, and narrow-screen overlay behavior.
- Responsive sidebar behavior for wide and narrow screens.

### Distribution And Website

- Tauri app configuration for product name `Lexx`, bundle icons, file associations, updater artifacts, and updater endpoint.
- VitePress marketing/docs website with English and Chinese content.

## Verification

Commands run on 2026-06-11:

- `npm run build` passes.
- `cargo test` passes: 8 tests passed.
- `npm test -- src/editor/extensions/search-match.test.ts src/ui/OutlineView.test.ts` passes: 14 tests passed.
- `npm test` passes: 55 tests passed.

## Known Gaps

- Replace supports current match and all matches, but still needs manual QA for rich blocks and long documents.
- Quick Open is intentionally capped for large workspaces and still needs manual QA on very large folders.
- Export docs mention shortcut accelerators that are not currently wired in `App.vue`; menu actions are implemented.
- `SPEC.md` and early Superpowers planning docs described an older MVP shape and have been archived.
- AI-related Rust command code exists in the working tree, but it is not wired into the Tauri invoke handler in the current inspected app path; treat AI as experimental or not yet productized unless integration is completed.
- Bundle size is large after production build, mainly due to editor/export/rich-rendering dependencies. Vite reports chunks over 500 kB.

## Security Posture

Accepted risk (recorded 2026-10-05): the Tauri `assetProtocol` scope stays `"**"` because opening arbitrary files/folders from anywhere on disk is a core editor capability; narrowing it would break the product. Mitigations around that entry point: KaTeX math blocks render with `trust: false` (no `\href`/`\includegraphics`/`\html*` escapes), temp-file commands validate filenames and enforce temp-directory containment, `delete_temp_file` canonicalizes both paths before deletion, and webview devtools are compiled out of release builds. CSP is intentionally unchanged.

## Source Of Truth

For current behavior, prefer these files over archived planning notes:

- `src/App.vue`
- `src/editor/index.ts`
- `src/editor/source-editor.ts`
- `src/editor/extensions/`
- `src/export/`
- `src/tauri/commands.ts`
- `src-tauri/src/lib.rs`
- `src-tauri/src/commands/`
- `website/en/docs/`
- `website/zh/docs/`
