import type { WeightUnit } from '../db/types'
import type { NumericRange } from './validation'
import { WORKOUT_LOAD_KG_RANGE } from './validation'

// Weights are stored in kg everywhere; these helpers convert only at the UI edge.
export const KG_PER_LB = 0.45359237

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg / KG_PER_LB : kg
}

export function unitToKg(value: number, unit: WeightUnit): number {
  const kg = unit === 'lb' ? value * KG_PER_LB : value
  return Math.round(kg * 100) / 100
}

/** "92.5 lb" / "40 kg". Rounded to one decimal, trailing zero dropped. */
export function formatWeight(kg: number, unit: WeightUnit, withUnit = true): string {
  const v = Math.round(kgToUnit(kg, unit) * 10) / 10
  return withUnit ? `${v} ${unit}` : String(v)
}

/** Parses user input in the given unit to kg, or null when empty/not a number. */
export function parseWeight(input: string, unit: WeightUnit): number | null {
  if (input.trim() === '') return null
  const n = Number(input)
  return Number.isFinite(n) ? unitToKg(n, unit) : null
}

/** Rounds a kg value to a multiple of `step` expressed in the display unit; returns kg. */
export function roundToUnitGrid(kg: number, unit: WeightUnit, step: number): number {
  const inUnit = Math.round(kgToUnit(kg, unit) / step) * step
  return unitToKg(inUnit, unit)
}

/** Smallest sensible loading jump in the unit (plates / dumbbell racks). */
export function fineStep(unit: WeightUnit): number {
  return unit === 'lb' ? 2.5 : 0.5
}

export function workoutLoadRangeForUnit(unit: WeightUnit): NumericRange {
  return unit === 'lb'
    ? { min: 0, max: Math.round(WORKOUT_LOAD_KG_RANGE.max / KG_PER_LB) }
    : WORKOUT_LOAD_KG_RANGE
}
