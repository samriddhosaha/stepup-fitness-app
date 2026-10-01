import { db } from '../db/schema'
import { todayISODate } from './format'

interface BackupPayload {
  version: 1
  exportedAt: number
  tables: {
    profile: unknown[]
    plans: unknown[]
    workoutSessions: unknown[]
    progressSnapshots: unknown[]
    personalRecords: unknown[]
    xpEvents: unknown[]
    appEvents: unknown[]
  }
}

export async function exportAllData(): Promise<void> {
  const payload: BackupPayload = {
    version: 1,
    exportedAt: Date.now(),
    tables: {
      profile: await db.profile.toArray(),
      plans: await db.plans.toArray(),
      workoutSessions: await db.workoutSessions.toArray(),
      progressSnapshots: await db.progressSnapshots.toArray(),
      personalRecords: await db.personalRecords.toArray(),
      xpEvents: await db.xpEvents.toArray(),
      appEvents: await db.appEvents.toArray(),
    },
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `stepup-backup-${todayISODate()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importAllData(file: File): Promise<void> {
  const text = await file.text()
  const payload = JSON.parse(text) as BackupPayload
  if (payload.version !== 1 || !payload.tables) {
    throw new Error('This file doesn’t look like a StepUp backup.')
  }

  await db.transaction(
    'rw',
    [
      db.profile,
      db.plans,
      db.workoutSessions,
      db.progressSnapshots,
      db.personalRecords,
      db.xpEvents,
      db.appEvents,
    ],
    async () => {
      await Promise.all([
        db.profile.clear(),
        db.plans.clear(),
        db.workoutSessions.clear(),
        db.progressSnapshots.clear(),
        db.personalRecords.clear(),
        db.xpEvents.clear(),
        db.appEvents.clear(),
      ])
      await db.profile.bulkAdd(payload.tables.profile as never[])
      await db.plans.bulkAdd(payload.tables.plans as never[])
      await db.workoutSessions.bulkAdd(payload.tables.workoutSessions as never[])
      await db.progressSnapshots.bulkAdd(payload.tables.progressSnapshots as never[])
      await db.personalRecords.bulkAdd(payload.tables.personalRecords as never[])
      await db.xpEvents.bulkAdd(payload.tables.xpEvents as never[])
      await db.appEvents.bulkAdd(payload.tables.appEvents as never[])
    },
  )
}
