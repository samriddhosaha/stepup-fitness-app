import { db } from '../db/schema'
import { allExercises, setCustomExercises } from '../db/exerciseLibrary'
import { removeEverywhere } from './planEdit'
import type { Equipment, Exercise, ImplementKind, MovementPattern, TrackingType } from '../db/types'

export interface CustomExerciseInput {
  name: string
  movementPattern: MovementPattern
  equipment: Equipment[]
  trackingType: TrackingType
}

export const CUSTOM_PATTERNS: { value: MovementPattern; label: string }[] = [
  { value: 'squat', label: 'Squat / lunge' },
  { value: 'hinge', label: 'Hinge / glutes' },
  { value: 'press', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'core', label: 'Core' },
  { value: 'carry', label: 'Carry' },
  { value: 'isolation', label: 'Single-muscle accessory' },
  { value: 'conditioning', label: 'Cardio' },
  { value: 'mobility', label: 'Mobility' },
]

export function validateCustomName(name: string): string | null {
  const clean = name.trim()
  if (clean.length < 2) return 'Give it a name of at least two characters.'
  if (clean.length > 60) return 'Keep the name under 60 characters.'
  const taken = allExercises().some((e) => e.name.toLowerCase() === clean.toLowerCase())
  return taken ? 'You already have an exercise with that name.' : null
}

const kitFor = (equipment: Equipment[]): ImplementKind =>
  equipment.every((e) => e === 'none') ? 'bodyweight' : equipment.every((e) => e === 'none' || e === 'bands') ? 'band' : equipment.includes('dumbbells') ? 'dumbbell' : equipment.includes('bench-rack') ? 'barbell' : 'machine'

export function buildCustomExercise(input: CustomExerciseInput, now = Date.now()): Exercise {
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'exercise'
  return {
    id: `custom-${slug}-${now.toString(36)}`,
    name: input.name.trim(),
    movementPattern: input.movementPattern,
    primaryMuscles: [],
    equipmentRequired: input.equipment.length ? input.equipment : ['none'],
    substitutionGroupId: `custom-${input.movementPattern}`,
    formCues: ['This one is yours; add a note to a set to remember a cue.', 'Move with control.', 'Stop if anything hurts.'],
    trackingType: input.trackingType,
    skill: 2,
    beginnerFriendly: false,
    contraindications: [],
    unilateral: false,
    kit: kitFor(input.equipment),
    plane: input.movementPattern === 'press' || input.movementPattern === 'pull' ? 'horizontal' : undefined,
  }
}

export async function loadCustomExercises(): Promise<void> {
  setCustomExercises(await db.customExercises.toArray())
}

export async function createCustomExercise(input: CustomExerciseInput): Promise<Exercise> {
  const error = validateCustomName(input.name)
  if (error) throw new Error(error)
  const exercise = buildCustomExercise(input)
  await db.customExercises.add(exercise)
  await loadCustomExercises()
  return exercise
}

/** Removes a custom exercise and takes it out of the plan (history keeps showing its id). */
export async function deleteCustomExercise(id: string): Promise<void> {
  await db.transaction('rw', db.customExercises, db.plans, async () => {
    await db.customExercises.delete(id)
    const plan = await db.plans.orderBy('createdAt').last()
    if (plan) await db.plans.put(removeEverywhere(plan, id))
  })
  await loadCustomExercises()
}
