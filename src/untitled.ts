/**
 * Unique name for untitled documents.
 *
 * Must be unique across windows, not just tabs: the crash-recovery temp
 * directory is shared app-wide, so a per-window counter (or a constant name)
 * would make two windows holding untitled documents overwrite each other's
 * `temp_save` copies.
 */

let fallbackCounter = 0

export function uniqueUntitledName(): string {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return `Untitled-${cryptoObj.randomUUID().slice(0, 8)}.md`
  }
  // Ancient webview fallback: timestamp + process-local counter.
  fallbackCounter += 1
  return `Untitled-${Date.now().toString(36)}-${fallbackCounter}.md`
}
