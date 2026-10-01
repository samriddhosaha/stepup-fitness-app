import type { ExerciseState, WorkoutSession } from '../db/types'
import { nextExerciseState } from './overload'
import { getExerciseById } from '../db/exerciseLibrary'

/**
 * Rebuilds per-exercise progression state from completed sessions (oldest → newest).
 * Used by the v2 migration and when importing a v1 backup that predates exerciseState.
 * Plans aren't consulted, so no failure streaks are inferred.
 */
export function rebuildExerciseStates(sessions: WorkoutSession[]): ExerciseState[] {
  const states = new Map<string, ExerciseState>()
  const done = sessions
    .filter((s) => s.completedAt)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
  for (const s of done) {
    for (const ex of s.exercises) {
      const tracking = getExerciseById(ex.exerciseId)?.trackingType
      const next = nextExerciseState(states.get(ex.exerciseId), ex.exerciseId, undefined, ex.sets, s.date, s.completedAt, tracking)
      if (next) states.set(ex.exerciseId, next)
    }
  }
  return [...states.values()]
}
