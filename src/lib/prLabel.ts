import type { PersonalRecord, WeightUnit } from '../db/types'
import { formatWeight } from './units'

/** "12 reps", "40 s hold", "92.5 kg lifted" or "100 kg est." for a personal record. */
export function prLabel(pr: Pick<PersonalRecord, 'kind' | 'value'>, unit: WeightUnit): string {
  if (pr.kind === 'reps') return `${pr.value} reps`
  if (pr.kind === 'time') return `${pr.value} s hold`
  if (pr.kind === 'weight') return `${formatWeight(pr.value, unit)} lifted`
  return `${formatWeight(pr.value, unit)} est.`
}
