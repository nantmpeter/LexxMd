/**
 * @file Frontend IPC wrapper for Tauri backend commands
 */

import { invoke } from '@tauri-apps/api/core'

export async function fileRead(path: string): Promise<string> {
  return invoke<string>('file_read', { path })
}

/**
 * Read a file as base64. Used by DOCX export: the packaged webview's
 * fetch() cannot read asset:// URLs, so local image bytes must be
 * round-tripped through this command.
 */
export async function fileReadBinary(path: string): Promise<string> {
  return invoke<string>('file_read_binary', { path })
}

export async function fileWrite(path: string, content: string): Promise<void> {
  return invoke<void>('file_write', { path, content })
}

export interface FileDialogResult {
  path: string
  content: string
}

export async function openFileDialog(): Promise<FileDialogResult[]> {
  return invoke<FileDialogResult[]>('file_open_dialog')
}

export async function saveFileDialog(
  defaultName?: string
): Promise<string | null> {
  return invoke<string | null>('file_save_dialog', { defaultName })
}

export async function saveFileDialogWithFilter(
  defaultName: string,
  filters: Array<{ name: string; extensions: string[] }>
): Promise<string | null> {
  return invoke<string | null>('file_save_dialog', { defaultName, filters })
}

export async function fileWriteBinary(path: string, base64Content: string): Promise<void> {
  return invoke<void>('file_write_binary', { path, content: base64Content })
}

export async function getAppDataDir(): Promise<string> {
  return invoke<string>('get_app_data_dir')
}

// ── Auto-save / crash recovery ────────────────────────────

export interface TempFile {
  path: string
  filename: string
  modified: number
}

export async function tempSave(filename: string, content: string): Promise<string> {
  return invoke<string>('temp_save', { filename, content })
}

export async function listTempFiles(): Promise<TempFile[]> {
  return invoke<TempFile[]>('list_temp_files')
}

export async function deleteTempFile(path: string): Promise<void> {
  return invoke<void>('delete_temp_file', { path })
}

export async function updateWindowTitle(title: string): Promise<void> {
  return invoke<void>('update_window_title', { title })
}

// ── File explorer / sidebar ─────────────────────────────────

export interface DirEntry {
  name: string
  path: string
  is_dir: boolean
  is_markdown: boolean
}

export async function directoryOpenDialog(): Promise<string | null> {
  return invoke<string | null>('directory_open_dialog')
}

export async function listDirectory(dirPath: string): Promise<DirEntry[]> {
  return invoke<DirEntry[]>('list_directory', { dirPath })
}

export async function openFolderInNewWindow(folderPath: string): Promise<void> {
  return invoke<void>('open_folder_in_new_window', { folderPath })
}

export async function openFileInNewWindow(filePath: string): Promise<void> {
  return invoke<void>('open_file_in_new_window', { filePath })
}

export async function toggleFullscreen(): Promise<void> {
  return invoke<void>('toggle_fullscreen')
}

export async function drainPendingFiles(): Promise<string[]> {
  return invoke<string[]>('drain_pending_files')
}

/**
 * Drop a path from the backend startup buffer. Called right after this window
 * handled a `file-open` event: the macOS Opened path both emits and buffers
 * (the buffer is the cold-launch fallback), and without consuming the buffered
 * copy the next new window's drainPendingFiles would open the file again.
 */
export async function consumePendingFile(path: string): Promise<void> {
  return invoke<void>('consume_pending_file', { path })
}

// ── App exit (quit save flow) ──────────────────────────────

/**
 * This window finished its app-exit save flow (nothing dirty / saved / user
 * confirmed discarding). The backend exits once every expected window has
 * reported. Custom command → works from every window, unlike plugin `exit()`
 * which the "main"-only capability does not grant to secondary windows.
 */
export async function appExitReady(): Promise<void> {
  return invoke<void>('app_exit_ready')
}

/** This window declined to discard unsaved changes: the quit is called off. */
export async function appExitCancel(): Promise<void> {
  return invoke<void>('app_exit_cancel')
}
