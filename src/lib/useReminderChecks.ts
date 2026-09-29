import { useEffect } from 'react'
import { db, getActivePlan } from '../db/schema'
import { computeStreak, isTodayScheduledAndIncomplete } from './streak'
import { runReminderChecks } from './notifications'
import { daysAgoISO, toISODate } from './format'

const CHECK_INTERVAL_MS = 5 * 60 * 1000

async function checkOnce() {
  const [plan, sessions] = await Promise.all([getActivePlan(), db.workoutSessions.toArray()])
  if (!plan) return

  const yesterday = daysAgoISO(1)
  const yesterdayDayIndex = (new Date(yesterday).getDay() + 6) % 7
  const yesterdayScheduled = plan.sessions.some((s) => s.dayIndex === yesterdayDayIndex)
  const yesterdayScheduledAndMissed =
    yesterdayScheduled && !sessions.some((s) => s.date === toISODate(new Date(yesterday)) && s.completedAt)

  await runReminderChecks({
    todayScheduledAndIncomplete: isTodayScheduledAndIncomplete(plan, sessions),
    streak: computeStreak(plan, sessions),
    yesterdayScheduledAndMissed,
  })
}

/** Runs local, on-device reminder checks periodically while the app is open. */
export function useReminderChecks() {
  useEffect(() => {
    checkOnce()
    const interval = setInterval(checkOnce, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])
}
