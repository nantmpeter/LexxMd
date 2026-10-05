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
   * True while the user has already been warned about this slot's failed
   * save (disk error or external change). The autosave timer re-fires every
   * autosaveDelayMs, so without this flag a deleted/moved file would re-toast
   * the same error forever. Cleared by the slot's next successful save.
   */
  saveErrorNotified?: boolean
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
