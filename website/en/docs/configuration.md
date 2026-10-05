---
title: Configuration
---

# Configuration

Lexx is designed to work well out of the box with minimal configuration. Most settings adapt automatically to your system.

## Theme

Lexx supports three theme modes, set in **Preferences** (⌘, / Ctrl+,):

- **System** — follows your OS appearance (default)
- **Light mode**
- **Dark mode**

In System mode, the theme switches automatically when you change your system preference. You can also toggle it via the status bar button at the bottom of the editor.

## Window Layout

### Sidebar
- **Hidden** — When editing a single file (default)
- **Flat** — Shows open file tabs when multiple files are open
- **Tree** — Shows file tree when a folder workspace is open

On narrow windows, the sidebar collapses to an edge-trigger overlay — hover the left edge to reveal it.

### Outline View
Open the outline panel to see all headings in your document. Click any heading to jump to it. The active heading is highlighted as you scroll.

On narrow windows, the outline becomes an edge-trigger overlay on the right side.

## File Associations

Lexx registers file associations for:

- `.md`
- `.markdown`
- `.mdx`

Double-clicking these files in your OS file manager opens them in Lexx.

## Auto-Save

- Unsaved changes are auto-saved to a temporary file every **3 seconds** (delay adjustable in Preferences)
- Auto-save can be turned off entirely in **Preferences** (⌘, / Ctrl+,)
- On next launch, Lexx prompts you to recover any unsaved work
- Saved files auto-save changes back to the original file

## Source Mode

Toggle between WYSIWYG and Markdown source editing via **View → Toggle Source Mode** or the status bar button. Press **Esc** in source mode to return to visual mode.

Cursor position is preserved across mode switches.
