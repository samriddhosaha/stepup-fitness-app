import { afterEach, describe, expect, it } from 'vitest'
import { StepUpDB } from '../db/schema'
import type { Profile } from '../db/types'
import {
  addHabit,
  addMeasurement,
  addWater,
  currentBodyWeightKg,
  ensureDefaultHabits,
  removeWater,
  saveCheckIn,
  setHabitArchived,
  toggleHabit,
  waterReminderInput,
} from './healthStore'
import { DEFAULT_HABITS } from './health'

const opened: StepUpDB[] = []
let n = 0
afterEach(() => {
  while (opened.length) opened.pop()!.close()
})

async function freshDb(): Promise<StepUpDB> {
  const db = new StepUpDB(`health-store-${n++}`)
  await db.open()
  opened.push(db)
  return db
}

describe('default habits', () => {
  it('seeds the starter habits once', async () => {
    const db = await freshDb()
    await ensureDefaultHabits(db)
    await ensureDefaultHabits(db)
    expect((await db.habits.toArray()).map((h) => h.name)).toEqual(DEFAULT_HABITS)
  })

  it('does not bring them back after the user deletes them all', async () => {
    const db = await freshDb()
    await ensureDefaultHabits(db)
    await db.habits.clear()
    await ensureDefaultHabits(db)
    expect(await db.habits.count()).toBe(0)
  })

  it('does not add starters on top of habits that already exist (e.g. a restored backup)', async () => {
    const db = await freshDb()
    await db.habits.add({ name: 'Cold shower', createdAt: 1 })
    await ensureDefaultHabits(db)
    expect((await db.habits.toArray()).map((h) => h.name)).toEqual(['Cold shower'])
  })
})

describe('habits', () => {
  it('toggles done / not done for a date', async () => {
    const db = await freshDb()
    const id = (await addHabit('Stretch', db))!
    expect(await toggleHabit(id, db, '2026-10-31')).toBe(true)
    expect(await db.habitLogs.count()).toBe(1)
    expect(await toggleHabit(id, db, '2026-10-31')).toBe(false)
    expect(await db.habitLogs.count()).toBe(0)
  })

  it('keeps days independent', async () => {
    const db = await freshDb()
    const id = (await addHabit('Stretch', db))!
    await toggleHabit(id, db, '2026-10-30')
    await toggleHabit(id, db, '2026-10-31')
    await toggleHabit(id, db, '2026-10-31')
    expect((await db.habitLogs.toArray()).map((l) => l.date)).toEqual(['2026-10-30'])
  })

  it('survives a double tap without tripping the one-log-per-day index', async () => {
    const db = await freshDb()
    const id = (await addHabit('Stretch', db))!
    await Promise.all([toggleHabit(id, db, '2026-10-31'), toggleHabit(id, db, '2026-10-31')])
    expect(await db.habitLogs.count()).toBeLessThanOrEqual(1)
  })

  it('trims names, rejects blanks, and archives without deleting history', async () => {
    const db = await freshDb()
    expect(await addHabit('   ', db)).toBeNull()
    const id = (await addHabit('  Walk  ', db))!
    expect((await db.habits.get(id))?.name).toBe('Walk')
    await toggleHabit(id, db, '2026-10-31')
    await setHabitArchived(id, true, db)
    expect((await db.habits.get(id))?.archived).toBe(true)
    expect(await db.habitLogs.count()).toBe(1)
    await setHabitArchived(id, false, db)
    expect((await db.habits.get(id))?.archived).toBeUndefined()
  })
})

describe('check-in', () => {
  it('answering twice in a day updates the one entry', async () => {
    const db = await freshDb()
    await saveCheckIn({ sleepHours: 7, soreness: 1, energy: 3 }, db, '2026-10-31')
    await saveCheckIn({ sleepHours: 5, soreness: 3, energy: 1 }, db, '2026-10-31')
    const rows = await db.checkIns.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ sleepHours: 5, soreness: 3, energy: 1, date: '2026-10-31' })
  })
})

describe('water', () => {
  it('adds and removes entries', async () => {
    const db = await freshDb()
    const a = await addWater(250, db, '2026-10-31')
    await addWater(500, db, '2026-10-31')
    expect(await db.waterLogs.where('date').equals('2026-10-31').count()).toBe(2)
    await removeWater(a, db)
    expect((await db.waterLogs.toArray()).map((l) => l.ml)).toEqual([500])
  })
})

describe('body', () => {
  it('uses the latest weigh-in, else the onboarding weight, else nothing', async () => {
    const db = await freshDb()
    expect(await currentBodyWeightKg(db)).toBeUndefined()
    await db.profile.add({
      name: 'A',
      fitnessLevel: 'regular',
      liftsAlready: true,
      doesCardioAlready: false,
      primaryGoal: 'build-muscle',
      daysPerWeek: 3,
      sessionLengthMinutes: 45,
      equipment: [],
      trainingPreferences: [],
      weightUnit: 'kg',
      appearance: 'system',
      onboardingCompleted: true,
      createdAt: 1,
      startingWeightKg: 80,
    })
    expect(await currentBodyWeightKg(db)).toBe(80)
    await db.progressSnapshots.add({ date: '2026-10-20', bodyWeightKg: 78.5 })
    await db.progressSnapshots.add({ date: '2026-10-30', bodyWeightKg: 77.9 })
    expect(await currentBodyWeightKg(db)).toBe(77.9)
  })

  it('stores measurements', async () => {
    const db = await freshDb()
    await addMeasurement('waist', 85, db, '2026-10-31')
    expect(await db.bodyMeasurements.toArray()).toMatchObject([{ type: 'waist', valueCm: 85, date: '2026-10-31' }])
  })
})

describe('water reminder input', () => {
  const profile: Profile = {
    name: 'A',
    fitnessLevel: 'regular',
    liftsAlready: true,
    doesCardioAlready: false,
    primaryGoal: 'build-muscle',
    daysPerWeek: 3,
    sessionLengthMinutes: 45,
    equipment: [],
    trainingPreferences: [],
    weightUnit: 'kg',
    appearance: 'system',
    onboardingCompleted: true,
    createdAt: 1,
  }

  it('is undefined until the user turns reminders on', async () => {
    const db = await freshDb()
    await db.profile.add({ ...profile })
    expect(await waterReminderInput(db, '2026-10-31')).toBeUndefined()
  })

  it('reports today’s intake, goal and the time of the last drink', async () => {
    const db = await freshDb()
    await db.profile.add({ ...profile, waterReminderHours: 3, waterGoalMl: 2500 })
    await db.waterLogs.bulkAdd([
      { date: '2026-10-31', ml: 250, loggedAt: 100 },
      { date: '2026-10-31', ml: 500, loggedAt: 300 },
      { date: '2026-10-30', ml: 900, loggedAt: 999 }, // yesterday: ignored
    ])
    const input = await waterReminderInput(db, '2026-10-31')
    expect(input).toMatchObject({ intervalHours: 3, intakeMl: 750, goalMl: 2500, lastLogAt: 300, lastRemindedAt: undefined })
  })

  it('remembers when the last nudge was sent', async () => {
    const db = await freshDb()
    await db.profile.add({ ...profile, waterReminderHours: 2 })
    await db.settings.put({ key: 'waterLastRemindedAt', value: 12345 })
    expect((await waterReminderInput(db, '2026-10-31'))?.lastRemindedAt).toBe(12345)
  })
})
