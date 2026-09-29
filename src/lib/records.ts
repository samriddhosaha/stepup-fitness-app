import { db } from '../db/schema'
import type { LoggedExercise, PersonalRecord } from '../db/types'

function estimatedOneRepMax(weightKg: number, reps: number): number {
  // Epley formula — a simple, standard estimate, not a physiological claim.
  return weightKg * (1 + reps / 30)
}

/**
 * Compares each logged set against the exerciseId's best-known estimated
 * 1RM and records any new personal records. Returns the ones that were
 * actually new, so the caller can celebrate them.
 */
export async function checkAndRecordPRs(
  exercises: LoggedExercise[],
): Promise<PersonalRecord[]> {
  const newRecords: PersonalRecord[] = []

  for (const ex of exercises) {
    let bestSet: { weightKg: number; reps: number; e1rm: number } | undefined
    for (const set of ex.sets) {
      if (!set.weightKg || !set.reps) continue
      const e1rm = estimatedOneRepMax(set.weightKg, set.reps)
      if (!bestSet || e1rm > bestSet.e1rm) {
        bestSet = { weightKg: set.weightKg, reps: set.reps, e1rm }
      }
    }
    if (!bestSet) continue

    const existingBest = await db.personalRecords
      .where('exerciseId')
      .equals(ex.exerciseId)
      .toArray()
    const priorBestValue = existingBest.reduce((max, r) => Math.max(max, r.value), 0)

    if (bestSet.e1rm > priorBestValue) {
      const record: PersonalRecord = {
        exerciseId: ex.exerciseId,
        value: Math.round(bestSet.e1rm * 10) / 10,
        reps: bestSet.reps,
        achievedAt: Date.now(),
      }
      const id = await db.personalRecords.add(record)
      newRecords.push({ ...record, id })
    }
  }

  return newRecords
}
