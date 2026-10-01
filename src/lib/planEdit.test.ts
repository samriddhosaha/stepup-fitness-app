import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { generatePlan } from './plan'
import {
  addOptions,
  addToPlan,
  avoidExercise,
  moveInPlan,
  removeEverywhere,
  removeFromPlan,
  renameSession,
  replaceEverywhere,
  setPrescription,
  swapInPlan,
  swapOptions,
  unavoidExercise,
} from './planEdit'
import { buildCustomExercise, createCustomExercise, deleteCustomExercise, validateCustomName } from './customExercises'
import { getExerciseById, getSubstitutes, isBuiltInExercise, setCustomExercises } from '../db/exerciseLibrary'
import { recordSessionPRs } from './records'
import type { Plan, Profile } from '../db/types'

const profile: Profile = {
  id: 1,
  name: 'T',
  fitnessLevel: 'regular',
  liftsAlready: true,
  doesCardioAlready: false,
  primaryGoal: 'build-muscle',
  daysPerWeek: 3,
  sessionLengthMinutes: 45,
  equipment: ['dumbbells', 'bands', 'none'],
  trainingPreferences: [],
  weightUnit: 'kg',
  appearance: 'system',
  onboardingCompleted: true,
  createdAt: 1,
}
const ids = (p: Plan, s = 0) => p.sessions[s]!.exercises.map((e) => e.exerciseId)

describe('editing a plan (pure)', () => {
  const plan = generatePlan(profile)

  it('swaps an exercise for one from the same group, re-prescribing it', () => {
    const first = plan.sessions[0]!.exercises[0]!
    const options = swapOptions(first.exerciseId, profile, ids(plan))
    expect(options.length).toBeGreaterThan(0)
    const next = swapInPlan(plan, 0, 0, options[0]!.id, profile)
    expect(ids(next)[0]).toBe(options[0]!.id)
    expect(next.sessions[0]!.exercises[0]!.targetSets).toBeGreaterThan(0)
    expect(plan.sessions[0]!.exercises[0]!.exerciseId).toBe(first.exerciseId) // original untouched
  })

  it('swap options respect injuries and avoided exercises', () => {
    const squatId = 'goblet-squat'
    const withKnee = swapOptions(squatId, { ...profile, injuryAreas: ['knee'] })
    expect(withKnee).toEqual([])
    const noBw = swapOptions(squatId, { ...profile, avoidedExerciseIds: ['bodyweight-squat'] })
    expect(noBw.map((e) => e.id)).not.toContain('bodyweight-squat')
  })

  it('reorders, removes (never emptying a session) and adds', () => {
    const moved = moveInPlan(plan, 0, 0, 2)
    expect(ids(moved)[2]).toBe(ids(plan)[0])
    expect(moveInPlan(plan, 0, 0, 99)).toBe(plan)

    const removed = removeFromPlan(plan, 0, 1)
    expect(ids(removed)).toHaveLength(ids(plan).length - 1)
    let tiny = plan
    while (ids(tiny).length > 1) tiny = removeFromPlan(tiny, 0, 0)
    expect(removeFromPlan(tiny, 0, 0)).toBe(tiny)

    const candidate = addOptions(plan.sessions[0]!, profile).find((e) => e.movementPattern === 'isolation')!
    const added = addToPlan(plan, 0, candidate.id, profile)
    expect(ids(added)).toContain(candidate.id)
    expect(addToPlan(added, 0, candidate.id, profile)).toBe(added) // no duplicates
  })

  it('edits sets and reps within sensible bounds, and renames', () => {
    const edited = setPrescription(plan, 0, 0, { targetSets: 5, targetRepsLow: 5, targetRepsHigh: 8 })
    expect(edited.sessions[0]!.exercises[0]).toMatchObject({ targetSets: 5, targetRepsLow: 5, targetRepsHigh: 8 })
    expect(setPrescription(plan, 0, 0, { targetSets: 0 })).toBe(plan)
    expect(setPrescription(plan, 0, 0, { targetRepsLow: 12, targetRepsHigh: 8 })).toBe(plan)
    expect(renameSession(plan, 0, '  Monday heavy  ').sessions[0]!.name).toBe('Monday heavy')
    expect(renameSession(plan, 0, '   ')).toBe(plan)
  })

  it('replaces or removes an exercise everywhere', () => {
    const first = plan.sessions[0]!.exercises[0]!.exerciseId
    const replacement = swapOptions(first, profile)[0]!.id
    const replaced = replaceEverywhere(plan, first, replacement, profile)
    expect(replaced.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId))).not.toContain(first)
    const removed = removeEverywhere(plan, first)
    expect(removed.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId))).not.toContain(first)
    expect(removed.sessions.every((s) => s.exercises.length > 0)).toBe(true)
  })
})

describe('avoiding exercises (pain feedback loop)', () => {
  beforeEach(async () => {
    await Promise.all([db.profile.clear(), db.plans.clear()])
    await db.profile.add({ ...profile, id: undefined })
    await db.plans.add(generatePlan(profile))
  })

  it('stops suggesting an exercise and swaps it out of the current plan', async () => {
    const plan = (await db.plans.toArray())[0]!
    const target = plan.sessions[0]!.exercises[0]!.exerciseId
    const replacement = swapOptions(target, profile)[0]!.id
    await avoidExercise(target, { replaceWith: replacement })

    expect((await db.profile.toArray())[0]!.avoidedExerciseIds).toEqual([target])
    const after = (await db.plans.toArray())[0]!
    expect(after.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId))).not.toContain(target)
    // and a regenerated plan keeps it out too
    const regenerated = generatePlan({ ...profile, avoidedExerciseIds: [target] })
    expect(regenerated.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId))).not.toContain(target)
    // swap lists elsewhere also leave it out
    expect(swapOptions(replacement, { ...profile, avoidedExerciseIds: [target] }).map((e) => e.id)).not.toContain(target)
  })

  it('can simply remove it from the plan, and can be undone', async () => {
    const plan = (await db.plans.toArray())[0]!
    const target = plan.sessions[0]!.exercises[0]!.exerciseId
    await avoidExercise(target, { removeFromPlan: true })
    const after = (await db.plans.toArray())[0]!
    expect(after.sessions[0]!.exercises.map((e) => e.exerciseId)).not.toContain(target)
    await unavoidExercise(target)
    expect((await db.profile.toArray())[0]!.avoidedExerciseIds).toEqual([])
  })
})

describe('custom exercises', () => {
  beforeEach(async () => {
    await db.customExercises.clear()
    setCustomExercises([])
  })

  it('validates names against the library and each other', async () => {
    expect(validateCustomName('')).toMatch(/at least two/)
    expect(validateCustomName('Back Squat')).toMatch(/already/)
    await createCustomExercise({ name: 'Sled Push', movementPattern: 'conditioning', equipment: ['none'], trackingType: 'duration' })
    expect(validateCustomName('sled push')).toMatch(/already/)
  })

  it('is usable everywhere an exercise is, but never leaves the device in the AI payload', async () => {
    const ex = await createCustomExercise({ name: 'Zercher Squat', movementPattern: 'squat', equipment: ['bench-rack'], trackingType: 'weight-reps' })
    expect(getExerciseById(ex.id)?.name).toBe('Zercher Squat')
    expect(isBuiltInExercise(ex.id)).toBe(false)
    expect(isBuiltInExercise('back-squat')).toBe(true)
    expect(await db.customExercises.count()).toBe(1)
  })

  it('only swaps with exercises of the same custom group', async () => {
    const a = await createCustomExercise({ name: 'Cable Crunch', movementPattern: 'core', equipment: ['full-gym'], trackingType: 'weight-reps' })
    const b = await createCustomExercise({ name: 'Ab Rollout', movementPattern: 'core', equipment: ['none'], trackingType: 'bodyweight-reps' })
    expect(getSubstitutes(a, ['full-gym']).map((e) => e.id)).toEqual([b.id])
  })

  it('deleting one removes it from the plan', async () => {
    const ex = await createCustomExercise({ name: 'Sandbag Carry', movementPattern: 'carry', equipment: ['none'], trackingType: 'duration' })
    await db.plans.clear()
    const plan = generatePlan(profile)
    plan.sessions[0]!.exercises.push({ exerciseId: ex.id, targetSets: 3, targetRepsLow: 30, targetRepsHigh: 60 })
    await db.plans.add(plan)
    await deleteCustomExercise(ex.id)
    expect(getExerciseById(ex.id)).toBeUndefined()
    expect((await db.plans.toArray())[0]!.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId))).not.toContain(ex.id)
  })

  it('buildCustomExercise produces a complete, valid exercise', () => {
    const ex = buildCustomExercise({ name: '  Farmer Walk  ', movementPattern: 'carry', equipment: [], trackingType: 'duration' }, 1)
    expect(ex).toMatchObject({ name: 'Farmer Walk', equipmentRequired: ['none'], kit: 'bodyweight', beginnerFriendly: false })
    expect(ex.formCues).toHaveLength(3)
    expect(ex.id).toMatch(/^custom-farmer-walk-/)
  })
})

describe('timed-hold personal records', () => {
  it('ranks the longest hold, and cardio sessions with a distance are not ranked', async () => {
    await db.personalRecords.clear()
    await recordSessionPRs(1, [{ exerciseId: 'plank', sets: [{ setIndex: 0, durationSeconds: 40 }, { setIndex: 1, durationSeconds: 55 }] }], 1)
    expect(await db.personalRecords.toArray()).toMatchObject([{ exerciseId: 'plank', kind: 'time', value: 55, baseline: true }])
    const prs = await recordSessionPRs(2, [{ exerciseId: 'plank', sets: [{ setIndex: 0, durationSeconds: 70 }] }], 2)
    expect(prs).toHaveLength(1)
    const none = await recordSessionPRs(3, [{ exerciseId: 'easy-jog', sets: [{ setIndex: 0, durationSeconds: 1800, distanceM: 4000 }] }], 3)
    expect(none).toEqual([])
    expect((await db.personalRecords.where('exerciseId').equals('easy-jog').count())).toBe(0)
  })
})
