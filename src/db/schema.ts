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
  WaterLog,
  BodyMeasurement,
  CheckIn,
  Habit,
  HabitLog,
  CustomFood,
  MealLog,
  SavedMeal,
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
  customExercises!: EntityTable<Exercise, 'id'>
  waterLogs!: EntityTable<WaterLog, 'id'>
  bodyMeasurements!: EntityTable<BodyMeasurement, 'id'>
  checkIns!: EntityTable<CheckIn, 'id'>
  habits!: EntityTable<Habit, 'id'>
  habitLogs!: EntityTable<HabitLog, 'id'>
  foods!: EntityTable<CustomFood, 'id'>
  mealLogs!: EntityTable<MealLog, 'id'>
  savedMeals!: EntityTable<SavedMeal, 'id'>

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

    // v3: the person's own exercises
    this.version(3).stores({ customExercises: 'id' })

    // v4: daily health. Purely additive. Unique indexes enforce "one check-in per day" and
    // "a habit is either done or not on a given day" in the database itself.
    this.version(4).stores({
      waterLogs: '++id, date, loggedAt',
      bodyMeasurements: '++id, date, type',
      checkIns: '++id, &date',
      habits: '++id, createdAt',
      habitLogs: '++id, habitId, date, &[habitId+date]',
    })

    // v5: nutrition. Additive: custom foods, a meal-by-meal log (macros stored as eaten), favourites.
    this.version(5).stores({
      foods: '++id, name',
      mealLogs: '++id, date, loggedAt',
      savedMeals: '++id, name',
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
  'customExercises',
  'waterLogs',
  'bodyMeasurements',
  'checkIns',
  'habits',
  'habitLogs',
  'foods',
  'mealLogs',
  'savedMeals',
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
