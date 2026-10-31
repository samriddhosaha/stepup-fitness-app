import type { WeightUnit } from '../db/types'

/** Common plate sets per unit, heaviest first. Numbers are in the unit itself. */
export const DEFAULT_PLATES: Record<WeightUnit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
}

export const DEFAULT_BAR: Record<WeightUnit, number> = { kg: 20, lb: 45 }
export const BAR_OPTIONS: Record<WeightUnit, number[]> = { kg: [15, 20], lb: [35, 45] }

export interface PlateLoad {
  bar: number
  /** Plates for ONE side of the bar, heaviest first. */
  perSide: number[]
  /** Weight actually on the bar with those plates. */
  achieved: number
  /** Target minus achieved (>= 0): how much can't be made with these plates. */
  shortBy: number
  /** The target was lighter than the empty bar. */
  belowBar: boolean
}

// Hundredths avoid float drift (1.25 * 3, 62.5 - 20, ...).
const h = (n: number) => Math.round(n * 100)

export function calculatePlates(target: number, bar: number, plates: number[]): PlateLoad {
  if (h(target) <= h(bar)) {
    return { bar, perSide: [], achieved: bar, shortBy: 0, belowBar: h(target) < h(bar) }
  }
  let remaining = Math.floor((h(target) - h(bar)) / 2) // per side, in hundredths
  const perSide: number[] = []
  for (const plate of [...plates].sort((a, b) => b - a)) {
    while (remaining >= h(plate)) {
      perSide.push(plate)
      remaining -= h(plate)
    }
  }
  const achieved = (h(bar) + 2 * perSide.reduce((s, p) => s + h(p), 0)) / 100
  return { bar, perSide, achieved, shortBy: (h(target) - h(achieved)) / 100, belowBar: false }
}

/** "20 + 10 + 1.25" or "just the bar". */
export function describePlates(perSide: number[]): string {
  return perSide.length === 0 ? 'just the bar' : perSide.join(' + ')
}
