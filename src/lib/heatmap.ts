import { addDaysISO, daysBetween, weekStartOfISO } from './format'
import type { WorkoutSession } from '../db/types'

export interface HeatmapDay {
  date: string
  /** Completed workouts that day. */
  count: number
  /** After today: shown blank, not as a missed day. */
  future: boolean
}

export interface TrainingHeatmap {
  /** Oldest week first; each week is Monday to Sunday. */
  weeks: HeatmapDay[][]
  totalSessions: number
  activeWeeks: number
}

/**
 * The last `weekCount` calendar weeks (Monday-first, ending with the current one) as a grid of
 * completed-workout counts. Rest days are simply empty; nothing here marks a day as "missed".
 */
export function trainingHeatmap(sessions: WorkoutSession[], todayISO: string, weekCount = 12): TrainingHeatmap {
  const counts = new Map<string, number>()
  for (const s of sessions) if (s.completedAt) counts.set(s.date, (counts.get(s.date) ?? 0) + 1)

  const firstMonday = addDaysISO(weekStartOfISO(todayISO), -(weekCount - 1) * 7)
  const weeks: HeatmapDay[][] = []
  let totalSessions = 0
  let activeWeeks = 0
  for (let w = 0; w < weekCount; w += 1) {
    const week = Array.from({ length: 7 }, (_, d) => {
      const date = addDaysISO(firstMonday, w * 7 + d)
      return { date, count: counts.get(date) ?? 0, future: daysBetween(todayISO, date) > 0 }
    })
    const inWeek = week.reduce((n, day) => n + day.count, 0)
    totalSessions += inWeek
    if (inWeek > 0) activeWeeks += 1
    weeks.push(week)
  }
  return { weeks, totalSessions, activeWeeks }
}
