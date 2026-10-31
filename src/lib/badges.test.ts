import { describe, expect, it } from 'vitest'
import { computeBadges, type AchievementStats } from './badges'

const none: AchievementStats = {
  completedWorkouts: 0,
  bestStreakWeeks: 0,
  recordCount: 0,
  lifetimeVolumeKg: 0,
  daysWithMeals: 0,
  checkIns: 0,
  hasBackedUp: false,
}
const byId = (stats: AchievementStats) => Object.fromEntries(computeBadges(stats).map((b) => [b.id, b]))

describe('computeBadges', () => {
  it('earns nothing with no activity, and every badge starts at zero progress', () => {
    const badges = computeBadges(none)
    expect(badges.every((b) => !b.earned && b.progress === 0)).toBe(true)
  })

  it('earns at the threshold, not before', () => {
    expect(byId({ ...none, completedWorkouts: 9 })['workouts-10']).toMatchObject({ earned: false, progress: 0.9 })
    expect(byId({ ...none, completedWorkouts: 10 })['workouts-10']).toMatchObject({ earned: true, progress: 1 })
  })

  it('caps progress at 1 however far past it goes', () => {
    expect(byId({ ...none, completedWorkouts: 500 })['workouts-100']?.progress).toBe(1)
  })

  it('measures volume in tonnes of kg and streaks in weeks', () => {
    const b = byId({ ...none, lifetimeVolumeKg: 12_500, bestStreakWeeks: 8 })
    expect(b['volume-10t']?.earned).toBe(true)
    expect(b['volume-50t']?.earned).toBe(false)
    expect(b['streak-8']?.earned).toBe(true)
    expect(b['streak-12']?.earned).toBe(false)
  })

  it('covers health and safety markers', () => {
    const b = byId({ ...none, daysWithMeals: 7, checkIns: 6, hasBackedUp: true })
    expect(b['meals-7']?.earned).toBe(true)
    expect(b['checkins-7']?.earned).toBe(false)
    expect(b['backup-1']?.earned).toBe(true)
  })

  it('has unique ids and never takes anything away (earned only depends on current numbers rising)', () => {
    const ids = computeBadges(none).map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    const before = computeBadges({ ...none, completedWorkouts: 25 }).filter((b) => b.earned).map((b) => b.id)
    const after = computeBadges({ ...none, completedWorkouts: 26 }).filter((b) => b.earned).map((b) => b.id)
    expect(after).toEqual(expect.arrayContaining(before))
  })
})
