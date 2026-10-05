/**
 * @file User preferences (prefs.json): theme, autosave behaviour and the
 * editor content width.
 *
 * Same persistence model as session.json: a tiny JSON document in the app
 * data dir via the shared appData helpers. Missing/invalid fields fall back
 * to defaults (parsePrefs), so a hand-edited or truncated prefs file can
 * never break the app. Disk writes are debounced (slider drags emit a burst
 * of changes) while the in-memory state updates immediately — every consumer
 * (theme attribute, autosave delay, editor width) is reactive on `prefs`.
 */
import { ref, watch, onBeforeUnmount, getCurrentInstance } from 'vue'
import type { Ref } from 'vue'
import { readAppDataJson, writeAppDataJson } from '../tauri/appData'

const PREFS_FILE = 'prefs.json'
const PREFS_WRITE_DEBOUNCE_MS = 500

export type ThemePreference = 'system' | 'light' | 'dark'

export interface Prefs {
  theme: ThemePreference
  autosaveEnabled: boolean
  autosaveDelayMs: number
  editorWidth: number
}

export const AUTOSAVE_DELAY_RANGE = { min: 1000, max: 10000 } as const
export const EDITOR_WIDTH_RANGE = { min: 600, max: 1200 } as const

export const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  autosaveEnabled: true,
  autosaveDelayMs: 3000,
  editorWidth: 800,
}

/** Round + clamp to [min, max]; non-numeric values fall back. */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : NaN
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/**
 * Parse + validate a stored prefs document. Anything unreadable or out of
 * range resolves to the default for that field; unknown extra fields are
 * ignored so future prefs can be added without breaking old versions.
 */
export function parsePrefs(raw: string | null): Prefs {
  if (!raw) return { ...DEFAULT_PREFS }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ...DEFAULT_PREFS }
  }
  if (!data || typeof data !== 'object') return { ...DEFAULT_PREFS }
  const o = data as Record<string, unknown>
  return {
    theme: o.theme === 'light' || o.theme === 'dark' ? o.theme : DEFAULT_PREFS.theme,
    autosaveEnabled:
      typeof o.autosaveEnabled === 'boolean'
        ? o.autosaveEnabled
        : DEFAULT_PREFS.autosaveEnabled,
    autosaveDelayMs: clampInt(
      o.autosaveDelayMs,
      AUTOSAVE_DELAY_RANGE.min,
      AUTOSAVE_DELAY_RANGE.max,
      DEFAULT_PREFS.autosaveDelayMs,
    ),
    editorWidth: clampInt(
      o.editorWidth,
      EDITOR_WIDTH_RANGE.min,
      EDITOR_WIDTH_RANGE.max,
      DEFAULT_PREFS.editorWidth,
    ),
  }
}

/**
 * Theme is applied to <html data-theme="system|light|dark"> before first
 * paint (the watch below is immediate and usePrefs is created in App setup).
 * CSS resolves it in editor/style.css:
 *   data-theme="dark"  → :root[data-theme="dark"] block
 *   data-theme="light" → light :root block only (OS dark block opted out)
 *   data-theme="system"→ falls through to @media (prefers-color-scheme)
 */
function applyTheme(theme: ThemePreference): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export function usePrefs() {
  const prefs = ref<Prefs>({ ...DEFAULT_PREFS })

  const stopThemeWatch = watch(
    () => prefs.value.theme,
    (theme) => applyTheme(theme),
    // Sync flush: theme flips are rare and the <html data-theme> attribute
    // must never lag the pref (also keeps tests and first-paint honest).
    { immediate: true, flush: 'sync' },
  )
  if (getCurrentInstance()) onBeforeUnmount(stopThemeWatch)

  async function loadPrefs(): Promise<void> {
    try {
      prefs.value = parsePrefs(await readAppDataJson(PREFS_FILE))
    } catch {
      // readAppDataJson already swallows read failures (returns null); this
      // is belt-and-braces so a broken store can never block startup.
    }
  }

  let writeTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Apply a new prefs value immediately and persist it (debounced). Called on
   * every SettingsModal control tick; low frequency apart from slider drags.
   */
  function savePrefs(next: Prefs): void {
    prefs.value = { ...next }
    if (writeTimer) clearTimeout(writeTimer)
    writeTimer = setTimeout(() => {
      writeTimer = null
      writeAppDataJson(PREFS_FILE, prefs.value).catch(() => {
        // Best effort: the change is already live in memory; a failed disk
        // write only costs persistence across launches.
      })
    }, PREFS_WRITE_DEBOUNCE_MS)
  }

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      if (writeTimer) clearTimeout(writeTimer)
    })
  }

  return { prefs: prefs as Ref<Prefs>, loadPrefs, savePrefs }
}
