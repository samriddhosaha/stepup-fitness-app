import { db, getActivePlan, getActiveProfile } from '../db/schema'
import { allExercises, getExerciseById } from '../db/exerciseLibrary'
import { constraintsFor, isPermitted } from './planning/constraints'
import { prescribe, type Role } from './planning/prescribe'
import { planBalance } from './plan'
import type { Exercise, Plan, PlanExercise, PlanSession, Profile } from '../db/types'

// Pure editing helpers return a new plan; the *Active* wrappers write the latest plan row.
// Loads and history live in exerciseState, so editing or rebuilding a plan never loses them.

const clone = (plan: Plan): Plan => ({
  ...plan,
  sessions: plan.sessions.map((s) => ({ ...s, exercises: s.exercises.map((e) => ({ ...e })) })),
})

function withTotals(plan: Plan): Plan {
  for (const s of plan.sessions) {
    let push = 0
    let pull = 0
    for (const pe of s.exercises) {
      const e = getExerciseById(pe.exerciseId)
      if (!e) continue
      if (e.movementPattern === 'press' || e.substitutionGroupId === 'triceps' || e.substitutionGroupId === 'lateral-raise') push += pe.targetSets
      if (e.movementPattern === 'pull' || e.substitutionGroupId === 'rear-delt' || e.substitutionGroupId === 'biceps') pull += pe.targetSets
    }
    s.pushVolumeSets = push
    s.pullVolumeSets = pull
  }
  plan.volumeUneven = planBalance(plan).uneven
  return plan
}

const roleOf = (e: Exercise, current?: PlanExercise): Role =>
  current?.role ?? (e.movementPattern === 'squat' || e.movementPattern === 'hinge' || e.movementPattern === 'press' || e.movementPattern === 'pull' ? 'main' : 'accessory')

function prescription(e: Exercise, role: Role, profile: Profile) {
  return prescribe(e, role, profile.primaryGoal, profile.fitnessLevel, Boolean(profile.gentleStart), profile.sessionLengthMinutes)
}

/** Exercises that may replace `exerciseId`: same movement group, available kit, safe for this person. */
export function swapOptions(exerciseId: string, profile: Profile, alreadyInSession: string[] = []): Exercise[] {
  const current = getExerciseById(exerciseId)
  if (!current) return []
  const c = constraintsFor(profile)
  return allExercises().filter(
    (e) => e.substitutionGroupId === current.substitutionGroupId && e.id !== exerciseId && !alreadyInSession.includes(e.id) && isPermitted(e, c),
  )
}

/** Everything that could be added to a session (not already in it), grouped by the caller. */
export function addOptions(session: PlanSession, profile: Profile): Exercise[] {
  const c = constraintsFor(profile)
  const have = new Set(session.exercises.map((e) => e.exerciseId))
  return allExercises().filter((e) => !have.has(e.id) && isPermitted(e, c))
}

export function swapInPlan(plan: Plan, sessionIndex: number, exerciseIndex: number, newId: string, profile: Profile): Plan {
  const next = clone(plan)
  const target = next.sessions[sessionIndex]?.exercises[exerciseIndex]
  const e = getExerciseById(newId)
  if (!target || !e) return plan
  next.sessions[sessionIndex]!.exercises[exerciseIndex] = {
    ...prescription(e, roleOf(e, target), profile),
    exerciseId: newId,
    block: target.block ?? 'main',
    role: target.role,
  }
  return withTotals(next)
}

export function moveInPlan(plan: Plan, sessionIndex: number, from: number, to: number): Plan {
  const next = clone(plan)
  const list = next.sessions[sessionIndex]?.exercises
  if (!list || from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return plan
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved!)
  return next
}

export function removeFromPlan(plan: Plan, sessionIndex: number, exerciseIndex: number): Plan {
  const next = clone(plan)
  const list = next.sessions[sessionIndex]?.exercises
  // a session needs at least one exercise: use "Delete session" semantics elsewhere if ever needed
  if (!list || list.length <= 1 || !list[exerciseIndex]) return plan
  list.splice(exerciseIndex, 1)
  return withTotals(next)
}

export function addToPlan(plan: Plan, sessionIndex: number, exerciseId: string, profile: Profile): Plan {
  const next = clone(plan)
  const session = next.sessions[sessionIndex]
  const e = getExerciseById(exerciseId)
  if (!session || !e || session.exercises.some((x) => x.exerciseId === exerciseId)) return plan
  const role = roleOf(e)
  const entry: PlanExercise = { ...prescription(e, role, profile), exerciseId, block: e.movementPattern === 'mobility' ? 'cool-down' : 'main', role }
  const lastMain = session.exercises.map((x) => x.block ?? 'main').lastIndexOf('main')
  session.exercises.splice(entry.block === 'cool-down' ? session.exercises.length : lastMain + 1, 0, entry)
  return withTotals(next)
}

export interface PrescriptionPatch {
  targetSets?: number
  targetRepsLow?: number
  targetRepsHigh?: number
}

export function setPrescription(plan: Plan, sessionIndex: number, exerciseIndex: number, patch: PrescriptionPatch): Plan {
  const next = clone(plan)
  const target = next.sessions[sessionIndex]?.exercises[exerciseIndex]
  if (!target) return plan
  const sets = Math.round(patch.targetSets ?? target.targetSets)
  const low = patch.targetRepsLow ?? target.targetRepsLow
  const high = patch.targetRepsHigh ?? target.targetRepsHigh
  if (!(sets >= 1 && sets <= 10) || !(low >= 1) || !(high >= low) || high > 3600) return plan
  Object.assign(target, { targetSets: sets, targetRepsLow: low, targetRepsHigh: high })
  return withTotals(next)
}

export function renameSession(plan: Plan, sessionIndex: number, name: string): Plan {
  const clean = name.trim().slice(0, 40)
  if (!clean || !plan.sessions[sessionIndex]) return plan
  const next = clone(plan)
  next.sessions[sessionIndex]!.name = clean
  return next
}

/** Swaps one exercise for another everywhere it appears in the plan. */
export function replaceEverywhere(plan: Plan, oldId: string, newId: string, profile: Profile): Plan {
  let next = plan
  plan.sessions.forEach((s, si) =>
    s.exercises.forEach((e, ei) => {
      if (e.exerciseId === oldId) next = swapInPlan(next, si, ei, newId, profile)
    }),
  )
  return next
}

export function removeEverywhere(plan: Plan, exerciseId: string): Plan {
  const next = clone(plan)
  for (const s of next.sessions) {
    const kept = s.exercises.filter((e) => e.exerciseId !== exerciseId)
    if (kept.length > 0) s.exercises = kept // never empty a session
  }
  return withTotals(next)
}

/** Writes an edited plan over the latest plan row. */
export async function saveActivePlan(plan: Plan): Promise<void> {
  if (plan.id === undefined) throw new Error('Plan has not been saved yet')
  await db.plans.put(plan)
}

/** Stop suggesting an exercise: it leaves generated plans, swap lists, and (optionally) the current plan. */
export async function avoidExercise(exerciseId: string, options: { replaceWith?: string; removeFromPlan?: boolean } = {}): Promise<void> {
  await db.transaction('rw', db.profile, db.plans, async () => {
    const profile = await getActiveProfile()
    if (!profile?.id) return
    const avoided = [...new Set([...(profile.avoidedExerciseIds ?? []), exerciseId])]
    const updated: Profile = { ...profile, avoidedExerciseIds: avoided }
    await db.profile.put(updated)

    const plan = await getActivePlan()
    if (!plan) return
    if (options.replaceWith) await db.plans.put(replaceEverywhere(plan, exerciseId, options.replaceWith, updated))
    else if (options.removeFromPlan) await db.plans.put(removeEverywhere(plan, exerciseId))
  })
}

/** Lets a person see an exercise again. */
export async function unavoidExercise(exerciseId: string): Promise<void> {
  const profile = await getActiveProfile()
  if (!profile?.id) return
  await db.profile.put({ ...profile, avoidedExerciseIds: (profile.avoidedExerciseIds ?? []).filter((id) => id !== exerciseId) })
}
