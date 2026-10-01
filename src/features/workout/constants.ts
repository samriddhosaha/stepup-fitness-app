import { formatWeight } from '../../lib/units'
import type { LoggedSet, SkipReason, WeightUnit } from '../../db/types'

export const RPE_LABELS = ['Easy', 'Solid', 'Hard', 'Very hard', 'Max'] as const

export const SKIP_REASONS: { value: SkipReason; label: string }[] = [
  { value: 'too-difficult', label: 'Too difficult today' },
  { value: 'equipment-not-free', label: 'Equipment not free' },
  { value: 'discomfort-or-pain', label: 'Discomfort or pain' },
  { value: 'running-out-of-time', label: 'Running out of time' },
  { value: 'another-reason', label: 'Another reason' },
]

export type WorkoutPanel = null | 'swap' | 'skip' | 'leave' | 'finish' | 'empty'

export interface SetFormValues {
  weight: string
  reps: string
  rpe: number | null
  note: string
}

/** "16 kg × 8, 8, 7" — collapses repeated weights so a last-time line stays short. */
export function summariseSets(sets: LoggedSet[], unit: WeightUnit): string {
  const groups: { weightKg?: number; reps: number[] }[] = []
  for (const s of sets) {
    const last = groups[groups.length - 1]
    if (last && last.weightKg === s.weightKg) last.reps.push(s.reps ?? s.durationSeconds ?? 0)
    else groups.push({ weightKg: s.weightKg, reps: [s.reps ?? s.durationSeconds ?? 0] })
  }
  return groups
    .map((g) => `${g.weightKg ? `${formatWeight(g.weightKg, unit)} × ` : ''}${g.reps.join(', ')}${g.weightKg ? '' : ' reps'}`)
    .join(' · ')
}
