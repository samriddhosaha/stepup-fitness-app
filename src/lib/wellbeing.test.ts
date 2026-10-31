import { describe, expect, it } from 'vitest'
import { isEmptyWellbeing, summarizeWellbeing } from './wellbeing'
import type { CheckIn, MealLog, WaterLog } from '../db/types'
import { TIME_ZONES, withTZ } from '../test/tz'

const today = '2026-10-31'
const meal = (date: string, proteinG: number, calories: number): MealLog => ({
  date,
  name: 'x',
  servings: 1,
  loggedAt: 1,
  calories,
  proteinG,
  carbsG: 0,
  fatG: 0,
})
const checkIn = (date: string, sleepHours: number, soreness: 1 | 2 | 3, energy: 1 | 2 | 3): CheckIn => ({
  date,
  sleepHours,
  soreness,
  energy,
  createdAt: 1,
})
const water = (date: string, ml: number): WaterLog => ({ date, ml, loggedAt: 1 })

describe('summarizeWellbeing', () => {
  it('is empty with no data', () => {
    const w = summarizeWellbeing({ mealLogs: [], checkIns: [], waterLogs: [], today })
    expect(w).toEqual({ nutrition: null, recovery: null, hydration: null })
    expect(isEmptyWellbeing(w)).toBe(true)
  })

  it('averages only the days that have something logged', () => {
    const w = summarizeWellbeing({
      mealLogs: [meal(today, 100, 2000), meal(today, 20, 300), meal('2026-10-29', 80, 1800)],
      checkIns: [checkIn(today, 8, 1, 3), checkIn('2026-10-30', 6, 3, 1)],
      waterLogs: [water(today, 1000), water(today, 500), water('2026-10-28', 2000)],
      today,
      proteinTargetG: 140,
    })
    // day 1: 120 g / 2300 kcal, day 2: 80 g / 1800 kcal  -> a missing day is not counted as zero
    expect(w.nutrition).toEqual({ daysLogged: 2, avgProteinG: 100, avgCalories: 2050, proteinTargetG: 140 })
    expect(w.recovery).toEqual({ checkIns: 2, avgSleepHours: 7, avgSoreness: 2, avgEnergy: 2 })
    expect(w.hydration).toEqual({ daysLogged: 2, avgMl: 1750 })
    expect(isEmptyWellbeing(w)).toBe(false)
  })

  it('ignores anything older than seven days, and has a null target without one', () => {
    const w = summarizeWellbeing({
      mealLogs: [meal('2026-10-24', 500, 9000), meal(today, 50, 800)],
      checkIns: [checkIn('2026-10-24', 3, 3, 1)],
      waterLogs: [water('2026-10-24', 9000)],
      today,
    })
    expect(w.nutrition).toMatchObject({ daysLogged: 1, avgProteinG: 50, proteinTargetG: null })
    expect(w.recovery).toBeNull()
    expect(w.hydration).toBeNull()
  })

  it.each(TIME_ZONES)('the seven-day window is the same in %s', (tz) =>
    withTZ(tz, () => {
      const w = summarizeWellbeing({
        mealLogs: [meal('2026-10-25', 10, 100), meal('2026-10-24', 99, 999)],
        checkIns: [],
        waterLogs: [],
        today,
      })
      expect(w.nutrition?.daysLogged).toBe(1) // 25th is day 7 back (inclusive); 24th is out
    }),
  )
})
