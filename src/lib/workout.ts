import { db } from '../db/schema'
import { todayISODate } from './format'
import type { LoggedSet, PlanSession, SkipEvent, WorkoutSession } from '../db/types'

export async function getInProgressSession(): Promise<WorkoutSession | undefined> {
  const all = await db.workoutSessions.filter((s) => s.completedAt === undefined).toArray()
  return all[all.length - 1]
}

export async function startSession(planSession: PlanSession): Promise<number> {
  const existing = await getInProgressSession()
  if (existing?.id) return existing.id

  const id = await db.workoutSessions.add({
    date: todayISODate(),
    planSessionName: planSession.name,
    exercises: [],
    skips: [],
    startedAt: Date.now(),
  })
  return id as number
}

export function todayWeekdayIndex(): number {
  // Convert JS getDay() (0=Sunday) to our plan's dayIndex (0=Monday).
  const jsDay = new Date().getDay()
  return (jsDay + 6) % 7
}

export function findTodaysSession(sessions: PlanSession[]): PlanSession | undefined {
  return sessions.find((s) => s.dayIndex === todayWeekdayIndex())
}

export async function logSet(
  sessionId: number,
  exerciseId: string,
  set: LoggedSet,
  swappedFromExerciseId?: string,
): Promise<void> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return

  const exercises = [...session.exercises]
  let entry = exercises.find((e) => e.exerciseId === exerciseId)
  if (!entry) {
    entry = { exerciseId, sets: [], swappedFromExerciseId }
    exercises.push(entry)
  }
  entry.sets = [...entry.sets, set]

  await db.workoutSessions.update(sessionId, { exercises })
}

export async function recordSkip(sessionId: number, skip: SkipEvent): Promise<void> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  await db.workoutSessions.update(sessionId, { skips: [...session.skips, skip] })
}

export async function finishSession(
  sessionId: number,
  finishedEarly: boolean,
): Promise<void> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  const completedAt = Date.now()
  await db.workoutSessions.update(sessionId, {
    completedAt,
    finishedEarly,
    durationSeconds: Math.round((completedAt - session.startedAt) / 1000),
  })
}

export async function leaveSession(sessionId: number): Promise<void> {
  await db.workoutSessions.delete(sessionId)
}

export async function mostRecentLoggedSets(
  exerciseId: string,
  excludeSessionId?: number,
): Promise<LoggedSet[] | undefined> {
  const past = await db.workoutSessions
    .where('completedAt')
    .above(0)
    .reverse()
    .toArray()
  for (const s of past) {
    if (s.id === excludeSessionId) continue
    const match = s.exercises.find((e) => e.exerciseId === exerciseId)
    if (match && match.sets.length > 0) return match.sets
  }
  return undefined
}
