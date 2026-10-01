import { useEffect } from 'react'
import { db, getActivePlan } from '../db/schema'
import { isTodayScheduledAndIncomplete } from './consistency'
import { runReminderChecks } from './notifications'
import { daysAgoISO, todayISODate, weekdayIndexOfISO } from './format'

const CHECK_INTERVAL_MS = 5 * 60 * 1000

export async function checkOnce() {
  try {
    await runChecks()
  } catch (err) {
    console.warn('[reminders] check failed', err)
  }
}

export async function runChecks() {
  const [plan, sessions] = await Promise.all([getActivePlan(), db.workoutSessions.toArray()])
  if (!plan) return

  const yesterday = daysAgoISO(1)
  const yesterdayDayIndex = weekdayIndexOfISO(yesterday)
  const yesterdayScheduled = plan.sessions.some((s) => s.dayIndex === yesterdayDayIndex)
  const yesterdayScheduledAndMissed =
    yesterdayScheduled && !sessions.some((s) => s.date === yesterday && s.completedAt)

  await runReminderChecks({
    todayScheduledAndIncomplete: isTodayScheduledAndIncomplete(
      plan,
      sessions,
      todayISODate(),
      weekdayIndexOfISO(todayISODate()),
    ),
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
