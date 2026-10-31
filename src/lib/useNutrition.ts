import { useLiveQuery } from 'dexie-react-hooks'
import { db, getActiveProfile } from '../db/schema'
import { currentBodyWeightKg } from './healthStore'
import { dailyTotals, targetsForProfile } from './nutrition'
import { useTodayISO } from './useToday'

/** Today's meals, totals, and the calorie/protein targets that apply. */
export function useNutritionToday() {
  const today = useTodayISO()
  const data = useLiveQuery(async () => {
    const [logs, profile, weightKg] = await Promise.all([
      db.mealLogs.where('date').equals(today).toArray(),
      getActiveProfile(),
      currentBodyWeightKg(),
    ])
    const sorted = logs.sort((a, b) => a.loggedAt - b.loggedAt)
    return {
      logs: sorted,
      totals: dailyTotals(sorted, today),
      profile,
      weightKg,
      ...(profile
        ? targetsForProfile(profile, weightKg)
        : { calculated: { ok: false as const, missing: ['profile'] }, effective: { source: null } }),
    }
  }, [today])
  return { today, data }
}
