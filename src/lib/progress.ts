import { db } from '../db/schema'
import { weekStartOfISO } from './format'
import { getExerciseById } from '../db/exerciseLibrary'
import { estimatedOneRepMax } from './records'
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

export async function liftProgressionSeries(exerciseId: string): Promise<SeriesPoint[]> {
  const sessions = await db.workoutSessions.where('completedAt').above(0).toArray()
  const points: SeriesPoint[] = []
  for (const s of sessions as WorkoutSession[]) {
    const entry = s.exercises.find((e) => e.exerciseId === exerciseId)
    if (!entry) continue
    const best = entry.sets.reduce((max, set) => {
      if (!set.weightKg || !set.reps) return max
      return Math.max(max, estimatedOneRepMax(set.weightKg, set.reps) ?? 0)
    }, 0)
    if (best > 0) points.push({ date: s.date, value: Math.round(best * 10) / 10 })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

/** Exercises that have at least one logged, completed set, most recently trained first. */
export async function liftsWithData(): Promise<string[]> {
  const sessions = await db.workoutSessions.where('completedAt').above(0).toArray()
  const latest = new Map<string, string>()
  for (const s of sessions) {
    for (const ex of s.exercises) {
      if (!ex.sets.some((set) => (set.weightKg ?? 0) > 0 && (set.reps ?? 0) > 0)) continue
      if ((latest.get(ex.exerciseId) ?? '') < s.date) latest.set(ex.exerciseId, s.date)
    }
  }
  return [...latest.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([id]) => id)
}

/** Completed sets per primary muscle for the Monday-start week containing `todayISO`. */
export async function weeklyMuscleSets(todayISO: string): Promise<{ muscle: string; sets: number }[]> {
  const start = weekStartOfISO(todayISO)
  const sessions = await db.workoutSessions.where('date').aboveOrEqual(start).toArray()
  const counts = new Map<string, number>()
  for (const s of sessions) {
    if (!s.completedAt) continue
    for (const ex of s.exercises) {
      const muscles = getExerciseById(ex.exerciseId)?.primaryMuscles ?? []
      for (const m of muscles) counts.set(m, (counts.get(m) ?? 0) + ex.sets.length)
    }
  }
  return [...counts.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets)
}
