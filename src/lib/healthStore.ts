import { db, setSetting, type StepUpDB } from '../db/schema'
import type { CheckIn, MeasurementType } from '../db/types'
import { todayISODate } from './format'
import { DEFAULT_HABITS, waterGoalFor, waterTotalFor } from './health'

// Thin database operations for the daily-health features. All "business rules"
// (goals, readiness, streaks) live in pure functions in health.ts. Weigh-ins go
// through saveBodyWeight() in bodyWeight.ts — the same one-reading-a-day rule as Progress.

// ---- Water ----------------------------------------------------------------

export async function addWater(
  ml: number,
  database: StepUpDB = db,
  date: string = todayISODate(),
): Promise<number> {
  return (await database.waterLogs.add({ date, ml, loggedAt: Date.now() })) as number
}

export async function removeWater(id: number, database: StepUpDB = db): Promise<void> {
  await database.waterLogs.delete(id)
}

// ---- Check-in -------------------------------------------------------------

export async function saveCheckIn(
  answers: Pick<CheckIn, 'sleepHours' | 'soreness' | 'energy'>,
  database: StepUpDB = db,
  date: string = todayISODate(),
): Promise<void> {
  // One check-in per day (unique index): answering again just updates it.
  await database.transaction('rw', database.checkIns, async () => {
    const existing = await database.checkIns.where('date').equals(date).first()
    await database.checkIns.put({ ...answers, id: existing?.id, date, createdAt: Date.now() })
  })
}

// ---- Habits ---------------------------------------------------------------

const HABITS_SEEDED_KEY = 'habitsSeeded'

/** Adds the starter habits once (fresh install or first launch after this feature shipped). */
export async function ensureDefaultHabits(database: StepUpDB = db): Promise<void> {
  if ((await database.settings.get(HABITS_SEEDED_KEY))?.value) return
  if ((await database.habits.count()) === 0) {
    const now = Date.now()
    await database.habits.bulkAdd(DEFAULT_HABITS.map((name, i) => ({ name, createdAt: now + i })))
  }
  await database.settings.put({ key: HABITS_SEEDED_KEY, value: true })
}

export async function addHabit(name: string, database: StepUpDB = db): Promise<number | null> {
  const trimmed = name.trim().slice(0, 40)
  if (trimmed === '') return null
  return (await database.habits.add({ name: trimmed, createdAt: Date.now() })) as number
}

export async function setHabitArchived(id: number, archived: boolean, database: StepUpDB = db): Promise<void> {
  await database.habits.update(id, { archived: archived ? true : undefined })
}

/** Marks the habit done/not done for a date. Returns whether it is now done. */
export async function toggleHabit(
  habitId: number,
  database: StepUpDB = db,
  date: string = todayISODate(),
): Promise<boolean> {
  return database.transaction('rw', database.habitLogs, async () => {
    const existing = await database.habitLogs.where('[habitId+date]').equals([habitId, date]).first()
    if (existing?.id !== undefined) {
      await database.habitLogs.delete(existing.id)
      return false
    }
    await database.habitLogs.add({ habitId, date })
    return true
  })
}

// ---- Body -----------------------------------------------------------------

export async function addMeasurement(
  type: MeasurementType,
  valueCm: number,
  database: StepUpDB = db,
  date: string = todayISODate(),
): Promise<number> {
  return (await database.bodyMeasurements.add({ date, type, valueCm })) as number
}

/** Latest weigh-in, else the weight from onboarding — used to size the water goal. */
export async function currentBodyWeightKg(database: StepUpDB = db): Promise<number | undefined> {
  const latest = await database.progressSnapshots.orderBy('date').last()
  if (latest) return latest.bodyWeightKg
  const profile = await database.profile.orderBy('createdAt').last()
  return profile?.startingWeightKg
}

// ---- Water reminders --------------------------------------------------------

const WATER_REMINDED_KEY = 'waterLastRemindedAt'

export async function markWaterReminded(at: number = Date.now()): Promise<void> {
  await setSetting(WATER_REMINDED_KEY, at)
}

/**
 * What the reminder check needs to decide on a water nudge, or undefined when the user hasn't
 * turned them on.
 */
export async function waterReminderInput(database: StepUpDB = db, date: string = todayISODate()) {
  const profile = await database.profile.orderBy('createdAt').last()
  const intervalHours = profile?.waterReminderHours
  if (!intervalHours) return undefined
  const [logs, weightKg, lastRemindedAt] = await Promise.all([
    database.waterLogs.where('date').equals(date).toArray(),
    currentBodyWeightKg(database),
    database.settings.get(WATER_REMINDED_KEY).then((row) => row?.value as number | undefined),
  ])
  return {
    intervalHours,
    intakeMl: waterTotalFor(logs, date),
    goalMl: waterGoalFor(profile?.waterGoalMl, weightKg),
    lastLogAt: logs.reduce<number | undefined>((latest, l) => (latest === undefined || l.loggedAt > latest ? l.loggedAt : latest), undefined),
    lastRemindedAt,
    onReminded: (at: number) => markWaterReminded(at),
  }
}
