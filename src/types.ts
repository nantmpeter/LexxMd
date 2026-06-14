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
