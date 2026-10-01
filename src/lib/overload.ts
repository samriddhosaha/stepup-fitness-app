import type {
  ExerciseState,
  LoggedSet,
  PlanExercise,
  WarmupRampSet,
  WeightUnit,
} from '../db/types'
import { getExerciseById } from '../db/exerciseLibrary'
import { fineStep, formatWeight, kgToUnit, roundToUnitGrid, unitToKg } from './units'

export type OverloadAction = 'increase' | 'decrease' | 'hold'

export interface OverloadSuggestion {
  action: OverloadAction
  suggestedWeightKg?: number
  suggestedReps?: number
  message: string
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
): ExerciseState | undefined {
  const working = sets.filter(isWorkingSet)
  if (working.length === 0) return prev

  const weights = working.map((s) => s.weightKg ?? 0).filter((w) => w > 0)
  const lastReps = working.map((s) => s.reps ?? s.durationSeconds ?? 0)
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
): ExerciseState | undefined {
  const last = history[0]
  if (!last) return undefined
  return nextExerciseState(undefined, exerciseId, planned, last, '', 0)
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
  opts: { unit: WeightUnit },
): OverloadSuggestion {
  const { unit } = opts
  const s = state ?? stateFromHistory(planned, planned.exerciseId, history)
  const base = s?.workingWeightKg ?? planned.startingLoadKg
  const lastReps = s?.lastReps ?? []
  const avgRpe = s?.lastRpe

  const hadData = lastReps.length > 0
  const allHitTop =
    hadData && lastReps.length >= planned.targetSets && lastReps.every((r) => r >= planned.targetRepsHigh)
  const highEffort = avgRpe !== undefined && avgRpe >= HIGH_EFFORT_RPE
  const lowEffort = avgRpe !== undefined && avgRpe <= LOW_EFFORT_RPE
  const fails = s?.consecutiveFails ?? 0

  // Bodyweight / no-load movements progress through reps.
  if (base === undefined || base <= 0) {
    if (allHitTop && !highEffort) {
      const target = planned.targetRepsHigh + 2
      return {
        action: 'increase',
        suggestedReps: target,
        message: `You cleared ${planned.targetRepsHigh} reps on every set. Aim for ${target}.`,
      }
    }
    if (fails >= DELOAD_AFTER_FAILS) {
      return {
        action: 'decrease',
        suggestedReps: planned.targetRepsLow,
        message: 'Those sets have been a grind. Ease back to the lower end of the range and build again.',
      }
    }
    return { action: 'hold', message: 'Steady effort. Repeat the same target next time.' }
  }

  const baseInUnit = Math.round(kgToUnit(base, unit) / fineStep(unit)) * fineStep(unit)

  if (allHitTop && !highEffort) {
    const inc = incrementFor(planned.exerciseId, baseInUnit, unit)
    const next = unitToKg(baseInUnit + inc, unit)
    return {
      action: 'increase',
      suggestedWeightKg: next,
      message: `Every set reached ${planned.targetRepsHigh} reps${
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
