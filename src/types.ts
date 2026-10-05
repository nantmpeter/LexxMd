// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EditorType = any

export interface FileSlot {
  id: string
  filePath: string | null
  filename: string
  dirty: boolean
  editor: EditorType | null
  element: HTMLElement | null
  lastSavedContent: string
  /** Full path of the crash-recovery temp copy returned by tempSave (untitled slots only). */
  tempPath?: string | null
  /**
   * Set after the user was told this file differs on disk from
   * lastSavedContent; suppresses repeat focus toasts until the mismatch
   * resolves (reopened → fresh slot, or re-saved → flag reset).
   */
  externalChangeNotified?: boolean
}

export type SidebarMode = 'hidden' | 'tree' | 'flat'

export interface TreeNode {
  name: string
  path: string
  isDir: boolean
  isMarkdown: boolean
  children: TreeNode[]
  expanded: boolean
  loaded: boolean
}

export interface QuickOpenFile {
  name: string
  path: string
  relativePath: string
}
