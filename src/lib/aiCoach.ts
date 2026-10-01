import { db, getActivePlan } from '../db/schema'
import { daysAgoISO, parseISODateLocal } from './format'
import { computeStreak } from './streak'
import { SKIP_REASONS } from '../../shared/skipReasons'
import type { WeeklyReviewPayload } from '../../shared/weeklyReviewSchema'

export type { WeeklyReviewPayload }

const KNOWN_REASONS = new Set<string>(SKIP_REASONS)

/**
 * Builds exactly the payload the opt-in AI weekly coach sends off-device —
 * last 7 days of training data, summarized, nothing else. Kept as its own
 * function so it's easy to audit what leaves the device.
 */
export async function buildWeeklyReviewPayload(): Promise<WeeklyReviewPayload> {
  const plan = await getActivePlan()
  const weekAgo = daysAgoISO(7)

  const sessions = await db.workoutSessions.where('date').aboveOrEqual(weekAgo).toArray()
  const completed = sessions.filter((s) => s.completedAt)

  const exerciseMap = new Map<string, { sets: { reps?: number; rpe?: number }[]; low: number; high: number }>()
  for (const session of completed) {
    for (const ex of session.exercises) {
      const planned = plan?.sessions
        .flatMap((s) => s.exercises)
        .find((pe) => pe.exerciseId === ex.exerciseId)
      const entry = exerciseMap.get(ex.exerciseId) ?? {
        sets: [],
        low: planned?.targetRepsLow ?? 0,
        high: planned?.targetRepsHigh ?? 0,
      }
      entry.sets.push(...ex.sets)
      exerciseMap.set(ex.exerciseId, entry)
    }
  }

  const exercises: WeeklyReviewPayload['exercises'] = Array.from(exerciseMap.entries()).map(
    ([exerciseId, data]) => {
      const rpes = data.sets.map((s) => s.rpe).filter((r): r is number => typeof r === 'number')
      const avgReps =
        data.sets.reduce((sum, s) => sum + (s.reps ?? 0), 0) / Math.max(data.sets.length, 1)
      return {
        exerciseId,
        totalSets: data.sets.length,
        avgRpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
        metTargetRange: avgReps >= data.high,
      }
    },
  )

  const skipCounts = new Map<string, { reason: string; count: number }>()
  for (const s of sessions) {
    for (const skip of s.skips) {
      const existing = skipCounts.get(skip.exerciseId)
      skipCounts.set(skip.exerciseId, {
        reason: skip.reason,
        count: (existing?.count ?? 0) + 1,
      })
    }
  }
  const skips: WeeklyReviewPayload['skips'] = Array.from(skipCounts.entries()).map(
    ([exerciseId, info]) => ({
      exerciseId,
      reason: KNOWN_REASONS.has(info.reason) ? (info.reason as WeeklyReviewPayload['skips'][number]['reason']) : 'unspecified',
      count: info.count,
    }),
  )

  const recentPRs = await db.personalRecords
    .filter((r) => r.achievedAt >= parseISODateLocal(weekAgo).getTime())
    .toArray()
  const prs: WeeklyReviewPayload['prs'] = recentPRs.map((pr) => ({
    exerciseId: pr.exerciseId,
    value: pr.value,
  }))

  const bodyWeights = await db.progressSnapshots.where('date').aboveOrEqual(weekAgo).toArray()
  const sorted = bodyWeights.sort((a, b) => a.date.localeCompare(b.date))
  const bodyWeightTrendKg =
    sorted.length >= 2
      ? { start: sorted[0].bodyWeightKg, end: sorted[sorted.length - 1].bodyWeightKg }
      : null

  return {
    sessionsCompleted: completed.length,
    sessionsPlanned: plan?.sessions.length ?? completed.length,
    exercises,
    skips,
    prs,
    streak: computeStreak(plan, sessions),
    bodyWeightTrendKg,
  }
}

export async function requestAIWeeklyReview(payload: WeeklyReviewPayload): Promise<string> {
  const response = await fetch('/api/weekly-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`AI review request failed with status ${response.status}`)
  }
  const data = (await response.json()) as { review: string }
  return data.review
}
