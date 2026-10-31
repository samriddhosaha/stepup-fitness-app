import { beforeEach, describe, expect, it } from 'vitest'
import { db, setSetting } from '../db/schema'
import { loadAchievementStats } from './badgesStore'
import { computeBadges } from './badges'

const session = (date: string, sets: { weightKg?: number; reps?: number }[], completed = true) => ({
  date,
  planSessionName: 'A',
  exercises: [{ exerciseId: 'goblet-squat', sets: sets.map((s, i) => ({ setIndex: i, ...s })) }],
  skips: [],
  startedAt: 1,
  completedAt: completed ? 2 : undefined,
})

beforeEach(async () => {
  await Promise.all([db.workoutSessions.clear(), db.personalRecords.clear(), db.mealLogs.clear(), db.checkIns.clear(), db.settings.clear()])
})

describe('loadAchievementStats', () => {
  it('is all zeros on a fresh install', async () => {
    expect(await loadAchievementStats()).toEqual({
      completedWorkouts: 0,
      bestStreakWeeks: 0,
      recordCount: 0,
      lifetimeVolumeKg: 0,
      daysWithMeals: 0,
      checkIns: 0,
      hasBackedUp: false,
    })
  })

  it('counts only finished workouts and sums weight × reps', async () => {
    await db.workoutSessions.bulkAdd([
      session('2026-09-28', [{ weightKg: 20, reps: 10 }, { weightKg: 25, reps: 8 }]), // 200 + 200
      session('2026-09-29', [{ reps: 15 }]), // bodyweight: no volume
      session('2026-09-30', [{ weightKg: 100, reps: 5 }], false), // unfinished: ignored
    ])
    const s = await loadAchievementStats()
    expect(s.completedWorkouts).toBe(2)
    expect(s.lifetimeVolumeKg).toBe(400)
    expect(s.bestStreakWeeks).toBe(1)
  })

  it('does not count silent baselines as personal bests', async () => {
    await db.personalRecords.bulkAdd([
      { exerciseId: 'goblet-squat', value: 20, reps: 10, achievedAt: 1, baseline: true },
      { exerciseId: 'goblet-squat', value: 24, reps: 8, achievedAt: 2 },
    ])
    expect((await loadAchievementStats()).recordCount).toBe(1)
  })

  it('counts distinct days with meals, check-ins, and whether a backup was ever made', async () => {
    const meal = (date: string) => ({ date, name: 'x', servings: 1, loggedAt: 1, calories: 1, proteinG: 1, carbsG: 1, fatG: 1 })
    await db.mealLogs.bulkAdd([meal('2026-10-01'), meal('2026-10-01'), meal('2026-10-02')])
    await db.checkIns.add({ date: '2026-10-01', sleepHours: 7, soreness: 1, energy: 3, createdAt: 1 })
    await setSetting('lastBackupAt', Date.now())
    const s = await loadAchievementStats()
    expect(s).toMatchObject({ daysWithMeals: 2, checkIns: 1, hasBackedUp: true })
    expect(computeBadges(s).find((b) => b.id === 'backup-1')?.earned).toBe(true)
  })
})
