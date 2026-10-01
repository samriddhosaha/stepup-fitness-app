import type {
  ExerciseState,
  LoggedSet,
  PlanExercise,
  TrackingType,
  WarmupRampSet,
  WeightUnit,
} from '../db/types'
import { getExerciseById } from '../db/exerciseLibrary'
import { fineStep, formatWeight, kgToUnit, roundToUnitGrid, unitToKg } from './units'

export type OverloadAction = 'increase' | 'decrease' | 'hold'

export type Measure = 'reps' | 'seconds' | 'minutes'

export interface OverloadSuggestion {
  action: OverloadAction
  suggestedWeightKg?: number
  /** Next target in `measure` units (reps, seconds or minutes). */
  suggestedReps?: number
  measure?: Measure
  /** True when there is no history and no load to start from: the lifter should calibrate. */
  needsCalibration?: boolean
  message: string
}

export const measureFor = (tracking: TrackingType | undefined): Measure =>
  tracking === 'duration' ? 'seconds' : tracking === 'distance-time' ? 'minutes' : 'reps'

/** What one logged set contributed, in the exercise's own measure. */
function measureOfSet(s: LoggedSet, tracking: TrackingType | undefined): number {
  if (tracking === 'distance-time') return Math.round(((s.durationSeconds ?? 0) / 60) * 10) / 10
  if (tracking === 'duration') return s.durationSeconds ?? s.reps ?? 0
  return s.reps ?? s.durationSeconds ?? 0
}

export type TargetReps = Pick<PlanExercise, 'targetSets' | 'targetRepsLow' | 'targetRepsHigh'>

const HIGH_EFFORT_RPE = 4
const LOW_EFFORT_RPE = 2.5
const DELOAD_AFTER_FAILS = 2
const DELOAD_FACTOR = 0.9

function average(nums: number[]): number | undefined {
  const valid = nums.filter((n) => Number.isFinite(n))
  if (valid.length === 0) return undefined
  return valid.reduce((sum, n) => sum + n, 0) / valid.length
}

function isWorkingSet(s: LoggedSet): boolean {
  return (s.reps ?? 0) > 0 || (s.durationSeconds ?? 0) > 0
}

/**
 * Updates the per-exercise state after a session. Progression reads this, never the plan,
 * so what the user actually lifted is what drives the next suggestion.
 * A "fail" is a session with any set under the rep range at high effort.
 */
export function nextExerciseState(
  prev: ExerciseState | undefined,
  exerciseId: string,
  planned: TargetReps | undefined,
  sets: LoggedSet[],
  date: string,
  now = Date.now(),
  tracking?: TrackingType,
): ExerciseState | undefined {
  const working = sets.filter(isWorkingSet)
  if (working.length === 0) return prev

  const weights = working.map((s) => s.weightKg ?? 0).filter((w) => w > 0)
  const lastReps = working.map((s) => measureOfSet(s, tracking))
  const lastRpe = average(working.map((s) => s.rpe ?? NaN))

  const belowLow = planned !== undefined && lastReps.some((r) => r < planned.targetRepsLow)
  const failed = belowLow && lastRpe !== undefined && lastRpe >= HIGH_EFFORT_RPE

  return {
    exerciseId,
    workingWeightKg: weights.length ? Math.max(...weights) : undefined,
    lastReps,
    lastRpe: lastRpe === undefined ? undefined : Math.round(lastRpe * 10) / 10,
    lastDate: date,
    consecutiveFails: failed ? (prev?.consecutiveFails ?? 0) + 1 : 0,
    updatedAt: now,
  }
}

/** Loading jump in the display unit. Lower-body and barbell work jumps in plates; dumbbells in racks. */
function incrementFor(exerciseId: string, baseInUnit: number, unit: WeightUnit): number {
  const ex = getExerciseById(exerciseId)
  const barbellKit = ex?.equipmentRequired.some((e) => e === 'bench-rack' || e === 'full-gym') ?? false
  const dumbbellKit = ex?.equipmentRequired.includes('dumbbells') ?? false
  const heavy = ex?.movementPattern === 'squat' || ex?.movementPattern === 'hinge' || (barbellKit && !dumbbellKit)
  if (heavy) return unit === 'lb' ? 5 : 2.5
  if (unit === 'lb') return baseInUnit < 30 ? 2.5 : 5
  return baseInUnit < 10 ? 1 : 2
}

/** Size of one +/- tap on the weight field, in the display unit. */
export function loadStepFor(exerciseId: string, weightKg: number | undefined, unit: WeightUnit): number {
  const inUnit = weightKg ? kgToUnit(weightKg, unit) : 0
  return incrementFor(exerciseId, inUnit, unit)
}

function stateFromHistory(
  planned: TargetReps,
  exerciseId: string,
  history: LoggedSet[][],
  tracking?: TrackingType,
): ExerciseState | undefined {
  const last = history[0]
  if (!last) return undefined
  return nextExerciseState(undefined, exerciseId, planned, last, '', 0, tracking)
}

/**
 * Double progression, per set: when every working set reaches the top of the rep range
 * at manageable effort, add load. Two failed sessions in a row deload ~10%. Anything else holds.
 * Load comes from the last weight actually used (exerciseState), not the plan's estimate.
 */
export function suggestNextLoad(
  planned: PlanExercise,
  history: LoggedSet[][],
  state: ExerciseState | undefined,
  opts: { unit: WeightUnit; tracking?: TrackingType },
): OverloadSuggestion {
  const { unit, tracking } = opts
  const measure = measureFor(tracking)
  const s = state ?? stateFromHistory(planned, planned.exerciseId, history, tracking)
  const base = s?.workingWeightKg ?? planned.startingLoadKg
  const lastReps = s?.lastReps ?? []
  const avgRpe = s?.lastRpe

  const hadData = lastReps.length > 0
  const allHitTop =
    hadData && lastReps.length >= planned.targetSets && lastReps.every((r) => r >= planned.targetRepsHigh)
  const highEffort = avgRpe !== undefined && avgRpe >= HIGH_EFFORT_RPE
  const lowEffort = avgRpe !== undefined && avgRpe <= LOW_EFFORT_RPE
  const fails = s?.consecutiveFails ?? 0

  // First time with a loaded lift: don't guess a weight, ask them to find one.
  if (tracking === 'weight-reps' && !hadData && (base === undefined || base <= 0)) {
    return {
      action: 'hold',
      needsCalibration: true,
      measure,
      message: 'First time with this one. Pick a weight you could lift about 10 times with good form.',
    }
  }

  // Bodyweight / no-load movements progress through reps, seconds or minutes.
  if (base === undefined || base <= 0) {
    if (allHitTop && !highEffort) {
      const bump = measure === 'seconds' ? 5 : measure === 'minutes' ? Math.max(1, Math.round(planned.targetRepsHigh * 0.1)) : 2
      const target = planned.targetRepsHigh + bump
      return {
        action: 'increase',
        suggestedReps: target,
        measure,
        message: `You reached ${planned.targetRepsHigh} ${measure} on every set. Aim for ${target}.`,
      }
    }
    if (fails >= DELOAD_AFTER_FAILS) {
      return {
        action: 'decrease',
        suggestedReps: planned.targetRepsLow,
        measure,
        message: `Those sets have been a grind. Ease back to the lower end (${planned.targetRepsLow} ${measure}) and build again.`,
      }
    }
    return { action: 'hold', measure, message: 'Steady effort. Repeat the same target next time.' }
  }

  const baseInUnit = Math.round(kgToUnit(base, unit) / fineStep(unit)) * fineStep(unit)

  if (allHitTop && !highEffort) {
    const inc = incrementFor(planned.exerciseId, baseInUnit, unit)
    const next = unitToKg(baseInUnit + inc, unit)
    return {
      action: 'increase',
      suggestedWeightKg: next,
      message: `Every set reached ${planned.targetRepsHigh} ${measure}${
        lowEffort ? ' at an easy effort' : ''
      }, so add ${inc} ${unit}.`,
    }
  }

  if (hadData && fails >= DELOAD_AFTER_FAILS) {
    let down = roundToUnitGrid(base * DELOAD_FACTOR, unit, fineStep(unit))
    if (down >= base) down = unitToKg(baseInUnit - fineStep(unit), unit)
    return {
      action: 'decrease',
      suggestedWeightKg: Math.max(down, 0),
      message: 'That load has been a grind for two sessions. Back off about 10% and build again.',
    }
  }

  if (hadData && allHitTop && highEffort) {
    return {
      action: 'hold',
      suggestedWeightKg: unitToKg(baseInUnit, unit),
      message: 'You hit the range, but it cost you. Repeat this load before adding more.',
    }
  }

  if (hadData && fails === 1) {
    return {
      action: 'hold',
      suggestedWeightKg: unitToKg(baseInUnit, unit),
      message: 'That one was heavy. Try the same load again before changing anything.',
    }
  }

  return {
    action: 'hold',
    suggestedWeightKg: unitToKg(baseInUnit, unit),
    message: hadData
      ? 'Steady work. Repeat the same load and add reps where you can.'
      : `Start at ${formatWeight(base, unit)} and adjust to how it feels.`,
  }
}

export interface WarmupSet {
  weightKg: number
  reps: number
}

/** Ramp from today's working weight, in unit-native plate steps. Empty when there's no load. */
export function warmupSets(
  ramp: WarmupRampSet[] | undefined,
  workingKg: number | undefined,
  unit: WeightUnit,
): WarmupSet[] {
  if (!ramp || !workingKg || workingKg <= 0) return []
  const step = unit === 'lb' ? 5 : 2.5
  const out: WarmupSet[] = []
  for (const r of ramp) {
    const weightKg = roundToUnitGrid(workingKg * r.percentOfWorking, unit, step)
    if (weightKg <= 0 || weightKg >= workingKg) continue
    if (out.length && out[out.length - 1]!.weightKg === weightKg) continue
    out.push({ weightKg, reps: r.reps })
  }
  return out
}
