import type { LoggedSet, PlanExercise } from '../db/types'

export type OverloadAction = 'increase' | 'decrease' | 'hold'

export interface OverloadSuggestion {
  action: OverloadAction
  suggestedWeightKg?: number
  message: string
}

function average(nums: number[]): number | undefined {
  const valid = nums.filter((n): n is number => typeof n === 'number' && !Number.isNaN(n))
  if (valid.length === 0) return undefined
  return valid.reduce((sum, n) => sum + n, 0) / valid.length
}

/**
 * Decides the next suggested load/reps after a set of logged sets for one
 * exercise, using both the rep outcome (met/missed the target range) and
 * the new RPE input — high effort + missed range means back off, low
 * effort + cleared range means push further, matching the app's
 * encouraging-but-honest voice throughout.
 */
export function suggestNextLoad(
  planned: PlanExercise,
  loggedSets: LoggedSet[],
): OverloadSuggestion {
  const lastWeight = planned.startingLoadKg
  const avgReps = average(loggedSets.map((s) => s.reps ?? NaN))
  const avgRpe = average(loggedSets.map((s) => s.rpe ?? NaN))

  const metRange = avgReps !== undefined && avgReps >= planned.targetRepsHigh
  const missedRange = avgReps !== undefined && avgReps < planned.targetRepsLow
  const lowEffort = avgRpe !== undefined && avgRpe <= 2.5
  const highEffort = avgRpe !== undefined && avgRpe >= 4

  if (lastWeight === undefined) {
    // Bodyweight/no-load movements: progress via reps instead.
    if (metRange && !highEffort) {
      return {
        action: 'increase',
        message: 'You cleared the range. Aim for a few more reps next time.',
      }
    }
    if (missedRange && highEffort) {
      return {
        action: 'decrease',
        message: 'That set was a grind. Ease off the rep target slightly and build back up.',
      }
    }
    return { action: 'hold', message: 'Steady effort. Repeat the same target next time.' }
  }

  if (missedRange && highEffort) {
    const suggestedWeightKg = roundLoad(lastWeight * 0.9)
    return {
      action: 'decrease',
      suggestedWeightKg,
      message: 'That load has been a grind. Back off slightly and build again.',
    }
  }

  if (metRange && !highEffort) {
    const step = lastWeight >= 20 ? 2.5 : 1
    const suggestedWeightKg = roundLoad(lastWeight + step)
    return {
      action: 'increase',
      suggestedWeightKg,
      message: 'You cleared the range. Aim higher this time.',
    }
  }

  if (metRange && highEffort) {
    return {
      action: 'hold',
      suggestedWeightKg: lastWeight,
      message: 'You hit the range, but it cost you. Repeat this load before adding more.',
    }
  }

  if (missedRange && lowEffort) {
    return {
      action: 'hold',
      suggestedWeightKg: lastWeight,
      message: "Short of the range, but there's room. Try the same load again.",
    }
  }

  return {
    action: 'hold',
    suggestedWeightKg: lastWeight,
    message: 'Steady work. Repeat the same load next time.',
  }
}

function roundLoad(kg: number): number {
  return Math.max(1, Math.round(kg / 0.5) * 0.5)
}
