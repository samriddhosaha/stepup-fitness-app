import { db, getSetting } from '../db/schema'
import { bestWeeksInARow } from './consistency'
import { isRealPR } from './records'
import type { AchievementStats } from './badges'

/** Reads the handful of numbers the milestones are measured against. */
export async function loadAchievementStats(): Promise<AchievementStats> {
  const [sessions, records, meals, checkIns, lastBackupAt] = await Promise.all([
    db.workoutSessions.toArray(),
    db.personalRecords.toArray(),
    db.mealLogs.toArray(),
    db.checkIns.count(),
    getSetting<number>('lastBackupAt'),
  ])
  const completed = sessions.filter((s) => s.completedAt)
  return {
    completedWorkouts: completed.length,
    bestStreakWeeks: bestWeeksInARow(completed),
    recordCount: records.filter(isRealPR).length,
    lifetimeVolumeKg: completed.reduce(
      (total, s) => total + s.exercises.reduce((sum, e) => sum + e.sets.reduce((a, set) => a + (set.weightKg ?? 0) * (set.reps ?? 0), 0), 0),
      0,
    ),
    daysWithMeals: new Set(meals.map((m) => m.date)).size,
    checkIns,
    hasBackedUp: lastBackupAt !== undefined,
  }
}
