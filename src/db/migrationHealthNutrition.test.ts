import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { StepUpDB } from './schema'

/** A database exactly as it was at schema v3 (the last version before daily health and nutrition). */
async function seedV3(name: string) {
  const v3 = new Dexie(name)
  v3.version(1).stores({
    profile: '++id, createdAt',
    plans: '++id, createdAt',
    exercises: 'id, movementPattern, substitutionGroupId',
    workoutSessions: '++id, date, completedAt',
    progressSnapshots: '++id, date',
    personalRecords: '++id, exerciseId, achievedAt',
    xpEvents: '++id, type, occurredAt',
    appEvents: '++id, name, occurredAt',
  })
  v3.version(2).stores({
    personalRecords: '++id, exerciseId, achievedAt, sessionId',
    exerciseState: 'exerciseId',
    settings: 'key',
    weeklyReviews: 'weekKey',
  })
  v3.version(3).stores({ customExercises: 'id' })
  await v3.open()
  await v3.table('profile').add({ name: 'Existing', onboardingCompleted: true, createdAt: 1 })
  await v3.table('progressSnapshots').add({ date: '2026-01-01', bodyWeightKg: 80 })
  await v3.table('settings').put({ key: 'installToken', value: 'abc' })
  await v3.table('workoutSessions').add({
    date: '2026-01-01',
    planSessionName: 'A',
    startedAt: 1,
    completedAt: 2,
    skips: [],
    exercises: [{ exerciseId: 'goblet-squat', sets: [{ setIndex: 0, weightKg: 20, reps: 8 }] }],
  })
  v3.close()
}

describe('schema v3 → v5 (daily health and nutrition)', () => {
  it('adds the new tables empty and leaves every existing row alone', async () => {
    await seedV3('mig-v3')
    const db = new StepUpDB('mig-v3')
    await db.open()

    expect(db.verno).toBe(5)
    expect((await db.profile.toArray())[0]?.name).toBe('Existing')
    expect(await db.progressSnapshots.count()).toBe(1)
    expect(await db.workoutSessions.count()).toBe(1)
    expect((await db.settings.get('installToken'))?.value).toBe('abc')
    for (const table of [db.waterLogs, db.bodyMeasurements, db.checkIns, db.habits, db.habitLogs, db.foods, db.mealLogs, db.savedMeals]) {
      expect(await table.count()).toBe(0)
    }
    db.close()
  })

  it('enforces one check-in per day', async () => {
    const db = new StepUpDB('mig-checkins')
    await db.open()
    await db.checkIns.add({ date: '2026-10-31', sleepHours: 7, soreness: 1, energy: 3, createdAt: 1 })
    await expect(db.checkIns.add({ date: '2026-10-31', sleepHours: 5, soreness: 3, energy: 1, createdAt: 2 })).rejects.toThrow()
    await db.checkIns.add({ date: '2026-11-01', sleepHours: 5, soreness: 3, energy: 1, createdAt: 3 })
    expect(await db.checkIns.count()).toBe(2)
    db.close()
  })

  it('enforces one log per habit per day, but allows the same day for different habits', async () => {
    const db = new StepUpDB('mig-habits')
    await db.open()
    const a = (await db.habits.add({ name: 'A', createdAt: 1 })) as number
    const b = (await db.habits.add({ name: 'B', createdAt: 2 })) as number
    await db.habitLogs.add({ habitId: a, date: '2026-10-31' })
    await expect(db.habitLogs.add({ habitId: a, date: '2026-10-31' })).rejects.toThrow()
    await db.habitLogs.add({ habitId: b, date: '2026-10-31' })
    expect(await db.habitLogs.count()).toBe(2)
    db.close()
  })

  it('supports the indexed lookups the screens use', async () => {
    const db = new StepUpDB('mig-indexes')
    await db.open()
    await db.waterLogs.bulkAdd([
      { date: '2026-10-30', ml: 250, loggedAt: 1 },
      { date: '2026-10-31', ml: 500, loggedAt: 2 },
    ])
    await db.bodyMeasurements.add({ date: '2026-10-31', type: 'waist', valueCm: 85 })
    await db.mealLogs.add({ date: '2026-10-31', name: 'Roti', servings: 2, loggedAt: 1, calories: 210, proteinG: 7, carbsG: 36, fatG: 4 })
    await db.foods.add({ name: 'My bar', servingLabel: '1 bar', calories: 200, proteinG: 20, carbsG: 15, fatG: 7, createdAt: 1 })
    expect(await db.waterLogs.where('date').equals('2026-10-31').count()).toBe(1)
    expect(await db.bodyMeasurements.where('type').equals('waist').count()).toBe(1)
    expect(await db.mealLogs.where('date').equals('2026-10-31').count()).toBe(1)
    expect(await db.foods.where('name').equals('My bar').count()).toBe(1)
    db.close()
  })
})
