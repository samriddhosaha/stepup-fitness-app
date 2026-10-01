import { useLiveQuery } from 'dexie-react-hooks'
import { db, getActivePlan, getActiveProfile } from './schema'
import type { Plan, Profile, WorkoutSession } from './types'

// The one place screens read their core data from. Each hook returns `undefined` while loading
// and the row (or `null` when there is none) afterwards, so "loading" and "empty" stay distinct.

/** The current profile; `null` before onboarding. */
export function useProfile(): Profile | null | undefined {
  return useLiveQuery(async () => (await getActiveProfile()) ?? null, [])
}

/** The current plan; `null` when there isn't one. */
export function usePlan(): Plan | null | undefined {
  return useLiveQuery(async () => (await getActivePlan()) ?? null, [])
}

/** Sessions, optionally limited to dates in `[from, to]` (YYYY-MM-DD, inclusive) using the date index. */
export function useSessions(range?: { from?: string; to?: string }): WorkoutSession[] | undefined {
  const from = range?.from
  const to = range?.to
  return useLiveQuery(() => {
    if (from && to) return db.workoutSessions.where('date').between(from, to, true, true).toArray()
    if (from) return db.workoutSessions.where('date').aboveOrEqual(from).toArray()
    if (to) return db.workoutSessions.where('date').belowOrEqual(to).toArray()
    return db.workoutSessions.toArray()
  }, [from, to])
}

export function useCompletedSessionCount(): number | undefined {
  return useLiveQuery(() => db.workoutSessions.where('completedAt').above(0).count(), [])
}
