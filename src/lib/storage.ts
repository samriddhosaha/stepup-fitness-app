import { db, getSetting, setSetting } from '../db/schema'

/** Asks the browser not to evict our data (Safari can drop script-writable storage after ~7 idle days). */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    const already = await navigator.storage.persisted?.()
    const granted = already || (await navigator.storage.persist())
    await setSetting('storagePersisted', granted)
    return granted
  } catch {
    return false
  }
}

export async function isStoragePersisted(): Promise<boolean | undefined> {
  if (!navigator.storage?.persisted) return undefined
  try {
    return await navigator.storage.persisted()
  } catch {
    return undefined
  }
}

export const BACKUP_NUDGE_AFTER_WORKOUTS = 10

/** How many workouts have been completed since the last backup (all of them if never backed up). */
export async function workoutsSinceBackup(): Promise<{ count: number; lastBackupAt?: number }> {
  const lastBackupAt = await getSetting<number>('lastBackupAt')
  const count = await db.workoutSessions
    .where('completedAt')
    .above(lastBackupAt ?? 0)
    .count()
  return { count, lastBackupAt }
}

export const shouldNudgeBackup = (count: number): boolean => count >= BACKUP_NUDGE_AFTER_WORKOUTS
