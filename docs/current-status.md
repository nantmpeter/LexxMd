# Current Status

Snapshot date: 2026-10-05

Lexx is a Tauri 2 desktop Markdown editor built with Vue 3, Tiptap, CodeMirror 6, and Rust commands. The product direction is a minimal, "stealth UI" writing app: write Markdown directly, keep the interface quiet, and show rendered content wherever possible.

## Implemented

### Editor Core

- Dual-mode WYSIWYG editing (Tiptap): the focused block exposes Markdown-like editing affordances while unfocused content renders cleanly.
- Source Mode backed by CodeMirror 6, including line numbers, Markdown syntax highlighting, bracket matching, and line wrapping. Mode switches rebuild the editor state, so stale undo history from a previous file can never bleed across tabs.
- Find and replace with `Cmd/Ctrl+F` (WYSIWYG mode), including match highlighting, active-match navigation, match count, replace current, and replace all.
- Frontmatter and raw HTML block fidelity: `preserve-blocks.ts` keeps YAML front matter and markdown-it `html_block` tokens verbatim as plain-text blocks across the parse/serialize round trip (raw HTML is never executed or rendered).
- IME composition guard: the global keydown dispatcher ignores keystrokes while an IME composition is in progress (`isComposing` / keyCode 229), so pinyin input and candidate dismissal no longer fire shortcuts.
- Markdown input and formatting support for headings, lists, blockquotes, code blocks, links, task lists, tables, typography, highlight, subscript, superscript, underline, and images.
- Bubble toolbar for common inline formatting and link editing.
- Rich code block rendering: Mermaid diagrams as SVG, display math through KaTeX (`math`/`latex`/`katex`), and syntax highlighting for other languages.

### Files And Workspace

- Native file open/save dialogs through Tauri, plus Save As (`Cmd/Ctrl+Shift+S`).
- Multiple open files in one app window, with a flat open-file sidebar or a lazy-loaded folder tree for workspace mode.
- Quick Open for workspace and recent files with `Cmd/Ctrl+P`, recursive scanning, filename filtering, and keyboard selection.
- Recent files: every successful open or save-to-new-path is recorded in `appData/recent.json` and surfaced in Quick Open across launches.
- Multi-window support: folders and files can be opened in separate windows; new-window flows are offered when the current context would conflict.
- Single-instance enforcement via the Tauri `single-instance` plugin: a second launch forwards its arguments to the running app.
- External modification detection: on window focus, clean files whose disk content diverged are auto-reloaded; dirty files keep the in-memory edits and warn via toast. Source-mode slots are notified instead of reloaded to avoid clobbering.
- Session restore: open files and the active tab are snapshotted to `session.json` and restored on launch; unsaved (Untitled) content is recovered from uniquely named temp files.
- OS file-open handling: macOS opened-file events and Windows command-line arguments are buffered at startup.
- Window title updates based on the current file or folder.

### Preferences

- `prefs.json`-backed settings dialog (`Cmd/Ctrl+,`): theme three-state (system / light / dark), autosave on/off, and editor content width.
- Theme is applied to `<html data-theme>` before first paint to avoid flashes.

### Reliability

- Dirty-state tracking per open file.
- Debounced auto-save after edits; can be turned off in Preferences.
- Atomic writes: saves and exports go through a same-directory temp file + rename (`file_io.rs`), with unique sidecar names per writer so two windows can never promote each other's partial content.
- Temporary-save crash recovery for unsaved files using unique temp names — multiple Untitled windows recover independently.
- Close-window handling attempts to auto-save dirty files before destroying the window.

### Export And Print

- DOCX export with document structure conversion and embedded images (PNG/JPG/GIF/BMP via data-URL sniffing); a completion toast reports embedded/skipped image counts.
- PDF export slices the rendered document at block boundaries into page-sized chunks, so large documents no longer hit canvas limits; normal blocks are never cut mid-block.
- JPEG export using html2canvas at 2x pixel ratio.
- Native print pipeline (`Cmd/Ctrl+Alt+P` → `window.print()`): the system dialog offers "Save as PDF" with selectable text, complementing the image-based PDF export.
- Export writes binary output through a Tauri command with atomic writes.

### UI

- Native macOS menu bar; frontend menu bar for Windows/Linux.
- Status bar with saved/unsaved state, word count, character count, and Source Mode toggle.
- Floating outline view with heading extraction, active-heading tracking, click-to-scroll, and narrow-screen overlay behavior.
- Responsive sidebar behavior for wide and narrow screens.

### Distribution And Website

- Tauri app configuration for product name `Lexx`, bundle icons, file associations, updater artifacts, and updater endpoint.
- VitePress marketing/docs website with English and Chinese content.

## Verification

Commands run on 2026-10-05:

- `npm test` passes: 210 tests passed (27 files).
- `cargo test` passes: 19 tests passed.
- `npm run typecheck` passes.
- CI build matrix is green on all four platforms (macOS Apple Silicon/Intel, Windows, Linux) with `npm test` and `cargo test` steps; the separate website-deploy job failure on that run is unrelated to build/tests.

## Known Gaps

- Chinese IME behavior still needs on-device QA; a 22-item checklist lives in the session notes / fix-plan appendix. The composition guard covers shortcut dispatch, but editor-level IME flows are unverified on real devices.
- Image-based PDF export produces bitmap pages — text is not selectable. For selectable-text PDFs, use the native print pipeline (`Print...` → Save as PDF).
- Inline HTML (`html_inline`) is not preserved verbatim across round trips; only block-level raw HTML and frontmatter are.
- Multi-window session state is last-writer-wins on `session.json`: two windows snapshot independently, so the last closing/debounced write replaces the other's open-file list.
- External-change detection compares content on window focus, but the read→write path has a TOCTOU window: an external write landing between the last read and an autosave/save can still be overwritten.

## Security Posture

Accepted risk (recorded 2026-10-05): the Tauri `assetProtocol` scope stays `"**"` because opening arbitrary files/folders from anywhere on disk is a core editor capability; narrowing it would break the product. Mitigations around that entry point: KaTeX math blocks render with `trust: false` (no `\href`/`\includegraphics`/`\html*` escapes), raw HTML blocks are stored as plain text and never rendered, temp-file commands validate filenames and enforce temp-directory containment, `delete_temp_file` canonicalizes both paths before deletion, and webview devtools are compiled out of release builds. CSP is intentionally unchanged.

## Source Of Truth

For current behavior, prefer these files over archived planning notes:

- `src/App.vue`
- `src/composables/` (shortcuts, autosave, prefs, session, recent files, workspace, export, find/replace, source mode, quick open)
- `src/editor/index.ts`
- `src/editor/source-editor.ts`
- `src/editor/extensions/`
- `src/export/`
- `src/ui/`
- `src/tauri/commands.ts`
- `src-tauri/src/lib.rs`
- `src-tauri/src/commands/`
- `website/en/docs/`
- `website/zh/docs/`
