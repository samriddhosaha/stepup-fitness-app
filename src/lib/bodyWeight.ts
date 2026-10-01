import { db } from '../db/schema'
import type { ProgressSnapshot } from '../db/types'

/** One reading per day: logging again on the same date replaces the earlier value. */
export async function saveBodyWeight(date: string, bodyWeightKg: number): Promise<void> {
  await db.transaction('rw', db.progressSnapshots, async () => {
    const same = await db.progressSnapshots.where('date').equals(date).toArray()
    const [keep, ...extra] = same
    if (keep?.id !== undefined) {
      await db.progressSnapshots.update(keep.id, { bodyWeightKg })
      await db.progressSnapshots.bulkDelete(extra.map((e) => e.id!).filter(Boolean)) // tidy pre-v2 duplicates
    } else {
      await db.progressSnapshots.add({ date, bodyWeightKg })
    }
  })
}

export async function deleteBodyWeight(id: number): Promise<void> {
  await db.progressSnapshots.delete(id)
}

/** Mean of the readings in the 7 days up to and including `endISO`; undefined with none. */
export function sevenDayAverage(readings: Pick<ProgressSnapshot, 'date' | 'bodyWeightKg'>[], endISO: string): number | undefined {
  const [y, m, d] = endISO.split('-').map(Number)
  const end = new Date(y!, (m ?? 1) - 1, d ?? 1)
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const window = readings.filter((r) => r.date >= iso(start) && r.date <= endISO)
  if (window.length === 0) return undefined
  return window.reduce((sum, r) => sum + r.bodyWeightKg, 0) / window.length
}
