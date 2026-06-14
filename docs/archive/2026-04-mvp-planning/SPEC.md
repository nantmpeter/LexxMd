# SPEC.md -- MDEditor MVP Acceptance Criteria

## Editor Loads
- [ ] Tauri app launches without errors
- [ ] Editor displays with default content
- [ ] ProseMirror/Tiptap initializes correctly

## Markdown Input Rules
- [ ] Type `# ` at line start -> creates h1 heading
- [ ] Type `## ` -> creates h2 heading (and so on through h6)
- [ ] Type `- ` or `* ` -> creates bullet list
- [ ] Type `1. ` -> creates ordered list
- [ ] Type `> ` -> creates blockquote
- [ ] Type ``` ``` ``` -> creates code block
- [ ] Type `**text**` -> wraps text in bold mark
- [ ] Type `*text*` -> wraps text in italic mark
- [ ] Type `` `code` `` -> wraps text in inline code mark

## Dual-Mode Editing
- [ ] Cursor on heading -> heading prefix (`#`) visible in block
- [ ] Cursor leaves heading -> prefix hides, rendered heading visible
- [ ] Cursor on blockquote -> `>` prefix visible
- [ ] Cursor on paragraph -> inline marks show `**` markers in edit mode
- [ ] Paragraph marks hide in render mode (CSS toggle, no DOM rebuild)

## Code Blocks
- [ ] Code block renders with syntax highlighting (lowlight/highlight.js)
- [ ] Multiple languages highlighted (javascript, python, rust, etc.)
- [ ] Code block is editable when cursor is inside

## Tables
- [ ] Table renders as visual grid (not Markdown source)
- [ ] Can add row via table menu
- [ ] Can add column via table menu
- [ ] Table cells are editable

## File Operations (Rust Backend)
- [ ] File > Open -> native file dialog opens
- [ ] Select .md file -> content loads into editor
- [ ] Edit content -> dirty indicator appears
- [ ] Cmd/Ctrl+S -> file_save_dialog opens -> saves to disk
- [ ] File > New -> editor clears, dirty indicator resets

## Toolbar
- [ ] H1/H2/H3 buttons convert block to respective heading level
- [ ] B button toggles bold on selection
- [ ] I button toggles italic on selection
- [ ] UL/OL buttons create lists
- [ ] " button creates blockquote
- [ ] Code button creates code block
- [ ] Link button inserts/prompts for URL
- [ ] Table button inserts 3x3 table

## Status Bar
- [ ] Shows current filename
- [ ] Shows "Unsaved" in orange when dirty
- [ ] Shows "Saved" in green when saved
- [ ] Shows live word count
- [ ] Shows character count

## Performance
- [ ] App binary < 15 MB (Tauri)
- [ ] Editor input latency < 16ms (no frame drops)

## Tech Stack Verification
- [ ] Rust backend handles file I/O (no localStorage used for persistence)
- [ ] Tiptap handles Markdown <-> doc serialization
- [ ] DualModeExtension drives mode switching via CSS classes
- [ ] lowlight handles code syntax highlighting
- [ ] No markdown-it or turndown in dependencies
