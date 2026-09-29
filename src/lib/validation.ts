import type { WeightUnit } from '../db/types'

export interface NumericRange {
  min: number
  max: number
}

// Ranges are deliberately generous (they should never block a real person),
// just tight enough to catch typos and impossible values — e.g. a height of
// 300 cm, or a bodyweight of 3 kg.
export const AGE_RANGE: NumericRange = { min: 13, max: 100 }
export const HEIGHT_CM_RANGE: NumericRange = { min: 100, max: 230 }
export const BODY_WEIGHT_KG_RANGE: NumericRange = { min: 30, max: 300 }
export const WORKOUT_LOAD_KG_RANGE: NumericRange = { min: 0, max: 500 }
export const REPS_RANGE: NumericRange = { min: 1, max: 100 }

export function bodyWeightRangeForUnit(unit: WeightUnit): NumericRange {
  if (unit === 'lb') {
    return {
      min: Math.round(BODY_WEIGHT_KG_RANGE.min * 2.20462),
      max: Math.round(BODY_WEIGHT_KG_RANGE.max * 2.20462),
    }
  }
  return BODY_WEIGHT_KG_RANGE
}

export function isInRange(value: number, range: NumericRange): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max
}

/**
 * Returns an error message if the value (when present) falls outside the
 * given range, or null if the field is empty (fields using this are
 * optional-but-bounded) or within range.
 */
export function rangeErrorMessage(
  rawValue: string,
  range: NumericRange,
  unitLabel: string,
): string | null {
  if (rawValue.trim() === '') return null
  const value = Number(rawValue)
  if (!Number.isFinite(value)) return 'Enter a number.'
  if (value < range.min || value > range.max) {
    return `Enter a value between ${range.min} and ${range.max} ${unitLabel}.`
  }
  return null
}
