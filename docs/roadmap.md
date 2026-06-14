# Roadmap

This roadmap starts from the current 2026-06-11 code state. It is intentionally practical: stabilize what exists first, then expand.

## Phase 1 - Stabilize The Current Product

Goal: make the existing Lexx experience reliable enough to keep building on.

- Harden WYSIWYG document search:
  - add browser/manual QA for long documents and rich blocks,
  - decide whether to add case-sensitive and whole-word toggles,
  - verify behavior while switching open files.
- Harden replace after the first pass:
  - manual/browser QA for rich blocks and long documents,
  - replace-all preview or confirmation for large documents,
  - verify undo behavior and match-count updates across multi-file switching.
- Reconcile all documented shortcuts with implemented commands, especially Source Mode, export, fullscreen, and any AI shortcuts.
- Fix stale frontend tests, starting with `OutlineView.test.ts`.
- Add targeted tests for Source Mode sync, multi-file switching, auto-save behavior, and export command paths.
- Review crash recovery edge cases:
  - repeated untitled filenames,
  - temp-file cleanup,
  - recovery after save,
  - close-window save failures.
- Improve bundle health by checking whether Mermaid, export code, and heavy renderers can be loaded on demand.
- Decide which generated or local-state directories should be ignored or committed, especially `.omc/`, `.superpowers/`, `dist/`, and generated assets.

## Phase 2 - Polish Writing And Navigation

Goal: make day-to-day writing feel calmer and more capable.

- Tighten dual-mode editing fidelity for blockquotes, task lists, tables, links, and inline marks.
- Improve outline behavior on narrow screens and long documents.
- Add clearer file conflict handling for workspace mode versus standalone file mode.
- Add preferences for auto-save, source mode defaults, theme, and editor width.
- Add File -> Save As and File -> Open Recent.
- Harden Quick Open for large workspaces and refresh behavior after file-tree changes.
- Later add full-text workspace search with snippets.
- Improve image workflows:
  - paste into saved files,
  - paste into unsaved files,
  - relative-path portability,
  - missing image handling.
- Add user-facing error states instead of silent catches for important file and export failures.

## Phase 3 - Export And Publishing Quality

Goal: make output trustworthy for real documents.

- Add fixture-based export tests for PDF, DOCX, and JPEG.
- Improve pagination and styling consistency for long documents.
- Verify Mermaid and KaTeX rendering in all export formats.
- Add export profiles or options for page size, margins, and image quality.
- Consider a Markdown/HTML export path if users need clean web publishing.

## Phase 4 - Productized Desktop Release

Goal: prepare a repeatable release flow.

- Validate file associations on macOS, Windows, and Linux.
- Verify updater signing, endpoint format, and rollback behavior.
- Add CI for frontend tests, Rust tests, typecheck/build, and Tauri bundle smoke checks.
- Document release steps and artifact naming.
- Add a small manual QA checklist for core writing, file, workspace, export, and recovery flows.

## Phase 5 - Optional AI Features

Goal: only ship AI when it is clearly integrated, local-first, and useful.

- Decide the first AI workflow: summarize, rewrite, explain selection, or document outline.
- Wire AI commands through the Tauri invoke handler and frontend UI only after the product behavior is clear.
- Add model management UX if local models remain the direction.
- Keep AI optional and non-blocking for the core editor.
- Document privacy and local/remote processing boundaries before release.
