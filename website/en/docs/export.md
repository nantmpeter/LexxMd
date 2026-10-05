---
title: Export
---

# Export

Lexx supports three export formats, all processed locally without any external services.

## PDF Export

Generates a multi-page A4 PDF document with clean formatting.

**How**: File → Export as PDF

Features:
- A4 page size with proper margins
- Pagination composed at block boundaries — blocks are never cut mid-block, and oversized blocks are sliced across pages
- Markdown markers hidden in output
- Code blocks with syntax highlighting
- Embedded images and diagrams
- Note: pages are rendered as images, so text is not selectable — use **Print** (below) for selectable-text PDF

## DOCX Export

Generates a Microsoft Word document with full formatting preservation.

**How**: File → Export as DOCX

Supported elements:
- Headings (h1–h6) → Word heading styles
- Bold, italic, strikethrough, underline
- Ordered and unordered lists (nested)
- Task lists with checkboxes
- Blockquotes
- Code blocks with syntax highlighting colors
- Tables with borders
- Embedded raster images (PNG/JPG/GIF/BMP)
- Embedded Mermaid/KaTeX as images
- Hyperlinks

A completion toast reports how many images were embedded (and any skipped).

## JPEG Export

Generates a high-resolution JPEG image of the document.

**How**: File → Export as JPEG

Features:
- 2× pixel ratio for sharp output on retina displays
- Full document capture
- Clean render mode (no syntax markers)

## Print

**How**: File → Print (⌘⌥P / Ctrl+Alt+P)

Uses the system print dialog, which also offers **Save as PDF** — the output keeps text selectable, unlike the image-based PDF export above.

## Notes

- All exports force **render mode** — Markdown syntax markers are hidden in the output
- Exports go through a native Save dialog — you choose the destination file name and folder
