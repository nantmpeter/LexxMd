/**
 * @file Cross-launch "recent files" for Quick Open: every successful open or
 * save-to-a-new-path records the file in appData/recent.json (deduped, newest
 * first, capped). Works without an open workspace, which is where Quick Open
 * previously had nothing to show.
 */
import { ref } from 'vue'
import type { Ref } from 'vue'
import { readAppDataJson, writeAppDataJson } from '../tauri/appData'
import type { QuickOpenFile } from '../types'

const RECENT_FILE = 'recent.json'

export const RECENT_FILES_MAX = 20

export interface RecentFile {
  path: string
  name: string
  ts: number
}

export function basename(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || path
}

/**
 * Move `path` to the front of the list (new ts), dropping any older entry
 * for the same path, and cap the list. Pure so it is directly testable.
 */
export function pushRecent(
  list: RecentFile[],
  path: string,
  now: number = Date.now(),
  max: number = RECENT_FILES_MAX,
): RecentFile[] {
  const rest = list.filter((f) => f.path !== path)
  return [{ path, name: basename(path), ts: now }, ...rest].slice(0, max)
}

/** Parse + validate the stored list; anything malformed degrades to []. */
export function parseRecents(raw: string | null): RecentFile[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []

  const out: RecentFile[] = []
  for (const item of data) {
    const path = (item as { path?: unknown } | null)?.path
    if (typeof path !== 'string' || path.length === 0) continue
    const name = (item as { name?: unknown }).name
    const ts = (item as { ts?: unknown }).ts
    out.push({
      path,
      name: typeof name === 'string' && name.length > 0 ? name : basename(path),
      ts: typeof ts === 'number' ? ts : 0,
    })
  }
  return out
}

/** Shape recents for the QuickOpen list; the secondary line shows the folder. */
export function toQuickOpenFiles(list: RecentFile[]): QuickOpenFile[] {
  return list.map((f) => {
    const dir = f.path.slice(0, f.path.length - f.name.length).replace(/[/\\]+$/, '')
    return { name: f.name, path: f.path, relativePath: dir || f.path }
  })
}

export function useRecentFiles() {
  const recentFiles: Ref<QuickOpenFile[]> = ref([])

  async function initRecents(): Promise<void> {
    try {
      recentFiles.value = toQuickOpenFiles(parseRecents(await readAppDataJson(RECENT_FILE)))
    } catch {
      // Best effort: an unreadable store just means an empty Recent group.
    }
  }

  /** Record one file as just opened/saved. Never rejects, never throws. */
  async function recordRecentFile(path: string): Promise<void> {
    try {
      const next = pushRecent(parseRecents(await readAppDataJson(RECENT_FILE)), path)
      recentFiles.value = toQuickOpenFiles(next)
      await writeAppDataJson(RECENT_FILE, next)
    } catch {
      // Best effort: failing to record a recent file must never disturb
      // the open/save flow that triggered it.
    }
  }

  return {
    recentFiles,
    initRecents,
    recordRecentFile,
  }
}
