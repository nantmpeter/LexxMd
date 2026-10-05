---
title: Installation
---

# Getting Started

## Install

Download the latest release for your platform from [GitHub Releases](https://github.com/nantmpeter/LexxMd/releases/latest):

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `Lexx_x.x.x_aarch64.dmg` |
| macOS (Intel) | `Lexx_x.x.x_x64.dmg` |
| Windows | `Lexx_x.x.x_x64-setup.exe` |
| Linux | `Lexx_x.x.x_amd64.AppImage` |

### macOS

1. Open the `.dmg` file
2. Drag **Lexx** to your Applications folder
3. Launch from Applications or Spotlight

On first launch, you may need to right-click and select **Open** to bypass Gatekeeper.

### Windows

1. Run the `.exe` installer
2. Follow the setup wizard
3. Launch from Start Menu or desktop shortcut

### Linux

1. Make the `.AppImage` executable: `chmod +x Lexx_*.AppImage`
2. Run it: `./Lexx_*.AppImage`

## First Launch

When you open Lexx, you'll see a clean, empty editor. Start typing Markdown directly — the editor uses **dual-mode WYSIWYG**, so you'll see syntax markers in the focused block and rendered output everywhere else.

## Opening Files

There are several ways to open files:

- **Menu**: File → Open (⌘O / Ctrl+O)
- **Quick Open**: ⌘P / Ctrl+P, which also lists your recently opened files
- **Drag & drop**: Drag a `.md` file onto the Lexx dock icon or window
- **Double-click**: Associate `.md` files with Lexx in your OS settings
- **Command line**: `lexx path/to/file.md`

## Opening Folders

Use File → Open Folder to open a directory as a workspace. The sidebar shows a file tree for quick navigation between files.

## Auto-Save

Lexx auto-saves your work every 3 seconds after you stop typing. A dot indicator in the status bar shows unsaved changes. If the file hasn't been saved before, content is stored in a temporary location for crash recovery.
