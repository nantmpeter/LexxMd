/**
 * @file Frontend IPC wrapper for Tauri backend commands
 * @author Backend-Dev Agent (Python/Rust)
 * @created 2026-04-14
 *
 * IMPLEMENTATION SCOPE:
 * - Implemented: fileRead, fileWrite, openFileDialog, saveFileDialog wrappers
 * - Not implemented: file watcher, auto-save, recent files
 * - Pending: Integration with EditorStore for state sync
 */

import { invoke } from '@tauri-apps/api/core'

export async function fileRead(path: string): Promise<string> {
  return invoke<string>('file_read', { path })
}

export async function fileWrite(path: string, content: string): Promise<void> {
  return invoke<void>('file_write', { path, content })
}

export interface FileDialogResult {
  path: string
  content: string
}

export async function openFileDialog(): Promise<FileDialogResult | null> {
  return invoke<FileDialogResult | null>('file_open_dialog')
}

export async function saveFileDialog(
  defaultName?: string
): Promise<string | null> {
  return invoke<string | null>('file_save_dialog', { defaultName })
}
