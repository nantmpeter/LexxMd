---
layout: page
title: Features
---

# Features

## Editing

### Dual-Mode WYSIWYG
Per-block switching. When your cursor is in a block, you see the raw Markdown syntax — headings show `#`, bold shows `**`, links show `(url)`. Move away and it all renders beautifully. This happens purely via CSS with zero DOM rebuild.

### Full Source Mode
Switch to a CodeMirror 6-powered Markdown source view anytime with a single click. Cursor position is preserved across mode switches. Full syntax highlighting, search, bracket matching included.

### Rich Markdown Extensions
- **Highlight** — `==text==` renders as highlighted text
- **Subscript** — `~text~` renders as subscript
- **Superscript** — `^text^` renders as superscript
- **Underline** — `++text++` renders as underlined text
- **Task lists** — `- [ ]` and `- [x]` with live checkboxes
- **Tables** — Visual resizable tables

### Bubble Toolbar
Select text to get a floating toolbar with: Bold, Italic, Strikethrough, Checkbox, Highlight, Inline Code, Link, Subscript, Superscript, Underline.

## Rendering

### Mermaid Diagrams
Code blocks tagged with `mermaid` automatically render as SVG diagrams. Focus to edit the source, blur to see the rendered output. Supports flowcharts, sequence diagrams, Gantt charts, and more.

### KaTeX Math
`math` or `latex` code blocks render beautiful typeset formulas via KaTeX. Display-mode math with full LaTeX support.

### Syntax Highlighting
Code blocks get automatic syntax highlighting for 20+ languages via lowlight (highlight.js compatible).

## Export

### PDF
Multi-page A4 PDF export with auto-pagination. Clean output with no Markdown markers.

### DOCX
Full DOCX generation with headings, paragraphs, lists (nested), code blocks with syntax colors, tables, embedded diagram images, and task list checkboxes.

### JPEG
High-quality 2x pixel ratio JPEG export via html2canvas.

## Workspace

### Multi-Window
Open multiple files in separate windows. File associations for `.md`, `.markdown`, `.mdx` enable double-click-to-open from the OS.

### Folder Workspace
Open a folder to browse files in a sidebar tree view. Lazy-loads directory contents for fast navigation.

### Outline View
Floating outline panel showing all headings (h1-h6). Click to scroll. Active heading tracking syncs with scroll position.

## Reliability

### Crash Recovery
Auto-saves unsaved content to temp files every 3 seconds. On restart, prompts to recover work from previous sessions.

### Auto-Save
Dirty files auto-save after 3 seconds of inactivity.
