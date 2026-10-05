/**
 * @file Cross-launch session state: what was open when the window last
 * changed, restored on a plain launch (no explicit file/workspace).
 *
 * Untitled documents never enter the session — their unsaved content is
 * crash-recovery territory (tempSave + checkCrashRecovery), and their names
 * are per-window unique so a restored path would be meaningless.
 */
import { watch, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import { fileRead } from '../tauri/commands'
import { readAppDataJson, writeAppDataJson } from '../tauri/appData'
import type { FileSlot } from '../types'

const SESSION_FILE = 'session.json'
const SESSION_WRITE_DEBOUNCE_MS = 500

export interface SessionFileEntry {
  path: string
}

export interface SessionData {
  files: SessionFileEntry[]
  active: number
}

/**
 * Reduce the open slots to a session snapshot. Only saved files participate;
 * `active` is translated to an index inside that saved-files array (an
 * untitled active slot degrades to the first saved file).
 */
export function buildSession(
  slots: Array<{ filePath: string | null }>,
  activeSlotIndex: number,
): SessionData {
  const files = slots
    .filter((slot): slot is { filePath: string } =>
      typeof slot.filePath === 'string' && slot.filePath.length > 0)
    .map((slot) => ({ path: slot.filePath }))
  const activePath = slots[activeSlotIndex]?.filePath
  let active = files.findIndex((f) => f.path === activePath)
  if (active < 0) active = 0
  return { files, active }
}

/**
 * Parse + validate a stored session. Structural garbage (bad JSON, missing
 * or non-array files, empty paths) is dropped; a stale `active` index is
 * clamped instead of discarding the whole session.
 */
export function parseSession(raw: string | null): SessionData | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const rawFiles = (data as { files?: unknown }).files
  if (!Array.isArray(rawFiles)) return null

  const files: SessionFileEntry[] = []
  for (const item of rawFiles) {
    const path = (item as { path?: unknown } | null)?.path
    if (typeof path === 'string' && path.length > 0) files.push({ path })
  }

  const rawActive = (data as { active?: unknown }).active
  let active = typeof rawActive === 'number' && Number.isInteger(rawActive) && rawActive >= 0
    ? rawActive
    : 0
  if (files.length > 0) active = Math.min(active, files.length - 1)

  return { files, active }
}

interface UseSessionOptions {
  openFiles: Ref<FileSlot[]>
  /** Index of the active slot in openFiles (-1 when none). */
  activeIndex: Ref<number>
  createFileSlot: (content?: string, filename?: string | null, filePath?: string | null) => FileSlot
  switchToFile: (id: string) => void
}

export function useSession(options: UseSessionOptions) {
  const { openFiles, activeIndex, createFileSlot, switchToFile } = options

  let writeTimer: ReturnType<typeof setTimeout> | null = null

  async function writeSessionSnapshot(): Promise<void> {
    try {
      await writeAppDataJson(SESSION_FILE, buildSession(openFiles.value, activeIndex.value))
    } catch {
      // Best effort: a failed snapshot write must never disturb the session.
    }
  }

  // Open / close / switch / save-as all end in one of three reactive
  // changes: openFiles membership, a slot's filePath (null -> path on first
  // save), or activeIndex. Watching exactly those (NOT deep — dirty/editor
  // churn must not trigger) and debouncing keeps writes rare and idempotent.
  watch(
    [() => openFiles.value.map((slot) => slot.filePath ?? ''), activeIndex],
    () => {
      if (writeTimer) clearTimeout(writeTimer)
      writeTimer = setTimeout(writeSessionSnapshot, SESSION_WRITE_DEBOUNCE_MS)
    },
  )

  /**
   * Reopen the files recorded in session.json. Only called when a window
   * launches without any explicit file (no workspace/file query param and no
   * pending OS-open files) — explicit opens always outrank the session.
   * Returns true when at least one file was restored.
   */
  async function restoreSession(): Promise<boolean> {
    const session = parseSession(await readAppDataJson(SESSION_FILE))
    if (!session || session.files.length === 0) return false

    const slotIdByIndex = new Map<number, string>()
    for (let i = 0; i < session.files.length; i++) {
      const entry = session.files[i]
      try {
        const content = await fileRead(entry.path)
        const parts = entry.path.split(/[/\\]/)
        const fn = parts[parts.length - 1] || 'Untitled.md'
        const slot = createFileSlot(content, fn, entry.path)
        slotIdByIndex.set(i, slot.id)
      } catch {
        // Deleted or unreadable since the last run: skip silently.
      }
    }

    const targetId =
      slotIdByIndex.get(session.active) ?? [...slotIdByIndex.values()][0]
    if (!targetId) return false
    switchToFile(targetId)
    return true
  }

  onBeforeUnmount(() => {
    if (writeTimer) clearTimeout(writeTimer)
  })

  return { restoreSession }
}
