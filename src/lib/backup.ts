import { z } from 'zod'
import { db, setSetting } from '../db/schema'
import { todayISODate } from './format'
import { rebuildExerciseStates } from './exerciseStateBackfill'
import type { WorkoutSession } from '../db/types'

// Loaded lazily from the Profile screen so zod stays out of the main bundle.

export const BACKUP_VERSION = 3
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024

const num = z.number().finite()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const id = z.number().int().positive().optional()

const loggedSet = z.object({
  setIndex: z.number().int().min(0),
  weightKg: num.min(0).max(1000).optional(),
  reps: z.number().int().min(0).max(1000).optional(),
  durationSeconds: num.min(0).optional(),
  distanceM: num.min(0).max(500_000).optional(),
  rpe: num.min(0).max(10).optional(),
  note: z.string().max(1000).optional(),
})
const planExercise = z.object({
  exerciseId: z.string().min(1),
  targetSets: z.number().int().min(1).max(50),
  targetRepsLow: num.min(0),
  targetRepsHigh: num.min(0),
  startingLoadKg: num.min(0).optional(),
  restSeconds: num.min(0).max(1800).optional(),
  block: z.enum(['warm-up', 'main', 'cool-down']).optional(),
  role: z.enum(['main', 'accessory']).optional(),
})
const skipReason = z.enum([
  'too-difficult',
  'equipment-not-free',
  'discomfort-or-pain',
  'running-out-of-time',
  'another-reason',
  'unspecified',
])
const equipment = z.enum(['none', 'dumbbells', 'bands', 'bench-rack', 'full-gym'])
const goal = z.enum(['build-muscle', 'lift-heavier', 'lean-out', 'go-longer', 'feel-better'])

const profile = z.object({
  id,
  name: z.string().max(200),
  age: num.optional(),
  sex: z.enum(['male', 'female', 'unspecified']).optional(),
  heightCm: num.optional(),
  startingWeightKg: num.optional(),
  fitnessLevel: z.enum(['new', 'regular', 'experienced']),
  liftsAlready: z.boolean(),
  doesCardioAlready: z.boolean(),
  primaryGoal: goal,
  secondaryGoal: goal.optional(),
  daysPerWeek: z.number().int().min(1).max(7),
  sessionLengthMinutes: num.min(5).max(300),
  equipment: z.array(equipment).max(5),
  trainingPreferences: z.array(z.enum(['barbell', 'dumbbell', 'bodyweight', 'machines', 'conditioning', 'mobility'])).max(6),
  exclusions: z.string().max(5000).optional(),
  injuries: z.string().max(5000).optional(),
  injuryAreas: z.array(z.enum(['lower-back', 'knee', 'shoulder', 'wrist-elbow', 'neck', 'hip'])).max(6).optional(),
  trainingDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  avoidedExerciseIds: z.array(z.string().max(80)).max(300).optional(),
  gentleStart: z.boolean().optional(),
  weightUnit: z.enum(['kg', 'lb']),
  appearance: z.enum(['light', 'dark', 'system']),
  aiCoachEnabled: z.boolean().optional(),
  onboardingCompleted: z.boolean(),
  createdAt: num,
})
const plan = z.object({
  id,
  createdAt: num,
  volumeUneven: z.boolean(),
  sessions: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['full-body-a', 'full-body-b', 'full-body-c', 'upper-body', 'lower-body', 'conditioning', 'easy-endurance', 'intervals']),
        dayIndex: z.number().int().min(0).max(6),
        exercises: z.array(planExercise).max(60),
        pushVolumeSets: num.optional(),
        pullVolumeSets: num.optional(),
      }),
    )
    .max(14),
})
const workoutSession = z.object({
  id,
  date: isoDate,
  planSessionName: z.string(),
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().min(1),
        sets: z.array(loggedSet).max(200),
        swappedFromExerciseId: z.string().optional(),
      }),
    )
    .max(100),
  skips: z.array(z.object({ exerciseId: z.string(), reason: skipReason, note: z.string().optional() })).max(200),
  startedAt: num,
  completedAt: num.optional(),
  durationSeconds: num.optional(),
  finishedEarly: z.boolean().optional(),
  plannedSnapshot: z.array(planExercise).optional(),
  exerciseOrder: z.array(z.string()).optional(),
  swapMap: z.record(z.string(), z.string()).optional(),
  currentIndex: z.number().int().min(0).optional(),
  restEndsAt: num.optional(),
  plannedDayIndex: z.number().int().min(0).max(6).optional(),
})
const progressSnapshot = z.object({ id, date: isoDate, bodyWeightKg: num.min(0).max(1000) })
const personalRecord = z.object({
  id,
  exerciseId: z.string().min(1),
  value: num.min(0),
  reps: num.min(0),
  achievedAt: num,
  sessionId: z.number().int().optional(),
  kind: z.enum(['weight', 'e1rm', 'reps', 'time']).optional(),
  baseline: z.boolean().optional(),
})
const xpEvent = z.object({
  id,
  type: z.enum(['set', 'exercise', 'workout', 'pr']),
  amount: num,
  occurredAt: num,
  note: z.string().optional(),
})
const appEvent = z.object({ id, name: z.string(), propsJson: z.string().optional(), occurredAt: num })
const exerciseState = z.object({
  exerciseId: z.string().min(1),
  workingWeightKg: num.min(0).optional(),
  lastReps: z.array(num),
  lastRpe: num.optional(),
  lastDate: z.string(),
  consecutiveFails: z.number().int().min(0),
  updatedAt: num,
})

const customExercise = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  movementPattern: z.enum(['squat', 'hinge', 'press', 'pull', 'carry', 'core', 'isolation', 'conditioning', 'mobility']),
  primaryMuscles: z.array(z.string().max(40)).max(8),
  equipmentRequired: z.array(equipment).min(1).max(5),
  substitutionGroupId: z.string().max(80),
  formCues: z.tuple([z.string().max(200), z.string().max(200), z.string().max(200)]),
  trackingType: z.enum(['weight-reps', 'bodyweight-reps', 'duration', 'distance-time']),
  skill: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  beginnerFriendly: z.boolean(),
  contraindications: z.array(z.enum(['lower-back', 'knee', 'shoulder', 'wrist-elbow', 'neck', 'hip'])).max(6),
  plane: z.enum(['vertical', 'horizontal']).optional(),
  unilateral: z.boolean(),
  kit: z.enum(['barbell', 'dumbbell', 'bodyweight', 'machine', 'band']),
})

const backupSchema = z.object({
  version: z.number().int().min(1),
  exportedAt: num,
  tables: z.object({
    profile: z.array(profile).max(50),
    plans: z.array(plan),
    workoutSessions: z.array(workoutSession),
    progressSnapshots: z.array(progressSnapshot),
    personalRecords: z.array(personalRecord),
    xpEvents: z.array(xpEvent),
    appEvents: z.array(appEvent).default([]),
    exerciseState: z.array(exerciseState).optional(),
    customExercises: z.array(customExercise).max(500).optional(),
  }),
})

export type Backup = z.infer<typeof backupSchema>

export interface BackupSummary {
  version: number
  exportedAt: number
  profileName?: string
  workouts: number
  firstDate?: string
  lastDate?: string
}

export type ParseResult = { ok: true; backup: Backup; summary: BackupSummary } | { ok: false; error: string }

const NOT_A_BACKUP = 'This file doesn’t look like a StepUp backup.'

export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: 'This file is too large to be a StepUp backup.' }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: NOT_A_BACKUP }
  }
  const version = (raw as { version?: unknown } | null)?.version
  if (typeof version !== 'number') return { ok: false, error: NOT_A_BACKUP }
  if (version > BACKUP_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of StepUp. Update the app and try again.' }
  }
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue ? issue.path.slice(0, 3).join(' › ') : 'unknown'
    return { ok: false, error: `Some of the data in this backup is damaged (${where}). Nothing was changed.` }
  }

  const backup = parsed.data
  // v1 backups predate exerciseState; rebuild what progression needs from the logged history.
  if (!backup.tables.exerciseState) {
    backup.tables.exerciseState = rebuildExerciseStates(backup.tables.workoutSessions as WorkoutSession[])
  }
  const done = backup.tables.workoutSessions.filter((s) => s.completedAt)
  const dates = done.map((s) => s.date).sort()
  return {
    ok: true,
    backup,
    summary: {
      version,
      exportedAt: backup.exportedAt,
      profileName: backup.tables.profile.at(-1)?.name,
      workouts: done.length,
      firstDate: dates[0],
      lastDate: dates.at(-1),
    },
  }
}

export async function buildBackup(): Promise<Backup> {
  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    tables: {
      profile: await db.profile.toArray(),
      plans: await db.plans.toArray(),
      workoutSessions: await db.workoutSessions.toArray(),
      progressSnapshots: await db.progressSnapshots.toArray(),
      personalRecords: await db.personalRecords.toArray(),
      xpEvents: await db.xpEvents.toArray(),
      appEvents: await db.appEvents.toArray(),
      exerciseState: await db.exerciseState.toArray(),
      customExercises: await db.customExercises.toArray(),
    },
  }
}

/** Replaces all data atomically. If anything throws, the transaction rolls back and nothing changes. */
export async function applyBackup(backup: Backup): Promise<void> {
  const t = backup.tables
  await db.transaction(
    'rw',
    [db.profile, db.plans, db.workoutSessions, db.progressSnapshots, db.personalRecords, db.xpEvents, db.appEvents, db.exerciseState, db.weeklyReviews, db.customExercises],
    async () => {
      await Promise.all([
        db.profile.clear(),
        db.plans.clear(),
        db.workoutSessions.clear(),
        db.progressSnapshots.clear(),
        db.personalRecords.clear(),
        db.xpEvents.clear(),
        db.appEvents.clear(),
        db.exerciseState.clear(),
        db.weeklyReviews.clear(),
        db.customExercises.clear(),
      ])
      await db.profile.bulkAdd(t.profile)
      await db.plans.bulkAdd(t.plans)
      await db.workoutSessions.bulkAdd(t.workoutSessions)
      await db.progressSnapshots.bulkAdd(t.progressSnapshots)
      await db.personalRecords.bulkAdd(t.personalRecords)
      await db.xpEvents.bulkAdd(t.xpEvents)
      await db.appEvents.bulkAdd(t.appEvents)
      await db.exerciseState.bulkAdd(t.exerciseState ?? [])
      await db.customExercises.bulkAdd(t.customExercises ?? [])
    },
  )
}

export async function importBackupFile(file: File): Promise<ParseResult> {
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: 'This file is too large to be a StepUp backup.' }
  return parseBackup(await file.text())
}

export const backupFileName = (prefix = 'stepup-backup'): string => `${prefix}-${todayISODate()}.json`

/** Delivers a file: native share sheet where files can be shared, otherwise a download. */
export async function deliverFile(blob: Blob, filename: string, preferShare: boolean): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: blob.type })
  if (preferShare && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') throw err
      // share failed for another reason: fall through to download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a) // some browsers ignore clicks on detached anchors
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

export async function exportAllData(): Promise<'shared' | 'downloaded'> {
  const blob = new Blob([JSON.stringify(await buildBackup(), null, 2)], { type: 'application/json' })
  const how = await deliverFile(blob, backupFileName(), true)
  await setSetting('lastBackupAt', Date.now())
  return how
}

/** Safety copy taken before an import replaces data. Always a plain download, never the share sheet. */
export async function downloadSafetyCopy(): Promise<void> {
  const blob = new Blob([JSON.stringify(await buildBackup(), null, 2)], { type: 'application/json' })
  await deliverFile(blob, backupFileName('stepup-before-import'), false)
}

const csvCell = (v: string | number | undefined): string => {
  const s = v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** One row per logged set. Weights stay in kg so the file is unit-independent. */
export function sessionsToCsv(sessions: WorkoutSession[], exerciseName: (id: string) => string = (x) => x): string {
  const rows = [['date', 'session', 'exercise', 'set', 'weight_kg', 'reps', 'duration_seconds', 'rpe', 'note']]
  for (const s of [...sessions].filter((x) => x.completedAt).sort((a, b) => a.date.localeCompare(b.date))) {
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        rows.push([
          s.date,
          s.planSessionName,
          exerciseName(ex.exerciseId),
          String(set.setIndex + 1),
          set.weightKg === undefined ? '' : String(set.weightKg),
          set.reps === undefined ? '' : String(set.reps),
          set.durationSeconds === undefined ? '' : String(set.durationSeconds),
          set.rpe === undefined ? '' : String(set.rpe),
          set.note ?? '',
        ])
      }
    }
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n'
}

export async function exportSessionsCsv(exerciseName: (id: string) => string): Promise<'shared' | 'downloaded'> {
  const csv = sessionsToCsv(await db.workoutSessions.toArray(), exerciseName)
  return deliverFile(new Blob([csv], { type: 'text/csv' }), `stepup-sessions-${todayISODate()}.csv`, true)
}
