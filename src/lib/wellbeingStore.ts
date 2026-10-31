import { db, getActiveProfile } from '../db/schema'
import { daysAgoISO, todayISODate } from './format'
import { currentBodyWeightKg } from './healthStore'
import { targetsForProfile } from './nutrition'
import { summarizeWellbeing, type WellbeingSummary } from './wellbeing'

/** Reads the last 7 days of nutrition, check-ins and water and boils them down to averages. */
export async function loadWellbeingSummary(): Promise<WellbeingSummary> {
  const weekAgo = daysAgoISO(7)
  const [profile, mealLogs, checkIns, waterLogs, weightKg] = await Promise.all([
    getActiveProfile(),
    db.mealLogs.where('date').aboveOrEqual(weekAgo).toArray(),
    db.checkIns.where('date').aboveOrEqual(weekAgo).toArray(),
    db.waterLogs.where('date').aboveOrEqual(weekAgo).toArray(),
    currentBodyWeightKg(),
  ])
  return summarizeWellbeing({
    mealLogs,
    checkIns,
    waterLogs,
    today: todayISODate(),
    proteinTargetG: profile ? targetsForProfile(profile, weightKg).effective.proteinG : undefined,
  })
}
