import { ref, nextTick, watch } from 'vue'
import type { Ref } from 'vue'
import { listDirectory } from '../tauri/commands'
import type { DirEntry } from '../tauri/commands'
import type { QuickOpenFile } from '../types'
import type QuickOpen from '../ui/QuickOpen.vue'

export type ToastFn = (message: string, type?: 'error' | 'success') => void

interface UseQuickOpenOptions {
  /** Current workspace root; Quick Open is disabled without one. */
  workspaceRoot: Ref<string | null>
  showToast: ToastFn
  /** Opens a file by absolute path (same path as the sidebar tree). */
  openFileFromTree: (path: string) => void | Promise<void>
}

// Scan cache + cancellation. A monotonically increasing token invalidates
// stale scans (folder switch, close, re-open) so an old slow scan can never
// overwrite a fresher result.
interface QuickOpenCacheEntry {
  files: QuickOpenFile[]
  scannedAt: number
}

export function useQuickOpen(options: UseQuickOpenOptions) {
  const { workspaceRoot, showToast, openFileFromTree } = options

  const quickOpenOpen = ref(false)
  const quickOpenFiles = ref<QuickOpenFile[]>([])
  const quickOpenLoading = ref(false)
  const quickOpenError = ref('')
  const quickOpenEl = ref<InstanceType<typeof QuickOpen> | null>(null)

  const QUICK_OPEN_CACHE_TTL_MS = 30_000
  const quickOpenCache = new Map<string, QuickOpenCacheEntry>()
  let quickOpenScanToken = 0

  const QUICK_OPEN_MAX_FILES = 500
  const QUICK_OPEN_MAX_DIRS = 300
  // Non-hidden build/dependency dirs that are expensive to recurse and rarely
  // contain user docs. Dotfile directories (`.git`, `.DS_Store`, …) are already
  // hidden by the `list_directory` backend.
  const QUICK_OPEN_SKIP_DIRS = new Set([
    'node_modules',
    'dist',
    'target',
    'build',
    'out',
  ])

  function relativePathFromRoot(path: string, root: string): string {
    const normalizedRoot = root.replace(/[/\\]+$/, '')
    return path
      .slice(normalizedRoot.length)
      .replace(/^[/\\]+/, '')
      .replace(/\\/g, '/')
  }

  async function collectQuickOpenFiles(
    dirPath: string,
    rootPath: string,
    files: QuickOpenFile[],
    counters: { dirs: number },
    isCancelled: () => boolean,
  ) {
    if (isCancelled()) return
    if (files.length >= QUICK_OPEN_MAX_FILES || counters.dirs >= QUICK_OPEN_MAX_DIRS) return

    counters.dirs += 1
    const entries = await listDirectory(dirPath)

    if (isCancelled()) return

    const directories: DirEntry[] = []
    for (const entry of entries) {
      if (files.length >= QUICK_OPEN_MAX_FILES) return
      if (entry.is_dir) {
        if (!QUICK_OPEN_SKIP_DIRS.has(entry.name)) directories.push(entry)
        continue
      }

      if (entry.is_markdown) {
        files.push({
          name: entry.name,
          path: entry.path,
          relativePath: relativePathFromRoot(entry.path, rootPath),
        })
      }
    }

    for (const directory of directories) {
      if (files.length >= QUICK_OPEN_MAX_FILES || counters.dirs >= QUICK_OPEN_MAX_DIRS) return
      await collectQuickOpenFiles(directory.path, rootPath, files, counters, isCancelled)
    }
  }

  async function refreshQuickOpenFiles(force = false) {
    const root = workspaceRoot.value
    if (!root) return

    // Serve from cache when fresh (unless force-refreshed).
    const cached = quickOpenCache.get(root)
    const now = Date.now()
    if (!force && cached && now - cached.scannedAt < QUICK_OPEN_CACHE_TTL_MS) {
      quickOpenFiles.value = cached.files
      return
    }

    // Invalidate any in-flight scan and start a new one.
    const token = ++quickOpenScanToken
    const isCancelled = () => token !== quickOpenScanToken

    quickOpenLoading.value = true
    quickOpenError.value = ''

    try {
      const files: QuickOpenFile[] = []
      await collectQuickOpenFiles(root, root, files, { dirs: 0 }, isCancelled)

      // A newer scan started (or this one was cancelled); discard results.
      if (isCancelled()) return

      files.sort((a, b) =>
        a.relativePath.toLocaleLowerCase().localeCompare(b.relativePath.toLocaleLowerCase())
      )
      quickOpenCache.set(root, { files, scannedAt: Date.now() })
      quickOpenFiles.value = files
    } catch (error) {
      if (isCancelled()) return
      quickOpenError.value = error instanceof Error ? error.message : String(error)
    } finally {
      if (!isCancelled()) quickOpenLoading.value = false
    }
  }

  async function openQuickOpen() {
    if (!workspaceRoot.value) {
      showToast('Open a folder before using Quick Open')
      return
    }

    quickOpenOpen.value = true
    nextTick(() => quickOpenEl.value?.focus())

    // Refresh in the background if no cached result; cache hit keeps it instant.
    const cached = quickOpenCache.get(workspaceRoot.value)
    const fresh = cached && Date.now() - cached.scannedAt < QUICK_OPEN_CACHE_TTL_MS
    if (!fresh) {
      await refreshQuickOpenFiles()
      nextTick(() => quickOpenEl.value?.focus())
    } else {
      quickOpenFiles.value = cached!.files
    }
  }

  function closeQuickOpen() {
    // Invalidate any in-flight scan so it does not overwrite state after close.
    quickOpenScanToken += 1
    quickOpenOpen.value = false
  }

  function openQuickOpenFile(file: QuickOpenFile) {
    closeQuickOpen()
    openFileFromTree(file.path)
  }

  // Switching workspaces invalidates the file cache and any in-flight scan.
  watch(workspaceRoot, (next, prev) => {
    if (next === prev) return
    quickOpenScanToken += 1
    quickOpenFiles.value = []
    quickOpenCache.delete(prev ?? '')
  })

  return {
    quickOpenOpen,
    quickOpenFiles,
    quickOpenLoading,
    quickOpenError,
    quickOpenEl,
    openQuickOpen,
    closeQuickOpen,
    openQuickOpenFile,
  }
}
