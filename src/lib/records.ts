import { db } from '../db/schema'
import type { LoggedExercise, PersonalRecord, PRKind } from '../db/types'

/** Epley. Unreliable well past ~12 reps, so higher-rep sets don't produce an estimate (C-15). */
export function estimatedOneRepMax(weightKg: number, reps: number): number | undefined {
  if (reps < 1 || reps > 12) return undefined
  return weightKg * (1 + reps / 30)
}

interface Candidate {
  kind: PRKind
  value: number
  reps: number
}

/** The single best performance in a session for one exercise, and what kind of record it would be. */
export function bestCandidate(ex: LoggedExercise): Candidate | undefined {
  let e1rm: Candidate | undefined
  let heaviest: Candidate | undefined
  let mostReps: Candidate | undefined
  let longest: Candidate | undefined
  for (const set of ex.sets) {
    const reps = set.reps ?? 0
    if (reps <= 0) {
      // timed holds: the longest single set is the record (cardio sessions with a distance aren't ranked)
      if ((set.durationSeconds ?? 0) > 0 && !set.distanceM && (!longest || set.durationSeconds! > longest.value)) {
        longest = { kind: 'time', value: set.durationSeconds!, reps: 0 }
      }
      continue
    }
    if (set.weightKg && set.weightKg > 0) {
      const est = estimatedOneRepMax(set.weightKg, reps)
      if (est !== undefined && (!e1rm || est > e1rm.value)) e1rm = { kind: 'e1rm', value: est, reps }
      if (!heaviest || set.weightKg > heaviest.value) heaviest = { kind: 'weight', value: set.weightKg, reps }
    } else if (!mostReps || reps > mostReps.value) {
      mostReps = { kind: 'reps', value: reps, reps }
    }
  }
  const best = e1rm ?? heaviest ?? mostReps ?? longest
  return best && { ...best, value: Math.round(best.value * 10) / 10 }
}

/**
 * Records the session's best performance per exercise.
 * - The first log of an exercise (or of a new kind of metric) is stored silently as a baseline: no PR, no XP.
 * - Afterwards only a strict improvement over that kind's best counts as a PR.
 * Call inside a transaction that includes `personalRecords`. Returns the genuine (non-baseline) PRs.
 */
export async function recordSessionPRs(
  sessionId: number,
  exercises: LoggedExercise[],
  achievedAt = Date.now(),
): Promise<PersonalRecord[]> {
  const newRecords: PersonalRecord[] = []
  for (const ex of exercises) {
    const cand = bestCandidate(ex)
    if (!cand) continue

    const prior = await db.personalRecords.where('exerciseId').equals(ex.exerciseId).toArray()
    // Pre-v2 rows have no kind and were all estimated 1RMs.
    const sameKind = prior.filter((r) => (r.kind ?? 'e1rm') === cand.kind)
    const priorBest = sameKind.reduce((max, r) => Math.max(max, r.value), 0)

    const base = { exerciseId: ex.exerciseId, value: cand.value, reps: cand.reps, achievedAt, sessionId, kind: cand.kind }
    if (sameKind.length === 0) {
      await db.personalRecords.add({ ...base, baseline: true })
    } else if (cand.value > priorBest) {
      const record: PersonalRecord = { ...base }
      const id = await db.personalRecords.add(record)
      newRecords.push({ ...record, id })
    }
  }
  return newRecords
}

export const isRealPR = (r: PersonalRecord): boolean => !r.baseline
