import { describe, expect, it } from 'vitest'
import {
  cmToDisplay,
  defaultWaterGoalMl,
  displayToCm,
  habitStreak,
  lastWaterLog,
  measurementRangeForUnit,
  measurementSummaries,
  readinessFor,
  recentHabitDays,
  shouldRemindWater,
  waterFraction,
  waterByDay,
  waterGoalFor,
  waterTotalFor,
} from './health'
import type { BodyMeasurement, WaterLog } from '../db/types'

describe('water goal', () => {
  it('is about 35 ml per kg, rounded to 50 ml', () => {
    expect(defaultWaterGoalMl(70)).toBe(2450)
    expect(defaultWaterGoalMl(80)).toBe(2800)
    expect(defaultWaterGoalMl(62)).toBe(2150)
  })
  it('stays within a sensible range', () => {
    expect(defaultWaterGoalMl(40)).toBe(1500)
    expect(defaultWaterGoalMl(200)).toBe(4500)
  })
  it('falls back to 2 litres without a usable bodyweight', () => {
    expect(defaultWaterGoalMl(undefined)).toBe(2000)
    expect(defaultWaterGoalMl(0)).toBe(2000)
    expect(defaultWaterGoalMl(Number.NaN)).toBe(2000)
  })
  it('prefers the goal the user set', () => {
    expect(waterGoalFor(3000, 70)).toBe(3000)
    expect(waterGoalFor(undefined, 70)).toBe(2450)
  })
})

describe('water totals', () => {
  const logs: WaterLog[] = [
    { id: 1, date: '2026-10-30', ml: 500, loggedAt: 1 },
    { id: 2, date: '2026-10-31', ml: 250, loggedAt: 2 },
    { id: 3, date: '2026-10-31', ml: 150, loggedAt: 3 },
    { id: 4, date: '2026-10-31', ml: 500, loggedAt: 4 },
  ]
  it('sums a single day', () => {
    expect(waterTotalFor(logs, '2026-10-31')).toBe(900)
    expect(waterTotalFor(logs, '2026-10-29')).toBe(0)
  })
  it('finds the most recent entry for “undo last”', () => {
    expect(lastWaterLog(logs, '2026-10-31')?.id).toBe(4)
    expect(lastWaterLog(logs, '2026-10-29')).toBeUndefined()
  })
  it('breaks ties on timestamp by id', () => {
    const tied: WaterLog[] = [
      { id: 7, date: 'd', ml: 100, loggedAt: 5 },
      { id: 8, date: 'd', ml: 200, loggedAt: 5 },
    ]
    expect(lastWaterLog(tied, 'd')?.id).toBe(8)
  })
  it('gives a ring fraction that stops at full', () => {
    expect(waterFraction(0, 2000)).toBe(0)
    expect(waterFraction(500, 2000)).toBe(0.25)
    expect(waterFraction(2500, 2000)).toBe(1)
    expect(waterFraction(100, 0)).toBe(0)
  })
})

describe('waterByDay', () => {
  it('returns oldest-first daily totals with zeros for empty days', () => {
    const logs: WaterLog[] = [
      { id: 1, date: '2026-10-29', ml: 250, loggedAt: 1 },
      { id: 2, date: '2026-10-29', ml: 500, loggedAt: 2 },
      { id: 3, date: '2026-10-31', ml: 300, loggedAt: 3 },
      { id: 4, date: '2026-10-01', ml: 999, loggedAt: 4 }, // outside the window
    ]
    expect(waterByDay(logs, '2026-10-31', 4)).toEqual([
      { date: '2026-10-28', value: 0 },
      { date: '2026-10-29', value: 750 },
      { date: '2026-10-30', value: 0 },
      { date: '2026-10-31', value: 300 },
    ])
  })
})

describe('water reminders', () => {
  const base = { now: 100 * 3_600_000, hour: 14, intervalHours: 2, intakeMl: 500, goalMl: 2400 }
  it('is off without an interval', () => {
    expect(shouldRemindWater({ ...base, intervalHours: undefined })).toBe(false)
    expect(shouldRemindWater({ ...base, intervalHours: 0 })).toBe(false)
  })
  it('only nudges during the day', () => {
    expect(shouldRemindWater({ ...base, hour: 8 })).toBe(false)
    expect(shouldRemindWater({ ...base, hour: 21 })).toBe(false)
    expect(shouldRemindWater({ ...base, hour: 9 })).toBe(true)
    expect(shouldRemindWater({ ...base, hour: 20 })).toBe(true)
  })
  it('stops once the goal is met', () => {
    expect(shouldRemindWater({ ...base, intakeMl: 2400 })).toBe(false)
  })
  it('is quietened by recently logging a drink or recently being nudged', () => {
    expect(shouldRemindWater({ ...base, lastLogAt: base.now - 3_600_000 })).toBe(false)
    expect(shouldRemindWater({ ...base, lastLogAt: base.now - 2 * 3_600_000 })).toBe(true)
    expect(shouldRemindWater({ ...base, lastRemindedAt: base.now - 3_600_000 })).toBe(false)
    expect(shouldRemindWater({ ...base, lastRemindedAt: base.now - 2 * 3_600_000 })).toBe(true)
  })
})

describe('readiness', () => {
  it('says push when rested, fresh and energised', () => {
    expect(readinessFor({ sleepHours: 8, soreness: 1, energy: 3 })).toMatchObject({ level: 'push', score: 6 })
  })
  it('says normal for a mixed picture', () => {
    expect(readinessFor({ sleepHours: 7, soreness: 2, energy: 2 }).level).toBe('normal')
    expect(readinessFor({ sleepHours: 5, soreness: 2, energy: 3 }).level).toBe('normal')
  })
  it('says take it easy when run down, and names why', () => {
    const r = readinessFor({ sleepHours: 5, soreness: 3, energy: 1 })
    expect(r.level).toBe('easy')
    expect(r.score).toBe(0)
    expect(r.detail).toContain('short on sleep, very sore and low on energy')
  })
  it('names only the factors that are actually poor', () => {
    const r = readinessFor({ sleepHours: 5, soreness: 3, energy: 2 })
    expect(r.level).toBe('easy')
    expect(r.detail).toContain('short on sleep and very sore')
    expect(r.detail).not.toContain('energy')
  })
  it('scores are bounded 0-6 for every combination', () => {
    for (const sleepHours of [5, 6, 7, 8, 9]) {
      for (const soreness of [1, 2, 3] as const) {
        for (const energy of [1, 2, 3] as const) {
          const { score } = readinessFor({ sleepHours, soreness, energy })
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(6)
        }
      }
    }
  })
})

describe('habit streaks', () => {
  const today = '2026-10-31'
  it('counts consecutive days ending today', () => {
    expect(habitStreak(['2026-10-31', '2026-10-30', '2026-10-29'], today)).toBe(3)
  })
  it('does not break just because today is not done yet', () => {
    expect(habitStreak(['2026-10-30', '2026-10-29'], today)).toBe(2)
  })
  it('breaks after a fully missed day', () => {
    expect(habitStreak(['2026-10-31', '2026-10-29', '2026-10-28'], today)).toBe(1)
    expect(habitStreak(['2026-10-29', '2026-10-28'], today)).toBe(0)
  })
  it('is zero with no history and one for just today', () => {
    expect(habitStreak([], today)).toBe(0)
    expect(habitStreak(['2026-10-31'], today)).toBe(1)
  })
  it('crosses month and year boundaries', () => {
    expect(habitStreak(['2026-01-01', '2025-12-31', '2025-12-30'], '2026-01-01')).toBe(3)
  })
  it('builds a 7-day strip, oldest first', () => {
    const days = recentHabitDays(['2026-10-31', '2026-10-29'], today)
    expect(days).toHaveLength(7)
    expect(days[0]?.date).toBe('2026-10-25')
    expect(days.at(-1)).toEqual({ date: '2026-10-31', done: true })
    expect(days.filter((d) => d.done).map((d) => d.date)).toEqual(['2026-10-29', '2026-10-31'])
  })
})

describe('measurements', () => {
  it('shows inches for lb users and cm for kg users', () => {
    expect(cmToDisplay(100, 'kg')).toBe(100)
    expect(cmToDisplay(100, 'lb')).toBe(39.4)
    expect(displayToCm(39.4, 'lb')).toBe(100.1)
    expect(displayToCm(85.5, 'kg')).toBe(85.5)
  })
  it('keeps validation ranges in the display unit', () => {
    expect(measurementRangeForUnit('kg')).toEqual({ min: 10, max: 300 })
    expect(measurementRangeForUnit('lb')).toEqual({ min: 4, max: 118 })
  })
  it('summarises the newest reading of each type with its change', () => {
    const entries: BodyMeasurement[] = [
      { id: 1, date: '2026-10-01', type: 'waist', valueCm: 90 },
      { id: 2, date: '2026-10-15', type: 'waist', valueCm: 89.2 },
      { id: 3, date: '2026-10-10', type: 'chest', valueCm: 100 },
    ]
    const summary = measurementSummaries(entries)
    expect(summary.map((s) => s.type)).toEqual(['waist', 'chest'])
    expect(summary[0]).toMatchObject({ changeCm: -0.8 })
    expect(summary[0]?.latest.valueCm).toBe(89.2)
    expect(summary[1]?.changeCm).toBeUndefined()
  })
})
