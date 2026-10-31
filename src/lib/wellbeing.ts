import type { CheckIn, MealLog, WaterLog } from '../db/types'
import { lastNDays } from './format'
import { weeklyNutrition } from './nutrition'

export interface WellbeingSummary {
  nutrition: { daysLogged: number; avgProteinG: number; avgCalories: number; proteinTargetG: number | null } | null
  recovery: { checkIns: number; avgSleepHours: number; avgSoreness: number; avgEnergy: number } | null
  hydration: { daysLogged: number; avgMl: number } | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Seven days of nutrition, check-ins and water boiled down to averages. A day with nothing logged
 * is left out of its average (not counted as zero), and a part with no data at all is null.
 * Pure, so it can be tested without a database — and so it is obvious what it can reveal.
 */
export function summarizeWellbeing(input: {
  mealLogs: MealLog[]
  checkIns: CheckIn[]
  waterLogs: WaterLog[]
  today: string
  proteinTargetG?: number
}): WellbeingSummary {
  const week = new Set(lastNDays(input.today, 7))

  const food = weeklyNutrition(input.mealLogs, input.today)
  const nutrition =
    food.daysLogged === 0
      ? null
      : {
          daysLogged: food.daysLogged,
          avgProteinG: food.avgProteinG,
          avgCalories: food.avgCalories,
          proteinTargetG: input.proteinTargetG ?? null,
        }

  const checkIns = input.checkIns.filter((c) => week.has(c.date))
  const mean = (pick: (c: CheckIn) => number) => checkIns.reduce((s, c) => s + pick(c), 0) / checkIns.length
  const recovery =
    checkIns.length === 0
      ? null
      : {
          checkIns: checkIns.length,
          avgSleepHours: round1(mean((c) => c.sleepHours)),
          avgSoreness: round1(mean((c) => c.soreness)),
          avgEnergy: round1(mean((c) => c.energy)),
        }

  const waterByDay = new Map<string, number>()
  for (const w of input.waterLogs) if (week.has(w.date)) waterByDay.set(w.date, (waterByDay.get(w.date) ?? 0) + w.ml)
  const hydration =
    waterByDay.size === 0
      ? null
      : {
          daysLogged: waterByDay.size,
          avgMl: Math.round([...waterByDay.values()].reduce((s, n) => s + n, 0) / waterByDay.size),
        }

  return { nutrition, recovery, hydration }
}

/** True when there is nothing worth sending or saying. */
export function isEmptyWellbeing(w: WellbeingSummary): boolean {
  return w.nutrition === null && w.recovery === null && w.hydration === null
}
