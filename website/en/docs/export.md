---
title: Export
---

# Export

Lexx supports three export formats, all processed locally without any external services.

## PDF Export

Generates a multi-page A4 PDF document with clean formatting.

**How**: File → Export as PDF (or ⌘⇧P / Ctrl+Shift+P)

Features:
- A4 page size with proper margins
- Auto-pagination across pages
- Markdown markers hidden in output
- Code blocks with syntax highlighting
- Embedded images and diagrams

## DOCX Export

Generates a Microsoft Word document with full formatting preservation.

**How**: File → Export as DOCX (or ⌘⇧D / Ctrl+Shift+D)

Supported elements:
- Headings (h1–h6) → Word heading styles
- Bold, italic, strikethrough, underline
- Ordered and unordered lists (nested)
- Task lists with checkboxes
- Blockquotes
- Code blocks with syntax highlighting colors
- Tables with borders
- Embedded Mermaid/KaTeX as images
- Hyperlinks

## JPEG Export

Generates a high-resolution JPEG image of the document.

**How**: File → Export as JPEG (or ⌘⇧J / Ctrl+Shift+J)

Features:
- 2× pixel ratio for sharp output on retina displays
- Full document capture
- Clean render mode (no syntax markers)

## Notes

- All exports force **render mode** — Markdown syntax markers are hidden in the output
- Exported files are saved to the same directory as the source `.md` file
- For unsaved files, exports go to your Downloads folder
