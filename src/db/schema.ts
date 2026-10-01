import Dexie, { type EntityTable } from 'dexie'
import type {
  Profile,
  Plan,
  Exercise,
  WorkoutSession,
  ProgressSnapshot,
  PersonalRecord,
  XPEvent,
  AppEvent,
  ExerciseState,
  SettingRow,
  WeeklyReview,
} from './types'
import { rebuildExerciseStates } from '../lib/exerciseStateBackfill'

export class StepUpDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>
  plans!: EntityTable<Plan, 'id'>
  /** Legacy v1 store. The library now lives in code (EXERCISE_LIBRARY); nothing reads or seeds this. */
  exercises!: EntityTable<Exercise, 'id'>
  workoutSessions!: EntityTable<WorkoutSession, 'id'>
  progressSnapshots!: EntityTable<ProgressSnapshot, 'id'>
  personalRecords!: EntityTable<PersonalRecord, 'id'>
  xpEvents!: EntityTable<XPEvent, 'id'>
  appEvents!: EntityTable<AppEvent, 'id'>
  exerciseState!: EntityTable<ExerciseState, 'exerciseId'>
  settings!: EntityTable<SettingRow, 'key'>
  weeklyReviews!: EntityTable<WeeklyReview, 'weekKey'>

  constructor(name = 'stepup-db') {
    super(name)

    this.version(1).stores({
      profile: '++id, createdAt',
      plans: '++id, createdAt',
      exercises: 'id, movementPattern, substitutionGroupId',
      workoutSessions: '++id, date, completedAt',
      progressSnapshots: '++id, date',
      personalRecords: '++id, exerciseId, achievedAt',
      xpEvents: '++id, type, occurredAt',
      appEvents: '++id, name, occurredAt',
    })

    this.version(2)
      .stores({
        personalRecords: '++id, exerciseId, achievedAt, sessionId',
        exerciseState: 'exerciseId',
        settings: 'key',
        weeklyReviews: 'weekKey',
      })
      .upgrade(async (tx) => {
        // Backfill what the engine would have learned from past completed sessions.
        const sessions = await tx.table<WorkoutSession>('workoutSessions').toArray()
        const states = rebuildExerciseStates(sessions)
        if (states.length) await tx.table<ExerciseState>('exerciseState').bulkPut(states)
        // The old per-install exercise copy is dead weight now.
        await tx.table('exercises').clear()
      })
  }
}

export const db = new StepUpDB()

export async function getActiveProfile(): Promise<Profile | undefined> {
  return db.profile.orderBy('createdAt').last()
}

export async function getActivePlan(): Promise<Plan | undefined> {
  return db.plans.orderBy('createdAt').last()
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

/** Random per-install id, sent as a rate-limit hint to the AI endpoint. Not authentication. */
export async function getInstallToken(): Promise<string> {
  const existing = await getSetting<string>('installToken')
  if (existing) return existing
  const token = crypto.randomUUID()
  await setSetting('installToken', token)
  return token
}

const ALL_TABLES = [
  'profile',
  'plans',
  'workoutSessions',
  'progressSnapshots',
  'personalRecords',
  'xpEvents',
  'appEvents',
  'exerciseState',
  'settings',
  'weeklyReviews',
] as const

/** Deletes the whole database (and reopens an empty one) plus every localStorage key StepUp wrote. */
export async function wipeAllData(): Promise<void> {
  db.close()
  await Dexie.delete(db.name)
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('stepup-')) localStorage.removeItem(key)
    }
  } catch {
    /* storage unavailable */
  }
  await db.open()
}

export { ALL_TABLES }
