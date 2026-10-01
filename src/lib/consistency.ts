import { parseISODateLocal, toISODate, weekStartOfISO } from './format'
import type { Plan, WorkoutSession } from '../db/types'

/**
 * Weekly consistency instead of a punitive streak: a week counts when it holds at least one
 * completed workout. Rest days never matter, and a single empty week is forgiven — only two
 * empty weeks in a row end the run. The current week never breaks it (it may still happen).
 */
export function activeWeeksInARow(sessions: WorkoutSession[], todayISO: string): number {
  const activeWeeks = new Set(
    sessions.filter((s) => s.completedAt).map((s) => weekStartOfISO(s.date)),
  )
  if (activeWeeks.size === 0) return 0

  let cursor = parseISODateLocal(weekStartOfISO(todayISO))
  let count = 0
  let missedInARow = 0
  for (let i = 0; i < 260; i += 1) {
    const key = toISODate(cursor)
    if (activeWeeks.has(key)) {
      count += 1
      missedInARow = 0
    } else if (i > 0) {
      missedInARow += 1
      if (missedInARow >= 2) break
    }
    cursor.setDate(cursor.getDate() - 7)
  }
  return count
}

export function completedThisWeek(sessions: WorkoutSession[], todayISO: string): number {
  const start = weekStartOfISO(todayISO)
  return sessions.filter((s) => s.completedAt && s.date >= start).length
}

export function isTodayScheduledAndIncomplete(
  plan: Plan | undefined,
  sessions: WorkoutSession[],
  todayISO: string,
  weekdayIndex: number,
): boolean {
  if (!plan?.sessions.some((s) => s.dayIndex === weekdayIndex)) return false
  return !sessions.some((s) => s.date === todayISO && s.completedAt)
}
