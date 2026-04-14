/**
 * IMPLEMENTATION SCOPE:
 * - Implemented: Zustand vanilla store for editor state management
 *   (filename, filePath, content, dirty, lastSaved, language)
 * - Not implemented: Vue composable wrapper for reactive bindings,
 *   IPC integration with Tauri backend
 * - Pending: Wire store into App.vue and editor lifecycle for
 *   full state synchronization
 */

import { createStore } from 'zustand/vanilla'

export interface EditorState {
  filename: string
  filePath: string | null
  content: string
  dirty: boolean
  lastSaved: string | null
  language: 'markdown'
}

export interface EditorActions {
  setFilename: (name: string) => void
  setFilePath: (path: string | null) => void
  setContent: (content: string) => void
  markDirty: () => void
  markSaved: () => void
}

export type EditorStore = EditorState & EditorActions

export const editorStore = createStore<EditorStore>((set) => ({
  filename: 'Untitled.md',
  filePath: null,
  content: '',
  dirty: false,
  lastSaved: null,
  language: 'markdown',

  setFilename: (name) => set({ filename: name }),
  setFilePath: (path) => set({ filePath: path }),
  setContent: (content) => set({ content, dirty: true }),
  markDirty: () => set({ dirty: true }),
  markSaved: () => set({ dirty: false, lastSaved: new Date().toISOString() }),
}))

export function useEditorStore() {
  return editorStore.getState()
}
