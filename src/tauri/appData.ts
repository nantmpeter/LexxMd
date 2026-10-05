/**
 * @file Tiny JSON document store on top of the app data dir.
 *
 * Used by cross-launch state (session.json, recent.json). `file_write`
 * creates missing parent directories, so a fresh install without an app
 * data dir yet is handled on the Rust side; every failure here is surfaced
 * to the caller (read) or thrown (write) so composable code decides
 * whether it is fatal or best-effort.
 */

import { fileRead, fileWrite, getAppDataDir } from './commands'

function joinAppDataPath(dir: string, fileName: string): string {
  return dir.replace(/[/\\]+$/, '') + '/' + fileName
}

/** Read a JSON document from the app data dir; null when missing/unreadable/not in Tauri. */
export async function readAppDataJson(fileName: string): Promise<string | null> {
  try {
    const dir = await getAppDataDir()
    return await fileRead(joinAppDataPath(dir, fileName))
  } catch {
    return null
  }
}

/** Write a JSON document into the app data dir. */
export async function writeAppDataJson(fileName: string, data: unknown): Promise<void> {
  const dir = await getAppDataDir()
  await fileWrite(joinAppDataPath(dir, fileName), JSON.stringify(data))
}
