# Basic Feature Gaps

Snapshot date: 2026-06-11

This is a code-based gap list for editor basics that are missing, partial, or only available on a secondary path. It focuses on features users expect from a text-writing tool before larger AI or publishing work.

## P0 - Core Writing Friction

### 1. Find In Document

Status: first pass implemented.

Evidence:

- `src/editor/source-editor.ts` imports CodeMirror search keymaps, so Source Mode has CodeMirror-level search.
- `src/editor/extensions/search-match.ts` provides Tiptap/ProseMirror match tracking and decorations.
- `src/App.vue`, `src/ui/MenuBar.vue`, and `src-tauri/src/lib.rs` expose Find through `Cmd/Ctrl+F` and menus.

Why it matters:

Search is a baseline text-editor feature. For long Markdown documents, forcing users into Source Mode just to find text breaks the main WYSIWYG writing flow.

Implemented first pass:

- Lightweight find bar over the editor.
- `Cmd/Ctrl+F`, `Enter`, `Shift+Enter`, and `Escape`.
- Match highlighting in the Tiptap document with ProseMirror decorations.
- Active-match scrolling and `current / total` count.
- Keep Source Mode search as-is, but make WYSIWYG search the default path.

Remaining follow-up:

- Add manual/browser QA for search in long documents, hidden inactive tabs, and rich blocks.
- Decide whether search should support case-sensitive and whole-word toggles.

### 2. Replace In Document

Status: first pass implemented.

Evidence:

- `src/editor/extensions/search-match.ts` provides replace-current and replace-all helpers using ProseMirror transactions.
- `src/App.vue` exposes a replacement input plus Replace and All actions in the find bar.
- `src/editor/extensions/search-match.test.ts` covers replacing the active match and replacing all matches.

Implemented first pass:

- Replace current match.
- Replace all matches.
- Recompute match counts after replacement.
- Preserve editor undo behavior by using document transactions.

Remaining follow-up:

- Manual/browser QA for rich blocks, long documents, and multi-file switching.
- Consider confirmation or preview affordances for replace all in very large documents.

### 3. Accurate Shortcut Surface

Status: partial and currently inconsistent with docs.

Evidence:

- `src/App.vue` handles New, Open, Open Folder, Save, Close, and tab cycling.
- Export shortcuts documented in `website/en/docs/export.md`, `website/zh/docs/export.md`, and keyboard shortcut docs are not wired in `onAcceleratorKey`.
- Source Mode docs list `Cmd/Ctrl+Shift+S`, but `App.vue` does not currently bind that shortcut; Source Mode is available through UI/menu actions.
- Website docs mention AI inline edit (`Cmd/Ctrl+K`), but AI is not wired into the product path.

Suggested first implementation:

- Decide the actual shortcut map.
- Wire only implemented commands.
- Remove or mark not-yet-available shortcuts in website docs.

## P1 - Expected Editor Controls

### 4. Block Formatting Commands

Status: partial.

Evidence:

- Inline selection formatting is available through `BubbleToolbar`.
- Markdown input rules and Tiptap extensions support many block types.
- There is no visible block toolbar/menu for headings, paragraph, lists, quote, code block, table insertion, or table row/column operations.

Why it matters:

Markdown-first users can type syntax, but many users still expect discoverable controls for common block operations.

Suggested direction:

- Keep the stealth UI, but add a compact command surface:
  - slash menu,
  - command palette,
  - or block handle menu.
- Prioritize headings, lists, quote, code block, table insert, and table edit actions.

### 5. File And Folder Search

Status: partial; Quick Open first pass implemented.

Evidence:

- Folder workspace tree can lazy-load directories.
- `src/App.vue`, `src/ui/MenuBar.vue`, and `src-tauri/src/lib.rs` expose Quick Open through `Cmd/Ctrl+P` and menus.
- Quick Open recursively scans Markdown-like files in the current workspace, skips common heavy generated directories, filters by relative path, and opens the selected file.
- Full-text workspace search across file contents is not implemented.

Implemented first pass:

- Quick open by filename/relative path inside the current workspace.
- Keyboard navigation with up/down and enter.
- Conservative caps for large folders.

Remaining follow-up:

- Add manual QA on large repositories.
- Add refresh behavior after files are created, renamed, or deleted.
- Later add full-text workspace search with result snippets.

### 6. Recent Files And Session Restore

Status: missing except crash recovery.

Evidence:

- App handles opened files and folder query params for the current session.
- Crash recovery exists for unsaved temp files.
- There is no recent-files list, recent-workspaces list, or normal-session restore for open files.

Suggested direction:

- Persist recent files/workspaces in app data.
- Offer File -> Open Recent.
- Restore the last workspace/open files only after clarifying expected desktop behavior.

### 7. Save As

Status: partial.

Evidence:

- Unsaved files can choose a path during Save.
- Existing saved files do not expose a separate Save As action.

Suggested direction:

- Add File -> Save As.
- Reuse the existing save dialog and update the active file path after success.

## P2 - Product Comfort

### 8. Preferences UI

Status: missing.

Evidence:

- `get_app_data_dir` exists, and CSS follows system light/dark mode.
- There is no settings screen or config persistence for editor width, auto-save, theme override, font, Source Mode default, or export defaults.
- Website docs mention a status-bar theme toggle, but `StatusBar.vue` only exposes Source Mode.

Suggested direction:

- Add a small Preferences surface after shortcut/search basics.
- Start with theme behavior, auto-save delay, editor width, font size, and default export folder.

### 9. File Operations In Sidebar

Status: read/open only.

Evidence:

- `SidebarTree` and Tauri `list_directory` support browsing and opening Markdown files.
- No rename, delete, duplicate, reveal in Finder/Explorer, or create file/folder actions are exposed.

Suggested direction:

- Add context menu actions gradually.
- Require confirmations for destructive actions.

### 10. Print

Status: missing as an explicit product command.

Evidence:

- Export exists for PDF, DOCX, and JPEG.
- CSS contains print rules, but no File -> Print action or shortcut is wired.

Suggested direction:

- Decide whether PDF export is the supported print path.
- If native print matters, add File -> Print and document it.

### 11. Spellcheck And Writing Assistance

Status: unclear/implicit.

Evidence:

- No explicit spellcheck setting, language selection, or writing assistant surface is present.
- Browser/webview defaults may provide some spellcheck behavior, but the app does not control or document it.

Suggested direction:

- Decide whether spellcheck should be enabled, disabled, or configurable.
- Add language and custom dictionary support only after the basic toggle is clear.

## Suggested Priority Order

1. Shortcut/docs reconciliation for commands that are still doc-only.
2. Quick Open hardening for large workspaces and refresh behavior.
3. Replace hardening for rich blocks, long documents, and large replace-all operations.
4. Save As and Open Recent.
5. Preferences UI.
6. Block command surface.
7. Sidebar file operations.
8. Print and spellcheck decisions.

## Notes

- Do not treat AI features as a substitute for these basics. Search, replace, recent files, and preferences should work even when AI is absent.
- The first search and replace implementation can be simple; reliability and keyboard feel matter more than broad scope.
