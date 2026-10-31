import { useLiveQuery } from 'dexie-react-hooks'
import { db, getActiveProfile } from '../db/schema'
import { currentBodyWeightKg } from './healthStore'
import { lastWaterLog, waterFraction, waterGoalFor, waterTotalFor } from './health'
import { useTodayISO } from './useToday'

/** Today's water: entries, total, goal (user's, else from bodyweight) and ring fraction. */
export function useWater() {
  const today = useTodayISO()
  const data = useLiveQuery(async () => {
    const [logs, profile, weightKg] = await Promise.all([
      db.waterLogs.where('date').equals(today).toArray(),
      getActiveProfile(),
      currentBodyWeightKg(),
    ])
    const goalMl = waterGoalFor(profile?.waterGoalMl, weightKg)
    const totalMl = waterTotalFor(logs, today)
    return {
      logs,
      totalMl,
      goalMl,
      isCustomGoal: profile?.waterGoalMl !== undefined,
      fraction: waterFraction(totalMl, goalMl),
      last: lastWaterLog(logs, today),
    }
  }, [today])
  return { today, data }
}

/** 1250 -> "1.25 L"; 400 -> "400 ml". */
export function formatMl(ml: number): string {
  return ml >= 1000 ? `${Number((ml / 1000).toFixed(2))} L` : `${ml} ml`
}
