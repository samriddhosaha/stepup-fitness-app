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
} from './types'

export class ForgeDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>
  plans!: EntityTable<Plan, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  workoutSessions!: EntityTable<WorkoutSession, 'id'>
  progressSnapshots!: EntityTable<ProgressSnapshot, 'id'>
  personalRecords!: EntityTable<PersonalRecord, 'id'>
  xpEvents!: EntityTable<XPEvent, 'id'>
  appEvents!: EntityTable<AppEvent, 'id'>

  constructor() {
    super('forge-db')

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
  }
}

export const db = new ForgeDB()

export async function getActiveProfile(): Promise<Profile | undefined> {
  return db.profile.orderBy('createdAt').last()
}

export async function getActivePlan(): Promise<Plan | undefined> {
  return db.plans.orderBy('createdAt').last()
}

export async function wipeAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.profile,
      db.plans,
      db.exercises,
      db.workoutSessions,
      db.progressSnapshots,
      db.personalRecords,
      db.xpEvents,
      db.appEvents,
    ],
    async () => {
      await Promise.all([
        db.profile.clear(),
        db.plans.clear(),
        db.workoutSessions.clear(),
        db.progressSnapshots.clear(),
        db.personalRecords.clear(),
        db.xpEvents.clear(),
        db.appEvents.clear(),
      ])
      // exercises (the static library) is reseeded, not wiped, by the caller if needed
    },
  )
}
