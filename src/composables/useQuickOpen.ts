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
  const { workspaceRoot, openFileFromTree } = options

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
  // Max list_directory IPCs kept in flight at once: each wave reads a batch
  // of directories concurrently, which cuts deep-tree latency without
  // flooding the IPC bridge.
  const QUICK_OPEN_SCAN_CONCURRENCY = 8

  interface QuickOpenScanCounters {
    dirs: number
  }
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

  // Reads one directory's listing. Returns the subdirectories to visit
  // next, or null when the directory is unreadable (bad permissions,
  // dangling link): one failing directory is skipped instead of voiding
  // the whole scan. `files` is shared across concurrent workers; the JS
  // event loop makes the check-then-push below atomic.
  async function scanQuickOpenDirectory(
    dirPath: string,
    rootPath: string,
    files: QuickOpenFile[],
    counters: QuickOpenScanCounters,
    isCancelled: () => boolean,
  ): Promise<string[] | null> {
    if (isCancelled()) return null
    if (files.length >= QUICK_OPEN_MAX_FILES || counters.dirs >= QUICK_OPEN_MAX_DIRS) return null

    counters.dirs += 1

    let entries: DirEntry[]
    try {
      entries = await listDirectory(dirPath)
    } catch (error) {
      // The workspace root failing means nothing can be scanned at all —
      // surface that to the user (same as before). Any nested directory
      // failing is skipped so one bad folder keeps the rest of the scan.
      if (dirPath === rootPath) throw error
      return null
    }

    if (isCancelled()) return null

    const subdirectories: string[] = []
    for (const entry of entries) {
      if (entry.is_dir) {
        if (!QUICK_OPEN_SKIP_DIRS.has(entry.name)) subdirectories.push(entry.path)
        continue
      }

      if (entry.is_markdown && files.length < QUICK_OPEN_MAX_FILES) {
        files.push({
          name: entry.name,
          path: entry.path,
          relativePath: relativePathFromRoot(entry.path, rootPath),
        })
      }
    }

    return subdirectories
  }

  // Breadth-first scan: each wave reads up to QUICK_OPEN_SCAN_CONCURRENCY
  // directory listings concurrently, then feeds their subdirectories into
  // the next wave.
  async function collectQuickOpenFiles(
    rootPath: string,
    files: QuickOpenFile[],
    counters: QuickOpenScanCounters,
    isCancelled: () => boolean,
  ) {
    const queue: string[] = [rootPath]

    while (
      queue.length > 0 &&
      !isCancelled() &&
      files.length < QUICK_OPEN_MAX_FILES &&
      counters.dirs < QUICK_OPEN_MAX_DIRS
    ) {
      const wave = queue.splice(0, QUICK_OPEN_SCAN_CONCURRENCY)
      const next = await Promise.all(
        wave.map((dirPath) =>
          scanQuickOpenDirectory(dirPath, rootPath, files, counters, isCancelled)
        ),
      )
      for (const subdirectories of next) {
        if (subdirectories) queue.push(...subdirectories)
      }
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
      await collectQuickOpenFiles(root, files, { dirs: 0 }, isCancelled)

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
    // Recent files make Quick Open useful without a workspace, so the panel
    // always opens; the workspace scan only runs when a root is set.
    quickOpenOpen.value = true
    nextTick(() => quickOpenEl.value?.focus())

    const root = workspaceRoot.value
    if (!root) return

    // Refresh in the background if no cached result; cache hit keeps it instant.
    const cached = quickOpenCache.get(root)
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
