import { beforeEach, describe, expect, it } from 'vitest'
import { ALL_TABLES, db, setSetting } from '../db/schema'
import { applyBackup, buildBackup, parseBackup } from './backup'
import type { Profile } from '../db/types'

const profile: Profile = {
  name: 'Sam',
  fitnessLevel: 'regular',
  liftsAlready: true,
  doesCardioAlready: false,
  primaryGoal: 'build-muscle',
  daysPerWeek: 3,
  sessionLengthMinutes: 45,
  equipment: ['dumbbells'],
  trainingPreferences: [],
  weightUnit: 'kg',
  appearance: 'system',
  onboardingCompleted: true,
  createdAt: 1,
  waterGoalMl: 2500,
  waterReminderHours: 3,
  activityLevel: 'moderate',
  nutritionGoal: 'lose',
  calorieTargetKcal: 2200,
  proteinTargetG: 150,
  aiCoachSource: 'own-key',
}

async function wipe() {
  await Promise.all(ALL_TABLES.map((t) => db.table(t).clear()))
  await db.settings.clear()
}
beforeEach(wipe)

async function seed() {
  await db.profile.add(profile)
  await db.waterLogs.bulkAdd([{ date: '2026-10-31', ml: 250, loggedAt: 1 }, { date: '2026-10-31', ml: 500, loggedAt: 2 }])
  await db.bodyMeasurements.add({ date: '2026-10-31', type: 'waist', valueCm: 85 })
  await db.checkIns.add({ date: '2026-10-31', sleepHours: 8, soreness: 2, energy: 3, createdAt: 5 })
  const habit = (await db.habits.add({ name: 'Creatine', createdAt: 1 })) as number
  await db.habitLogs.add({ habitId: habit, date: '2026-10-31' })
  await db.foods.add({ name: 'My bar', servingLabel: '1 bar', calories: 200, proteinG: 20, carbsG: 15, fatG: 7, createdAt: 1 })
  await db.mealLogs.add({ date: '2026-10-31', name: 'Roti / chapati', servings: 2, loggedAt: 1, foodRef: 'seed:roti', calories: 210, proteinG: 7, carbsG: 36, fatG: 4 })
  await db.savedMeals.add({ name: 'Usual lunch', calories: 600, proteinG: 40, carbsG: 60, fatG: 20, createdAt: 1 })
}

const tables = ['waterLogs', 'bodyMeasurements', 'checkIns', 'habits', 'habitLogs', 'foods', 'mealLogs', 'savedMeals'] as const

describe('backup carries daily-health and nutrition data', () => {
  it('round-trips every new table, through a real file', async () => {
    await seed()
    const before = Object.fromEntries(await Promise.all(tables.map(async (t) => [t, await db.table(t).toArray()])))

    const parsed = parseBackup(JSON.stringify(await buildBackup()))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    await wipe()
    await applyBackup(parsed.backup)

    for (const t of tables) expect(await db.table(t).toArray(), t).toEqual(before[t])
  })

  it('keeps the new profile settings (zod would drop fields it does not know)', async () => {
    await seed()
    const parsed = parseBackup(JSON.stringify(await buildBackup()))
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.backup.tables.profile[0]).toMatchObject({
      waterGoalMl: 2500,
      waterReminderHours: 3,
      activityLevel: 'moderate',
      nutritionGoal: 'lose',
      calorieTargetKcal: 2200,
      proteinTargetG: 150,
      aiCoachSource: 'own-key',
    })
  })

  it('keeps workout notes and superset links on a session', async () => {
    await db.workoutSessions.add({
      date: '2026-10-31',
      planSessionName: 'A',
      startedAt: 1,
      completedAt: 2,
      skips: [],
      notes: 'felt strong',
      supersetLinks: [0],
      exercises: [{ exerciseId: 'goblet-squat', supersetGroup: 'superset-1', sets: [{ setIndex: 0, weightKg: 20, reps: 8 }] }],
    })
    const parsed = parseBackup(JSON.stringify(await buildBackup()))
    if (!parsed.ok) throw new Error(parsed.error)
    const s = parsed.backup.tables.workoutSessions[0]
    expect(s?.notes).toBe('felt strong')
    expect(s?.supersetLinks).toEqual([0])
    expect(s?.exercises[0]?.supersetGroup).toBe('superset-1')
  })

  it('still restores a backup made before these tables existed', () => {
    const v3 = {
      version: 3,
      exportedAt: 1,
      tables: { profile: [], plans: [], workoutSessions: [], progressSnapshots: [], personalRecords: [], xpEvents: [] },
    }
    const parsed = parseBackup(JSON.stringify(v3))
    expect(parsed.ok).toBe(true)
  })

  it('replaces (not merges) the new tables on restore', async () => {
    await seed()
    const parsed = parseBackup(JSON.stringify(await buildBackup()))
    if (!parsed.ok) throw new Error(parsed.error)
    await db.waterLogs.add({ date: '2026-01-01', ml: 999, loggedAt: 9 })
    await applyBackup(parsed.backup)
    expect((await db.waterLogs.toArray()).map((w) => w.ml).sort()).toEqual([250, 500])
  })

  it('rejects a damaged row and changes nothing', async () => {
    await seed()
    const file = JSON.parse(JSON.stringify(await buildBackup()))
    file.tables.mealLogs[0].calories = 'lots'
    const parsed = parseBackup(JSON.stringify(file))
    expect(parsed.ok).toBe(false)
  })

  it('rolls back everything if a restore hits a duplicate (one check-in per day)', async () => {
    await seed()
    const file = JSON.parse(JSON.stringify(await buildBackup()))
    file.tables.checkIns.push({ ...file.tables.checkIns[0], id: 99 }) // same date twice
    const parsed = parseBackup(JSON.stringify(file))
    if (!parsed.ok) throw new Error(parsed.error)
    await expect(applyBackup(parsed.backup)).rejects.toThrow()
    expect(await db.profile.count()).toBe(1) // existing data untouched
    expect(await db.waterLogs.count()).toBe(2)
  })

  it('never exports settings, which is where the optional API key lives', async () => {
    await setSetting('byokGeminiKey', 'AIzaFAKE-key-for-tests-1234567890')
    await seed()
    const text = JSON.stringify(await buildBackup())
    expect(text).not.toContain('AIzaFAKE')
    expect(Object.keys((await buildBackup()).tables)).not.toContain('settings')
  })
})
