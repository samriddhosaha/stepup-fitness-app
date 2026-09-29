import { toISODate } from './format'
import type { Plan, WorkoutSession } from '../db/types'

export function computeStreak(plan: Plan | undefined, sessions: WorkoutSession[]): number {
  if (!plan) return 0
  const completedDates = new Set(
    sessions.filter((s) => s.completedAt).map((s) => s.date),
  )
  const today = new Date()
  let streak = 0

  for (let i = 0; i < 365; i += 1) {
    const cursor = new Date(today)
    cursor.setDate(cursor.getDate() - i)
    const dateISO = toISODate(cursor)
    const dayIndex = (cursor.getDay() + 6) % 7
    const scheduled = plan.sessions.some((s) => s.dayIndex === dayIndex)
    if (!scheduled) continue // rest days are neutral, don't break or count

    if (completedDates.has(dateISO)) {
      streak += 1
      continue
    }

    if (i === 0) continue // today's session may still happen — don't break yet
    break
  }

  return streak
}

export function isTodayScheduledAndIncomplete(
  plan: Plan | undefined,
  sessions: WorkoutSession[],
): boolean {
  if (!plan) return false
  const today = new Date()
  const dayIndex = (today.getDay() + 6) % 7
  const scheduled = plan.sessions.some((s) => s.dayIndex === dayIndex)
  if (!scheduled) return false
  const todayISO = toISODate(today)
  return !sessions.some((s) => s.date === todayISO && s.completedAt)
}
