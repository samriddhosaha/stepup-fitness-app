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

/**
 * The longest run of active weeks there has ever been, using the same rule as the current one: a
 * single empty week is forgiven, two in a row end the run. Counts the active weeks in the run.
 */
export function bestWeeksInARow(sessions: WorkoutSession[]): number {
  const weeks = [...new Set(sessions.filter((s) => s.completedAt).map((s) => weekStartOfISO(s.date)))].sort()
  let best = 0
  let run = 0
  let previous: string | undefined
  for (const week of weeks) {
    const gapWeeks = previous === undefined ? 0 : Math.round((parseISODateLocal(week).getTime() - parseISODateLocal(previous).getTime()) / (7 * 86_400_000))
    run = previous !== undefined && gapWeeks <= 2 ? run + 1 : 1 // gap 1 = consecutive, 2 = one empty week
    best = Math.max(best, run)
    previous = week
  }
  return best
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
