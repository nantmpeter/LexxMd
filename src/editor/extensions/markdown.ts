/**
 * IMPLEMENTATION SCOPE:
 * - Placeholder: Future markdown-specific extension configuration
 * - Not needed for MVP: StarterKit in editor/index.ts handles markdown shortcuts
 * - Pending: Replace with @tiptap-pro/extension-markdown when available,
 *   or wire up the Rust backend via Tauri IPC for markdown serialization
 *
 * NOTE: This file exists as a documentation placeholder. The actual editor
 * initialization uses StarterKit directly in editor/index.ts, which already
 * provides markdown input rules and shortcut behavior. Do NOT import this
 * file's createMarkdownExtension() alongside the existing StarterKit in
 * editor/index.ts -- doing so would create a duplicate StarterKit instance.
 */

import StarterKit from '@tiptap/starter-kit'

/**
 * Creates a StarterKit configuration with markdown-friendly defaults.
 *
 * WARNING: This is a separate StarterKit configure call. If you already
 * have StarterKit in your editor setup (see editor/index.ts), do NOT use
 * this function -- it would create a second StarterKit instance. This
 * file is reserved for future markdown-specific extension wiring.
 */
export function createMarkdownExtension() {
  return StarterKit.configure({
    codeBlock: false,   // CodeBlockLowlight handles it
  })
}
