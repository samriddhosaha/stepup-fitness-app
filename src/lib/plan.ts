import type {
  Exercise,
  MovementPattern,
  Plan,
  PlanExercise,
  PlanSession,
  Profile,
  SessionType,
} from '../db/types'
import { EXERCISE_LIBRARY, getExerciseById } from '../db/exerciseLibrary'
import { constraintsFor, isPermitted, skillOk, type Constraints } from './planning/constraints'
import { exerciseMinutes, prescribe, type Role } from './planning/prescribe'

// ---------------------------------------------------------------------------
// Plan generator. A pure pipeline: pick a template → pick exercises for each slot
// (honouring injuries, exclusions, equipment and level) → prescribe sets/reps → fit the time.
// ---------------------------------------------------------------------------

interface Slot {
  pattern: MovementPattern
  role: Role
  plane?: 'vertical' | 'horizontal'
  group?: string
}
const S = (pattern: MovementPattern, role: Role, o: { plane?: 'vertical' | 'horizontal'; group?: string } = {}): Slot => ({
  pattern,
  role,
  ...o,
})

// Slot order is priority order: shorter sessions simply use the first few. Presses and pulls are
// paired (and accessory pushes/pulls alternate across the week) so volume stays balanced.
const TEMPLATES: Partial<Record<SessionType, Slot[]>> = {
  'full-body-a': [
    S('squat', 'main', { group: 'squat' }),
    S('press', 'main', { plane: 'horizontal' }),
    S('pull', 'main', { plane: 'horizontal' }),
    S('hinge', 'accessory', { group: 'glute-bridge' }),
    S('core', 'accessory', { group: 'core-static' }),
    S('isolation', 'accessory', { group: 'triceps' }),
    S('isolation', 'accessory', { group: 'rear-delt' }),
    S('isolation', 'accessory', { group: 'calves' }),
  ],
  'full-body-b': [
    S('hinge', 'main', { group: 'hinge' }),
    S('press', 'main', { plane: 'vertical' }),
    S('pull', 'main', { plane: 'vertical' }),
    S('squat', 'accessory', { group: 'lunge' }),
    S('core', 'accessory', { group: 'core-anti-rotation' }),
    S('isolation', 'accessory', { group: 'biceps' }),
    S('isolation', 'accessory', { group: 'lateral-raise' }),
    S('isolation', 'accessory', { group: 'calves' }),
  ],
  'full-body-c': [
    S('squat', 'main', { group: 'squat' }),
    S('press', 'main', { plane: 'horizontal' }),
    S('pull', 'main', { plane: 'horizontal' }),
    S('hinge', 'accessory', { group: 'leg-curl' }),
    S('core', 'accessory', { group: 'core-dynamic' }),
    S('isolation', 'accessory', { group: 'calves' }),
    S('isolation', 'accessory', { group: 'quad-isolation' }),
    S('isolation', 'accessory', { group: 'calves' }),
  ],
  'lower-body': [
    S('squat', 'main', { group: 'squat' }),
    S('hinge', 'main', { group: 'hinge' }),
    S('squat', 'accessory', { group: 'lunge' }),
    S('hinge', 'accessory', { group: 'glute-bridge' }),
    S('hinge', 'accessory', { group: 'leg-curl' }),
    S('core', 'accessory', { group: 'core-dynamic' }),
    S('isolation', 'accessory', { group: 'calves' }),
    S('isolation', 'accessory', { group: 'quad-isolation' }),
  ],
  'upper-body': [
    S('press', 'main', { plane: 'horizontal' }),
    S('pull', 'main', { plane: 'horizontal' }),
    S('press', 'main', { plane: 'vertical' }),
    S('pull', 'main', { plane: 'vertical' }),
    S('isolation', 'accessory', { group: 'triceps' }),
    S('isolation', 'accessory', { group: 'biceps' }),
    S('isolation', 'accessory', { group: 'lateral-raise' }),
    S('isolation', 'accessory', { group: 'rear-delt' }),
  ],
}

const SESSION_NAMES: Partial<Record<SessionType, string>> = {
  'full-body-a': 'Full Body A',
  'full-body-b': 'Full Body B',
  'full-body-c': 'Full Body C',
  'lower-body': 'Lower Body',
  'upper-body': 'Upper Body',
}

/** Extra accessory slots when a long session outgrows its template. */
const FILL: Slot[] = [
  S('isolation', 'accessory', { group: 'biceps' }),
  S('isolation', 'accessory', { group: 'triceps' }),
  S('core', 'accessory', { group: 'core-static' }),
  S('isolation', 'accessory', { group: 'rear-delt' }),
]

const WARMUP_MINUTES = 5
const MIN_EXERCISES = 3
const MAX_EXERCISES = 8

/** About nine minutes per exercise including rest. */
export function exerciseCountFor(sessionMinutes: number): number {
  return Math.min(MAX_EXERCISES, Math.max(MIN_EXERCISES, Math.round(sessionMinutes / 9)))
}

/** Real estimate: warm-up plus each exercise's work and rest. */
export function estimateSessionMinutes(session: PlanSession): number {
  let total = WARMUP_MINUTES
  for (const pe of session.exercises) {
    const ex = getExerciseById(pe.exerciseId)
    if (ex) total += exerciseMinutes(pe, ex)
  }
  return Math.round(total)
}

// ---------------------------------------------------------------------------
// Choosing exercises
// ---------------------------------------------------------------------------

function groupOk(e: Exercise, slot: Slot, strict: boolean): boolean {
  if (!slot.group) return true
  if (e.substitutionGroupId === slot.group) return true
  if (strict) return false
  // isolation work only borrows from related groups; compound patterns may widen to the pattern
  return slot.pattern === 'isolation' ? (ALT_GROUPS[slot.group] ?? []).includes(e.substitutionGroupId) : slot.pattern !== 'core'
}

const KIT_FOR_PREFERENCE = {
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  bodyweight: 'bodyweight',
  machines: 'machine',
} as const

interface Ctx {
  profile: Profile
  c: Constraints
  usedThisWeek: Set<string>
  usedByType: Map<SessionType, Set<string>>
}

function score(e: Exercise, slot: Slot, ctx: Ctx, type: SessionType): number {
  const { profile, c } = ctx
  let s = 0
  for (const pref of profile.trainingPreferences) {
    if (pref in KIT_FOR_PREFERENCE && e.kit === KIT_FOR_PREFERENCE[pref as keyof typeof KIT_FOR_PREFERENCE]) s += 3
  }
  if (c.level === 'new' || c.gentle) s += (3 - e.skill) * 0.5
  else if (c.level === 'experienced' && slot.role === 'main') s += e.skill * 0.4
  if (slot.role === 'main') {
    if (e.trackingType === 'weight-reps') s += 2.5 // main lifts are loaded when the kit allows
    if (e.trackingType === 'duration') s -= 3 // holds make poor main lifts
  }
  if (!ctx.usedThisWeek.has(e.id)) s += 2
  if (slot.role === 'accessory' && !ctx.usedByType.get(type)?.has(e.id)) s += 1.5 // rotate accessories across repeated days
  return s
}

// When an accessory slot has nothing available, try its closest relatives, never an unrelated muscle.
const ALT_GROUPS: Record<string, string[]> = {
  'lateral-raise': ['triceps'],
  triceps: ['lateral-raise'],
  'rear-delt': ['biceps'],
  biceps: ['rear-delt'],
  calves: [],
  'quad-isolation': ['calves'],
}

function pickForSlot(slot: Slot, ctx: Ctx, type: SessionType, usedInSession: Set<string>): Exercise | undefined {
  const base = EXERCISE_LIBRARY.filter(
    (e) => e.movementPattern === slot.pattern && isPermitted(e, ctx.c) && !usedInSession.has(e.id),
  )
  const attempts: { plane: boolean; group: boolean; relax: boolean }[] = [
    { plane: true, group: true, relax: false },
    { plane: true, group: false, relax: false },
    { plane: false, group: false, relax: false },
    { plane: true, group: true, relax: true },
    { plane: false, group: false, relax: true },
  ]
  for (const a of attempts) {
    // accessories never reach above the person's skill ceiling; if nothing fits, the slot is skipped
    if (a.relax && slot.role !== 'main') continue
    const pool = base.filter(
      (e) =>
        skillOk(e, ctx.c, a.relax) &&
        (!a.plane || !slot.plane || e.plane === slot.plane) &&
        groupOk(e, slot, a.group),
    )
    if (pool.length === 0) continue
    // stable: higher score first, then library order
    return pool
      .map((e, i) => ({ e, i, s: score(e, slot, ctx, type) }))
      .sort((x, y) => y.s - x.s || x.i - y.i)[0]!.e
  }
  return undefined
}

function toPlanExercise(e: Exercise, slot: Slot, profile: Profile, c: Constraints): PlanExercise {
  return {
    exerciseId: e.id,
    ...prescribe(e, slot.role, profile.primaryGoal, c.level, c.gentle, profile.sessionLengthMinutes),
    block: 'main',
    role: slot.role,
  }
}

function mobilityFor(type: SessionType, which: 'warm-up' | 'cool-down', ctx: Ctx, taken: Set<string>): PlanExercise | undefined {
  const groups =
    which === 'warm-up'
      ? type === 'upper-body'
        ? ['mobility-upper-back']
        : ['mobility-lower-body', 'mobility-hips']
      : type === 'upper-body'
        ? ['mobility-upper-back']
        : ['mobility-hips', 'mobility-lower-body']
  const pool = EXERCISE_LIBRARY.filter(
    (e) => e.movementPattern === 'mobility' && groups.includes(e.substitutionGroupId) && isPermitted(e, ctx.c) && !taken.has(e.id),
  )
  const e = pool.sort((a, b) => Number(ctx.usedThisWeek.has(a.id)) - Number(ctx.usedThisWeek.has(b.id)))[0]
  if (!e) return undefined
  return {
    exerciseId: e.id,
    ...prescribe(e, 'accessory', ctx.profile.primaryGoal, ctx.c.level, ctx.c.gentle, ctx.profile.sessionLengthMinutes),
    block: which,
  }
}

const PUSH_GROUPS = new Set(['triceps', 'lateral-raise'])
const PULL_GROUPS = new Set(['rear-delt', 'biceps'])

export function pushPullClass(e: Exercise): 'push' | 'pull' | null {
  if (e.movementPattern === 'press' || PUSH_GROUPS.has(e.substitutionGroupId)) return 'push'
  if (e.movementPattern === 'pull' || PULL_GROUPS.has(e.substitutionGroupId)) return 'pull'
  return null
}

function volumeBySide(exercises: PlanExercise[]): { push: number; pull: number } {
  let push = 0
  let pull = 0
  for (const pe of exercises) {
    const e = getExerciseById(pe.exerciseId)
    const side = e ? pushPullClass(e) : null
    if (side === 'push') push += pe.targetSets
    if (side === 'pull') pull += pe.targetSets
  }
  return { push, pull }
}

/** Brings a session under the time budget: shorter rests and fewer sets first, then fewer exercises. */
function fitToTime(exercises: PlanExercise[], limitMinutes: number): PlanExercise[] {
  const session = (list: PlanExercise[]): PlanSession => ({ name: '', type: 'full-body-a', dayIndex: 0, exercises: list })
  const over = (list: PlanExercise[]) => estimateSessionMinutes(session(list)) > limitMinutes
  let list = exercises.map((e) => ({ ...e }))
  if (!over(list)) return list

  // 1. accessories to two sets (main lifts keep theirs)
  list = list.map((e) => (e.role === 'accessory' && e.targetSets > 2 ? { ...e, targetSets: 2 } : e))
  // 2. drop mobility, then the lowest-priority accessories, never below the minimum
  while (over(list)) {
    const mobilityIdx = list.findIndex((e) => e.block !== 'main')
    if (mobilityIdx >= 0) {
      list.splice(mobilityIdx, 1)
      continue
    }
    const mains = list.filter((e) => e.block === 'main')
    if (mains.length <= MIN_EXERCISES) break
    const lastIdx = list.map((e) => e.block).lastIndexOf('main')
    list.splice(lastIdx, 1)
  }
  // 3. everything to two sets, then shorter rests
  if (over(list)) list = list.map((e) => (e.targetSets > 2 ? { ...e, targetSets: 2 } : e))
  if (over(list)) list = list.map((e) => (e.restSeconds && e.restSeconds > 60 ? { ...e, restSeconds: 60 } : e))
  return list
}

function buildStrengthSession(
  ctx: Ctx,
  type: SessionType,
  dayIndex: number,
  extraFinisher?: PlanExercise,
): PlanSession {
  const { profile, c } = ctx
  const wanted = exerciseCountFor(profile.sessionLengthMinutes)
  const template = TEMPLATES[type] ?? []
  const slots = [...template, ...FILL].slice(0, Math.max(wanted, MIN_EXERCISES))

  const usedInSession = new Set<string>()
  const main: PlanExercise[] = []
  const tryAdd = (slot: Slot) => {
    const e = pickForSlot(slot, ctx, type, usedInSession)
    if (!e) return false
    usedInSession.add(e.id)
    main.push(toPlanExercise(e, slot, profile, c))
    return true
  }
  for (const slot of slots) tryAdd(slot)
  // slots can come up empty (injuries, kit): top up so the session is still worth doing
  for (const slot of FILL) {
    if (main.length >= Math.min(wanted, MAX_EXERCISES)) break
    tryAdd(slot)
  }
  if (main.length === 0) {
    // last resort: anything permitted and gentle, so a session is never empty
    const order: MovementPattern[] = ['hinge', 'core', 'pull', 'press', 'squat', 'mobility']
    for (const pattern of order) {
      if (main.length >= MIN_EXERCISES) break
      const e = pickForSlot(S(pattern, 'main'), ctx, type, usedInSession)
      if (e) {
        usedInSession.add(e.id)
        main.push(toPlanExercise(e, S(pattern, 'accessory'), profile, c))
      }
    }
  }

  const list: PlanExercise[] = []
  if (profile.trainingPreferences.includes('mobility') && main.length > 0) {
    const w = mobilityFor(type, 'warm-up', ctx, usedInSession)
    if (w) {
      usedInSession.add(w.exerciseId)
      list.push(w)
    }
  }
  list.push(...main)
  if (extraFinisher) list.push(extraFinisher)
  if (profile.trainingPreferences.includes('mobility') && main.length > 0) {
    const cd = mobilityFor(type, 'cool-down', ctx, usedInSession)
    if (cd) list.push(cd)
  }

  const exercises = fitToTime(list, profile.sessionLengthMinutes * 1.1)
  for (const pe of exercises) {
    ctx.usedThisWeek.add(pe.exerciseId)
    const set = ctx.usedByType.get(type) ?? new Set<string>()
    set.add(pe.exerciseId)
    ctx.usedByType.set(type, set)
  }
  const { push, pull } = volumeBySide(exercises)
  return {
    name: SESSION_NAMES[type] ?? type,
    type,
    dayIndex,
    exercises,
    pushVolumeSets: push,
    pullVolumeSets: pull,
  }
}

function conditioningExercise(kind: 'endurance' | 'intervals', ctx: Ctx): Exercise | undefined {
  const pool = EXERCISE_LIBRARY.filter(
    (e) =>
      e.movementPattern === 'conditioning' &&
      e.substitutionGroupId === kind &&
      isPermitted(e, ctx.c) &&
      skillOk(e, ctx.c, ctx.c.level !== 'experienced'),
  )
  return pool.sort((a, b) => a.skill - b.skill || Number(ctx.usedThisWeek.has(a.id)) - Number(ctx.usedThisWeek.has(b.id)))[0]
}

function conditioningPlanExercise(e: Exercise, ctx: Ctx): PlanExercise {
  return {
    exerciseId: e.id,
    ...prescribe(e, 'accessory', ctx.profile.primaryGoal, ctx.c.level, ctx.c.gentle, ctx.profile.sessionLengthMinutes),
    block: 'main',
  }
}

function buildConditioningSession(ctx: Ctx, kind: 'endurance' | 'intervals', dayIndex: number): PlanSession | undefined {
  const e = conditioningExercise(kind, ctx) ?? conditioningExercise(kind === 'endurance' ? 'intervals' : 'endurance', ctx)
  if (!e) return undefined
  ctx.usedThisWeek.add(e.id)
  const type: SessionType = e.substitutionGroupId === 'intervals' ? 'intervals' : 'easy-endurance'
  return {
    name: type === 'intervals' ? 'Intervals' : 'Easy Endurance',
    type,
    dayIndex,
    exercises: fitToTime([conditioningPlanExercise(e, ctx)], ctx.profile.sessionLengthMinutes * 1.1),
  }
}

// ---------------------------------------------------------------------------
// Scheduling and the public generator
// ---------------------------------------------------------------------------

const SPREADS: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
}

/** The weekdays (0 = Monday) sessions land on: the user's own pick, or an even spread. */
export function trainingDayIndices(profile: Pick<Profile, 'daysPerWeek' | 'trainingDays'>): number[] {
  const picked = [...new Set((profile.trainingDays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(
    (a, b) => a - b,
  )
  if (picked.length > 0) return picked.slice(0, 6)
  const days = Math.min(Math.max(profile.daysPerWeek, 1), 6)
  return SPREADS[days] ?? SPREADS[3]!
}

function wantsConditioning(profile: Profile): boolean {
  return (
    profile.primaryGoal === 'go-longer' ||
    profile.secondaryGoal === 'go-longer' ||
    profile.primaryGoal === 'lean-out' ||
    profile.doesCardioAlready ||
    profile.trainingPreferences.includes('conditioning')
  )
}

export function generatePlan(profile: Profile): Plan {
  const dayIndices = trainingDayIndices(profile)
  const days = dayIndices.length
  const ctx: Ctx = {
    profile,
    c: constraintsFor(profile),
    usedThisWeek: new Set(),
    usedByType: new Map(),
  }
  const sessions: PlanSession[] = []

  const conditioning = wantsConditioning(profile)
  // lean-out favours intervals; go-longer favours easy endurance
  const conditioningKind: 'endurance' | 'intervals' = profile.primaryGoal === 'lean-out' ? 'intervals' : 'endurance'
  const dedicatedConditioning = conditioning && days >= 4
  const strengthDays = dedicatedConditioning ? days - 1 : days

  let finisher: PlanExercise | undefined
  if (conditioning && !dedicatedConditioning) {
    const e = conditioningExercise(conditioningKind, ctx) ?? conditioningExercise('endurance', ctx)
    if (e) finisher = conditioningPlanExercise(e, ctx)
  }

  const fullBody: SessionType[] = ['full-body-a', 'full-body-b', 'full-body-c']
  for (let i = 0; i < strengthDays; i += 1) {
    const isLast = i === strengthDays - 1
    let type: SessionType
    if (days <= 3) type = fullBody[i % 3]!
    else type = i % 2 === 0 ? 'lower-body' : 'upper-body'
    sessions.push(buildStrengthSession(ctx, type, dayIndices[i]!, isLast ? finisher : undefined))
  }

  if (dedicatedConditioning) {
    const s = buildConditioningSession(ctx, conditioningKind, dayIndices[days - 1]!)
    if (s) sessions.push(s)
    else {
      // nothing safe to do for cardio: give the day back to strength rather than leave a gap
      sessions.push(buildStrengthSession(ctx, 'full-body-c', dayIndices[days - 1]!))
    }
  }

  return { createdAt: Date.now(), sessions, volumeUneven: isUneven(sessions) }
}

// ---------------------------------------------------------------------------
// Balance, deload and calibration hints
// ---------------------------------------------------------------------------

export interface PlanBalance {
  push: number
  pull: number
  horizontal: number
  vertical: number
  uneven: boolean
}

const UNEVEN_RATIO = 0.3

function isUneven(sessions: PlanSession[]): boolean {
  const all = sessions.flatMap((s) => s.exercises)
  const { push, pull } = volumeBySide(all)
  return push + pull > 0 && Math.abs(push - pull) / Math.max(push, pull, 1) > UNEVEN_RATIO
}

export function planBalance(plan: Plan): PlanBalance {
  const all = plan.sessions.flatMap((s) => s.exercises)
  const { push, pull } = volumeBySide(all)
  let horizontal = 0
  let vertical = 0
  for (const pe of all) {
    const e = getExerciseById(pe.exerciseId)
    if (e?.plane === 'horizontal') horizontal += pe.targetSets
    if (e?.plane === 'vertical') vertical += pe.targetSets
  }
  return { push, pull, horizontal, vertical, uneven: push + pull > 0 && Math.abs(push - pull) / Math.max(push, pull, 1) > UNEVEN_RATIO }
}

/**
 * Evens out pushing and pulling: first by adding a set to an existing accessory on the light side,
 * then by adding a suitable exercise to the shortest session. Respects the same safety rules as generation.
 */
export function balancePlan(plan: Plan, profile: Profile): Plan {
  const c = constraintsFor(profile)
  const ctx: Ctx = { profile, c, usedThisWeek: new Set(plan.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId))), usedByType: new Map() }
  const sessions: PlanSession[] = plan.sessions.map((s) => ({ ...s, exercises: s.exercises.map((e) => ({ ...e })) }))

  for (let guard = 0; guard < 8; guard += 1) {
    const { push, pull } = volumeBySide(sessions.flatMap((s) => s.exercises))
    if (!(push + pull > 0 && Math.abs(push - pull) / Math.max(push, pull, 1) > UNEVEN_RATIO)) break
    const lacking: 'push' | 'pull' = push < pull ? 'push' : 'pull'

    const bump = sessions
      .flatMap((s) => s.exercises)
      .find((pe) => {
        const e = getExerciseById(pe.exerciseId)
        return e && pushPullClass(e) === lacking && pe.targetSets < 4 && pe.block === 'main'
      })
    if (bump) {
      bump.targetSets += 1
      continue
    }

    const target = [...sessions]
      .filter((s) => s.exercises.some((e) => e.block === 'main') && s.type !== 'easy-endurance' && s.type !== 'intervals')
      .sort((a, b) => a.exercises.length - b.exercises.length)[0]
    if (!target) break
    const have = new Set(target.exercises.map((e) => e.exerciseId))
    const candidate = EXERCISE_LIBRARY.filter(
      (e) => pushPullClass(e) === lacking && isPermitted(e, c) && skillOk(e, c, true) && !have.has(e.id) && e.movementPattern !== 'mobility',
    ).sort((a, b) => Number(ctx.usedThisWeek.has(a.id)) - Number(ctx.usedThisWeek.has(b.id)) || a.skill - b.skill)[0]
    if (!candidate) break
    const slot = S(candidate.movementPattern, 'accessory')
    const at = target.exercises.map((e) => e.block).lastIndexOf('main') + 1
    target.exercises.splice(at, 0, toPlanExercise(candidate, slot, profile, c))
    ctx.usedThisWeek.add(candidate.id)
  }

  for (const s of sessions) {
    const v = volumeBySide(s.exercises)
    s.pushVolumeSets = v.push
    s.pullVolumeSets = v.pull
  }
  return { ...plan, sessions, volumeUneven: isUneven(sessions) }
}

const DELOAD_AFTER_WEEKS = 6
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** A gentle suggestion every ~6 weeks of training since the plan began (or the last easy week). */
export function deloadDue(planCreatedAt: number, completedWorkoutsSince: number, now: number, lastDeloadAt?: number): boolean {
  const since = Math.max(planCreatedAt, lastDeloadAt ?? 0)
  return (now - since) / WEEK_MS >= DELOAD_AFTER_WEEKS && completedWorkoutsSince >= DELOAD_AFTER_WEEKS
}

// Rough kg-per-kg-of-bodyweight for someone at a "regular" level. A hint only: the first session
// asks the lifter to calibrate, and progression takes over from what they actually lift.
const HINT_COEFFICIENTS: Record<string, number> = {
  'back-squat': 0.75,
  'front-squat': 0.55,
  'goblet-squat': 0.35,
  'leg-press': 1.2,
  deadlift: 1.0,
  'romanian-deadlift': 0.7,
  'dumbbell-rdl': 0.3,
  'hip-thrust': 0.6,
  'bench-press': 0.6,
  'dumbbell-bench-press': 0.25,
  'floor-press': 0.22,
  'machine-chest-press': 0.5,
  'overhead-press': 0.35,
  'dumbbell-shoulder-press': 0.15,
  'machine-shoulder-press': 0.3,
  'barbell-row': 0.5,
  'dumbbell-row': 0.2,
  'chest-supported-row': 0.18,
  'seated-cable-row': 0.45,
  'lat-pulldown': 0.5,
  'leg-curl': 0.3,
  'leg-extension': 0.35,
  'dumbbell-curl': 0.08,
  'hammer-curl': 0.08,
  'lateral-raise': 0.04,
}

/**
 * A rough starting weight to show beside the calibration prompt. No sex-based adjustment;
 * age only trims it slightly at the extremes. Deliberately conservative.
 */
export function estimateCalibrationHintKg(
  exerciseId: string,
  profile: Pick<Profile, 'fitnessLevel' | 'age' | 'startingWeightKg'>,
): number | undefined {
  const coefficient = HINT_COEFFICIENTS[exerciseId]
  if (!coefficient) return undefined
  const bodyWeightKg = profile.startingWeightKg ?? 70
  const level = profile.fitnessLevel === 'new' ? 0.6 : profile.fitnessLevel === 'experienced' ? 1.3 : 1.0
  const age = profile.age !== undefined && (profile.age >= 55 || profile.age < 18) ? 0.85 : 1.0
  const step = coefficient >= 0.5 ? 2.5 : 1
  return Math.max(step, Math.round((bodyWeightKg * coefficient * level * age) / step) * step)
}
