---
title: Dual-Mode Editor
---

# Editing

Lexx uses a **dual-mode WYSIWYG** editing model. This means you write Markdown, but see rendered output — with the raw syntax visible only in the block where your cursor sits.

## How Dual-Mode Works

1. **Focus a block** → You see raw Markdown syntax (`#`, `**`, `>`, `- `, etc.)
2. **Leave the block** → Syntax markers fade away, content renders visually
3. **Switching is instant** — Pure CSS toggling, no DOM rebuild

This gives you the best of both worlds: you can always see and edit the raw Markdown when you need to, but the document looks clean and rendered when you're reading.

## Markdown Shortcuts

Type these shortcuts and press Space to trigger:

| Shortcut | Result |
|----------|--------|
| `# ` | Heading 1 |
| `## ` | Heading 2 |
| `### ` | Heading 3 |
| `> ` | Blockquote |
| `- ` | Bullet list |
| `1. ` | Ordered list |
| `- [ ] ` | Task list (checkbox) |
| `---` | Horizontal rule |
| `` ``` `` | Code block |

## Inline Formatting

| Syntax | Result |
|--------|--------|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `~~strike~~` | ~~strike~~ |
| `==highlight==` | highlighted text |
| `` `code` `` | `inline code` |
| `~subscript~` | subscript text |
| `^superscript^` | superscript text |
| `++underline++` | underlined text |

## Bubble Toolbar

Select any text to reveal the floating toolbar:

- **B** — Bold (⌘B)
- **I** — Italic (⌘I)
- **S** — Strikethrough
- **☐** — Toggle task list
- **H** — Highlight
- **<>** — Inline code
- **🔗** — Insert/edit link (opens URL popup)
- **X₂** — Subscript
- **X²** — Superscript
- **U̲** — Underline

Active formatting states are highlighted in the toolbar.

## Source Mode

Toggle between WYSIWYG and source mode to see raw Markdown:

- **macOS**: View → Toggle Source Mode, or the status bar button
- **Windows/Linux**: View → Toggle Source Mode, or the status bar button
- Press **Esc** in source mode to return to visual mode

The source editor is powered by CodeMirror 6 with syntax highlighting, line numbers, and search. Your cursor position is preserved when switching modes.

## Frontmatter And Raw HTML

- A YAML front matter block (`---` ... `---`) at the top of the file is kept verbatim as an editable plain-text block instead of being mangled into headings or separators.
- Block-level raw HTML (`<!-- comments -->`, `<details>`, `<div>`, ...) is preserved verbatim and never executed or rendered as markup.
- Inline HTML inside paragraphs is not preserved verbatim across edits.

## Links

1. Select text and click 🔗 in the bubble toolbar
2. A popup appears below your selection — paste or type a URL
3. Press Enter or click OK to apply

To edit an existing link, click on it and use the toolbar. The popup pre-fills the current URL and offers a **Remove** button.

## Images

Paste images directly from clipboard (⌘V / Ctrl+V). Images are saved to an `assets/` folder next to your `.md` file with relative paths, keeping your documents portable.

## Rich Code Blocks

Code blocks with special languages render live output:

- `` ```mermaid `` — Renders Mermaid diagrams as SVG
- `` ```math `` or `` ```latex `` — Renders KaTeX math formulas

Focus the block to edit the source code. Click away to see the rendered result.
