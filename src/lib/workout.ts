import { db } from '../db/schema'
import { todayISODate } from './format'
import { awardXP } from './xp'
import { recordSessionPRs } from './records'
import { nextExerciseState } from './overload'
import { rebuildExerciseStates } from './exerciseStateBackfill'
import { REPS_RANGE, isInRange, WORKOUT_LOAD_KG_RANGE } from './validation'
import type {
  LoggedSet,
  PersonalRecord,
  PlanExercise,
  PlanSession,
  SkipEvent,
  WorkoutSession,
} from '../db/types'

/** An in-progress session older than this is treated as abandoned rather than silently resumed. */
export const STALE_SESSION_MS = 12 * 60 * 60 * 1000

export async function getInProgressSession(): Promise<WorkoutSession | undefined> {
  const open = await db.workoutSessions.filter((s) => s.completedAt === undefined).toArray()
  return open[open.length - 1]
}

export type StartResult =
  | { status: 'started'; id: number }
  | { status: 'resumed'; id: number }
  | { status: 'conflict'; existing: WorkoutSession }

function createSession(planSession: PlanSession, now: number): Promise<number> {
  const snapshot: PlanExercise[] = planSession.exercises.map((e) => ({ ...e }))
  return db.workoutSessions.add({
    date: todayISODate(),
    planSessionName: planSession.name,
    plannedDayIndex: planSession.dayIndex,
    exercises: [],
    skips: [],
    startedAt: now,
    plannedSnapshot: snapshot,
    exerciseOrder: snapshot.map((e) => e.exerciseId),
    swapMap: {},
    currentIndex: 0,
  }) as Promise<number>
}

/**
 * Starts a session. An existing unfinished session is resumed only when it is the same plan
 * session and fresh (< 12 h); otherwise the caller gets a `conflict` and asks the user
 * whether to resume or discard.
 */
export async function startSession(planSession: PlanSession, now = Date.now()): Promise<StartResult> {
  const existing = await getInProgressSession()
  if (existing?.id !== undefined) {
    const fresh = now - existing.startedAt < STALE_SESSION_MS
    if (fresh && existing.planSessionName === planSession.name) {
      return { status: 'resumed', id: existing.id }
    }
    return { status: 'conflict', existing }
  }
  return { status: 'started', id: await createSession(planSession, now) }
}

export async function discardAndStart(planSession: PlanSession, now = Date.now()): Promise<number> {
  return db.transaction('rw', db.workoutSessions, async () => {
    const open = await db.workoutSessions.filter((s) => s.completedAt === undefined).primaryKeys()
    await db.workoutSessions.bulkDelete(open)
    return createSession(planSession, now)
  })
}

export function todayWeekdayIndex(): number {
  // Convert JS getDay() (0=Sunday) to our plan's dayIndex (0=Monday).
  return (new Date().getDay() + 6) % 7
}

export function findTodaysSession(sessions: PlanSession[]): PlanSession | undefined {
  return sessions.find((s) => s.dayIndex === todayWeekdayIndex())
}

export async function setCurrentIndex(sessionId: number, currentIndex: number): Promise<void> {
  await db.workoutSessions.update(sessionId, { currentIndex })
}

export async function setRestEndsAt(sessionId: number, restEndsAt: number | undefined): Promise<void> {
  await db.workoutSessions.update(sessionId, { restEndsAt })
}

/** Replaces the exercise at `index`, remembering which planned exercise it stands in for. */
export async function swapExercise(sessionId: number, index: number, newExerciseId: string): Promise<void> {
  await db.transaction('rw', db.workoutSessions, async () => {
    const s = await db.workoutSessions.get(sessionId)
    if (!s?.exerciseOrder) return
    const current = s.exerciseOrder[index]
    if (!current) return
    const order = [...s.exerciseOrder]
    order[index] = newExerciseId
    const swapMap = { ...(s.swapMap ?? {}), [newExerciseId]: s.swapMap?.[current] ?? current }
    await db.workoutSessions.update(sessionId, { exerciseOrder: order, swapMap })
  })
}

export type LogResult = { ok: true } | { ok: false; reason: 'missing' | 'incomplete' | 'out-of-range' | 'duplicate' }

/**
 * Logs one set (and its +5 XP) atomically. A set needs reps or a duration; `set.setIndex`
 * must be the next index for the exercise, which makes a double-tap a no-op.
 */
export async function logSet(
  sessionId: number,
  exerciseId: string,
  set: LoggedSet,
  swappedFromExerciseId?: string,
): Promise<LogResult> {
  const hasReps = (set.reps ?? 0) > 0
  const hasDuration = (set.durationSeconds ?? 0) > 0
  if (!hasReps && !hasDuration) return { ok: false, reason: 'incomplete' }
  if (hasReps && !isInRange(set.reps!, REPS_RANGE)) return { ok: false, reason: 'out-of-range' }
  if (set.weightKg !== undefined && !isInRange(set.weightKg, WORKOUT_LOAD_KG_RANGE)) {
    return { ok: false, reason: 'out-of-range' }
  }

  return db.transaction('rw', db.workoutSessions, async (): Promise<LogResult> => {
    const session = await db.workoutSessions.get(sessionId)
    if (!session || session.completedAt) return { ok: false, reason: 'missing' }

    const exercises = session.exercises.map((e) => ({ ...e, sets: [...e.sets] }))
    let entry = exercises.find((e) => e.exerciseId === exerciseId)
    if (!entry) {
      entry = { exerciseId, sets: [], swappedFromExerciseId }
      exercises.push(entry)
    }
    if (set.setIndex !== entry.sets.length) return { ok: false, reason: 'duplicate' }
    entry.sets.push(set)

    await db.workoutSessions.update(sessionId, { exercises })
    return { ok: true }
  })
}

/** Applies `change` to one exercise's sets and keeps `setIndex` contiguous. */
async function mutateSets(
  sessionId: number,
  exerciseId: string,
  change: (sets: LoggedSet[]) => LoggedSet[] | null,
): Promise<boolean> {
  return db.transaction('rw', db.workoutSessions, async () => {
    const session = await db.workoutSessions.get(sessionId)
    if (!session || session.completedAt) return false
    const exercises = session.exercises.map((e) => ({ ...e, sets: [...e.sets] }))
    const entry = exercises.find((e) => e.exerciseId === exerciseId)
    if (!entry) return false
    const next = change(entry.sets)
    if (!next) return false
    entry.sets = next.map((s, i) => ({ ...s, setIndex: i }))
    await db.workoutSessions.update(sessionId, { exercises })
    return true
  })
}

export function updateSet(sessionId: number, exerciseId: string, setIndex: number, patch: Partial<LoggedSet>) {
  const merged = { ...patch }
  if (merged.reps !== undefined && !isInRange(merged.reps, REPS_RANGE)) return Promise.resolve(false)
  if (merged.weightKg !== undefined && !isInRange(merged.weightKg, WORKOUT_LOAD_KG_RANGE)) return Promise.resolve(false)
  return mutateSets(sessionId, exerciseId, (sets) => {
    if (!sets[setIndex]) return null
    return sets.map((s, i) => (i === setIndex ? { ...s, ...merged } : s))
  })
}

export function deleteSet(sessionId: number, exerciseId: string, setIndex: number) {
  return mutateSets(sessionId, exerciseId, (sets) => (sets[setIndex] ? sets.filter((_, i) => i !== setIndex) : null))
}

/** Puts a deleted set back where it was (the Undo for deleteSet). */
export function restoreSet(sessionId: number, exerciseId: string, at: number, set: LoggedSet) {
  return mutateSets(sessionId, exerciseId, (sets) => [...sets.slice(0, at), set, ...sets.slice(at)])
}

export async function recordSkip(sessionId: number, skip: SkipEvent): Promise<void> {
  await db.transaction('rw', db.workoutSessions, async () => {
    const session = await db.workoutSessions.get(sessionId)
    if (!session) return
    await db.workoutSessions.update(sessionId, { skips: [...session.skips, skip] })
  })
}

export type FinishResult =
  | { status: 'completed'; prs: PersonalRecord[] }
  | { status: 'already-complete' }
  | { status: 'empty' }
  | { status: 'missing' }

/**
 * Completes a session in one transaction: PRs, XP and exercise state move together.
 * Idempotent (a second call is a no-op), and a session with nothing logged can't be completed.
 */
export async function finishSession(
  sessionId: number,
  finishedEarly: boolean,
  now = Date.now(),
): Promise<FinishResult> {
  return db.transaction(
    'rw',
    [db.workoutSessions, db.personalRecords, db.xpEvents, db.exerciseState],
    async (): Promise<FinishResult> => {
      const session = await db.workoutSessions.get(sessionId)
      if (!session) return { status: 'missing' }
      if (session.completedAt) return { status: 'already-complete' }

      const logged = session.exercises.filter((e) => e.sets.length > 0)
      if (logged.length === 0) return { status: 'empty' }

      await db.workoutSessions.update(sessionId, {
        completedAt: now,
        finishedEarly,
        durationSeconds: Math.round((now - session.startedAt) / 1000),
        restEndsAt: undefined,
      })

      const plannedFor = (exerciseId: string): PlanExercise | undefined => {
        const original = session.swapMap?.[exerciseId] ?? exerciseId
        return session.plannedSnapshot?.find((p) => p.exerciseId === original)
      }

      const prs = await recordSessionPRs(sessionId, logged, now)

      // XP is settled here, once, so editing or deleting sets mid-workout can't be farmed.
      for (const ex of logged) {
        const planned = plannedFor(ex.exerciseId)
        const prev = await db.exerciseState.get(ex.exerciseId)
        const next = nextExerciseState(prev, ex.exerciseId, planned, ex.sets, session.date, now)
        if (next) await db.exerciseState.put(next)
        for (let i = 0; i < ex.sets.length; i += 1) await awardXP('set', ex.exerciseId)
        if (ex.sets.length >= (planned?.targetSets ?? 3)) await awardXP('exercise', ex.exerciseId)
      }
      for (const pr of prs) await awardXP('pr', pr.exerciseId)
      await awardXP('workout')

      return { status: 'completed', prs }
    },
  )
}

/** Re-derives exerciseState for the given exercises from the completed history that remains. */
async function recomputeExerciseState(exerciseIds: string[]): Promise<void> {
  const done = await db.workoutSessions.where('completedAt').above(0).toArray()
  const rebuilt = new Map(rebuildExerciseStates(done).map((s) => [s.exerciseId, s]))
  for (const id of exerciseIds) {
    const next = rebuilt.get(id)
    if (next) await db.exerciseState.put(next)
    else await db.exerciseState.delete(id)
  }
}

/**
 * Deletes a finished workout from history. Its personal records go with it and progression
 * state is re-derived from what remains. XP already earned is kept (XP never goes down).
 */
export async function deleteCompletedSession(sessionId: number): Promise<void> {
  await db.transaction('rw', [db.workoutSessions, db.personalRecords, db.exerciseState], async () => {
    const session = await db.workoutSessions.get(sessionId)
    if (!session) return
    await db.workoutSessions.delete(sessionId)
    await db.personalRecords.where('sessionId').equals(sessionId).delete()
    await recomputeExerciseState(session.exercises.map((e) => e.exerciseId))
  })
}

/** Corrects a logged set in a finished workout (weight, reps, effort, note). */
export async function updateCompletedSet(
  sessionId: number,
  exerciseId: string,
  setIndex: number,
  patch: Pick<LoggedSet, 'weightKg' | 'reps' | 'rpe' | 'note'>,
): Promise<boolean> {
  if (patch.reps !== undefined && !isInRange(patch.reps, REPS_RANGE)) return false
  if (patch.weightKg !== undefined && !isInRange(patch.weightKg, WORKOUT_LOAD_KG_RANGE)) return false
  return db.transaction('rw', [db.workoutSessions, db.exerciseState, db.personalRecords], async () => {
    const session = await db.workoutSessions.get(sessionId)
    const entry = session?.exercises.find((e) => e.exerciseId === exerciseId)
    if (!session || !entry?.sets[setIndex]) return false
    const exercises = session.exercises.map((e) =>
      e.exerciseId === exerciseId ? { ...e, sets: e.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)) } : e,
    )
    await db.workoutSessions.update(sessionId, { exercises })
    await recomputeExerciseState([exerciseId])
    return true
  })
}

export async function discardSession(sessionId: number): Promise<void> {
  await db.workoutSessions.delete(sessionId)
}

export async function mostRecentLoggedSets(
  exerciseId: string,
  excludeSessionId?: number,
): Promise<LoggedSet[] | undefined> {
  const past = await db.workoutSessions.where('completedAt').above(0).reverse().toArray()
  for (const s of past) {
    if (s.id === excludeSessionId) continue
    const match = s.exercises.find((e) => e.exerciseId === exerciseId)
    if (match && match.sets.length > 0) return match.sets
  }
  return undefined
}
