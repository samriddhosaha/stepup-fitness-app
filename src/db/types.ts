export type FitnessLevel = 'new' | 'regular' | 'experienced'
export type PrimaryGoal =
  | 'build-muscle'
  | 'lift-heavier'
  | 'lean-out'
  | 'go-longer'
  | 'feel-better'
export type Equipment =
  | 'none'
  | 'dumbbells'
  | 'bands'
  | 'bench-rack'
  | 'full-gym'
export type TrainingPreference =
  | 'barbell'
  | 'dumbbell'
  | 'bodyweight'
  | 'machines'
  | 'conditioning'
  | 'mobility'
/** Body areas an exercise can aggravate; users pick theirs during onboarding. */
export type InjuryArea = 'lower-back' | 'knee' | 'shoulder' | 'wrist-elbow' | 'neck' | 'hip'
export type WeightUnit = 'kg' | 'lb'
export type Appearance = 'light' | 'dark' | 'system'
export type Sex = 'male' | 'female' | 'unspecified'

export interface Profile {
  id?: number
  name: string
  age?: number
  sex?: Sex
  heightCm?: number
  startingWeightKg?: number
  fitnessLevel: FitnessLevel
  liftsAlready: boolean
  doesCardioAlready: boolean
  primaryGoal: PrimaryGoal
  secondaryGoal?: PrimaryGoal
  daysPerWeek: number
  sessionLengthMinutes: number
  equipment: Equipment[]
  trainingPreferences: TrainingPreference[]
  exclusions?: string
  injuries?: string
  /** Structured injury picker (drives exercise selection). `injuries` stays as free-text context. */
  injuryAreas?: InjuryArea[]
  /** Weekdays the user trains, 0 = Monday. When set, sessions land on exactly these days. */
  trainingDays?: number[]
  /** Exercises the user asked not to see again (e.g. after discomfort). */
  avoidedExerciseIds?: string[]
  /** A readiness answer asked for care: the plan stays gentler (fewer sets, no heavy compounds). */
  gentleStart?: boolean
  weightUnit: WeightUnit
  appearance: Appearance
  aiCoachEnabled?: boolean
  onboardingCompleted: boolean
  createdAt: number
}

export type SessionType =
  | 'full-body-a'
  | 'full-body-b'
  | 'full-body-c'
  | 'upper-body'
  | 'lower-body'
  | 'conditioning'
  | 'easy-endurance'
  | 'intervals'

export type PlanBlock = 'warm-up' | 'main' | 'cool-down'

export interface PlanExercise {
  exerciseId: string
  targetSets: number
  /** Reps, or seconds for `duration` exercises, or minutes for `distance-time`. */
  targetRepsLow: number
  targetRepsHigh: number
  startingLoadKg?: number
  restSeconds?: number
  block?: PlanBlock
  /** Main lifts keep their sets when a session is squeezed for time; accessories give way first. */
  role?: 'main' | 'accessory'
}

export interface PlanSession {
  name: string
  type: SessionType
  dayIndex: number // 0-6, which day of the week this lands on
  exercises: PlanExercise[]
  pushVolumeSets?: number
  pullVolumeSets?: number
}

export interface Plan {
  id?: number
  createdAt: number
  sessions: PlanSession[]
  volumeUneven: boolean
}

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'press'
  | 'pull'
  | 'carry'
  | 'core'
  | 'isolation'
  | 'conditioning'
  | 'mobility'

export interface WarmupRampSet {
  percentOfWorking: number
  reps: number
}

/** What is logged for each set. */
export type TrackingType = 'weight-reps' | 'bodyweight-reps' | 'duration' | 'distance-time'
export type ImplementKind = 'barbell' | 'dumbbell' | 'bodyweight' | 'machine' | 'band'

export interface Exercise {
  id: string
  name: string
  movementPattern: MovementPattern
  primaryMuscles: string[]
  equipmentRequired: Equipment[]
  substitutionGroupId: string
  formCues: [string, string, string]
  warmupRamp?: WarmupRampSet[]
  trackingType: TrackingType
  /** 1 = learn it in a session; 2 = needs some practice; 3 = technical, for experienced lifters. */
  skill: 1 | 2 | 3
  beginnerFriendly: boolean
  /** Body areas this movement commonly aggravates. */
  contraindications: InjuryArea[]
  /** For presses and pulls: which plane of movement, used to balance a plan. */
  plane?: 'vertical' | 'horizontal'
  unilateral: boolean
  kit: ImplementKind
  /** Reserved for future demos; typed now so the library can grow media without a schema change. */
  media?: { imageUrl?: string; videoUrl?: string }
}

export type SkipReason =
  | 'too-difficult'
  | 'equipment-not-free'
  | 'discomfort-or-pain'
  | 'running-out-of-time'
  | 'another-reason'
  | 'unspecified'

export interface LoggedSet {
  setIndex: number
  weightKg?: number
  reps?: number
  durationSeconds?: number
  distanceM?: number
  rpe?: number // 1-5
  note?: string
}

export interface LoggedExercise {
  exerciseId: string
  sets: LoggedSet[]
  swappedFromExerciseId?: string
}

export interface SkipEvent {
  exerciseId: string
  reason: SkipReason
  note?: string
}

export interface WorkoutSession {
  id?: number
  date: string // YYYY-MM-DD
  planSessionName: string
  exercises: LoggedExercise[]
  skips: SkipEvent[]
  startedAt: number
  completedAt?: number
  durationSeconds?: number
  finishedEarly?: boolean
  // --- v2: durable in-progress state (C-06) and plan-independent history (C-08) ---
  /** Planned exercises as they were when the session started; survives plan rebuilds. */
  plannedSnapshot?: PlanExercise[]
  /** Exercise order for this session, with swaps applied. */
  exerciseOrder?: string[]
  /** Maps a swapped-in exerciseId back to the planned exerciseId it replaced. */
  swapMap?: Record<string, string>
  currentIndex?: number
  /** Epoch ms when the current rest ends; the timer derives from this so it survives reloads. */
  restEndsAt?: number
  /** Weekday (0 = Mon) this session was scheduled for when it started. */
  plannedDayIndex?: number
}

export interface ProgressSnapshot {
  id?: number
  date: string // YYYY-MM-DD
  bodyWeightKg: number
}

export type PRKind = 'weight' | 'e1rm' | 'reps' | 'time'

export interface PersonalRecord {
  id?: number
  exerciseId: string
  value: number // kg for 'weight' / 'e1rm', reps for 'reps'
  reps: number
  achievedAt: number
  sessionId?: number
  /** Missing on pre-v2 rows, which were all estimated-1RM records. */
  kind?: PRKind
  /** First log of an exercise: recorded silently, never shown or rewarded as a PR. */
  baseline?: boolean
}

export type XPEventType = 'set' | 'exercise' | 'workout' | 'pr'

export interface XPEvent {
  id?: number
  type: XPEventType
  amount: number
  occurredAt: number
  note?: string
}

export interface AppEvent {
  id?: number
  name: string
  propsJson?: string
  occurredAt: number
}

/** What the engine last saw for an exercise; progression reads this, not the plan. */
export interface ExerciseState {
  exerciseId: string
  workingWeightKg?: number
  lastReps: number[]
  lastRpe?: number
  lastDate: string // YYYY-MM-DD
  consecutiveFails: number
  updatedAt: number
}

export interface SettingRow {
  key: string
  value: unknown
}

export interface WeeklyReview {
  weekKey: string // Monday of the week, YYYY-MM-DD
  payloadHash: string
  text: string
  createdAt: number
}
