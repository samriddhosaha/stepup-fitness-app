import { db, getSetting, setSetting } from '../db/schema'

// An opt-in, on-device error log so a bug report can include real details without any telemetry.
// Off by default; nothing is sent anywhere. The person exports it themselves.

const KEY_LOG = 'errorLog'
const KEY_ON = 'errorLogEnabled'
const MAX_ENTRIES = 50

export interface ErrorEntry {
  at: number
  message: string
  stack?: string
}

export const isErrorLogEnabled = async (): Promise<boolean> => Boolean(await getSetting<boolean>(KEY_ON))
export const setErrorLogEnabled = (on: boolean) => setSetting(KEY_ON, on)
export const readErrorLog = async (): Promise<ErrorEntry[]> => (await getSetting<ErrorEntry[]>(KEY_LOG)) ?? []
export async function clearErrorLog(): Promise<void> {
  await db.settings.delete(KEY_LOG)
}

export async function recordError(error: unknown, now = Date.now()): Promise<void> {
  if (!(await isErrorLogEnabled())) return
  const e = error instanceof Error ? error : new Error(String(error))
  const entry: ErrorEntry = { at: now, message: e.message.slice(0, 500), stack: e.stack?.slice(0, 2000) }
  await setSetting(KEY_LOG, [...(await readErrorLog()), entry].slice(-MAX_ENTRIES))
}

/** Hooks window-level errors; they are only stored when the log has been switched on. */
export function installErrorLogging(): void {
  window.addEventListener('error', (ev) => void recordError(ev.error ?? ev.message))
  window.addEventListener('unhandledrejection', (ev) => void recordError(ev.reason))
}

export function errorLogToText(entries: ErrorEntry[]): string {
  return entries.map((e) => `${new Date(e.at).toISOString()}  ${e.message}${e.stack ? `\n${e.stack}` : ''}`).join('\n\n') || 'No errors recorded.'
}
