import { db } from '../db/schema'
import { weekStartOfISO } from './format'
import type { WorkoutSession } from '../db/types'

export interface SeriesPoint {
  date: string
  value: number
}

export async function bodyWeightSeries(): Promise<SeriesPoint[]> {
  const rows = await db.progressSnapshots.orderBy('date').toArray()
  return rows.map((r) => ({ date: r.date, value: r.bodyWeightKg }))
}

export async function weeklyVolumeSeries(): Promise<SeriesPoint[]> {
  const sessions = await db.workoutSessions.where('completedAt').above(0).toArray()
  const byWeek = new Map<string, number>()
  for (const s of sessions) {
    const week = weekStartOfISO(s.date)
    const tonnage = s.exercises.reduce(
      (sum, ex) =>
        sum +
        ex.sets.reduce((setSum, set) => setSum + (set.weightKg ?? 0) * (set.reps ?? 0), 0),
      0,
    )
    byWeek.set(week, (byWeek.get(week) ?? 0) + tonnage)
  }
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value: Math.round(value) }))
}

function estimatedOneRepMax(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30)
}

export async function liftProgressionSeries(exerciseId: string): Promise<SeriesPoint[]> {
  const sessions = await db.workoutSessions.where('completedAt').above(0).toArray()
  const points: SeriesPoint[] = []
  for (const s of sessions as WorkoutSession[]) {
    const entry = s.exercises.find((e) => e.exerciseId === exerciseId)
    if (!entry) continue
    const best = entry.sets.reduce((max, set) => {
      if (!set.weightKg || !set.reps) return max
      return Math.max(max, estimatedOneRepMax(set.weightKg, set.reps))
    }, 0)
    if (best > 0) points.push({ date: s.date, value: Math.round(best * 10) / 10 })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}
