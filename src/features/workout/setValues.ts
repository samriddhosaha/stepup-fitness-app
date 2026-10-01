import { formatWeight, parseWeight, workoutLoadRangeForUnit } from '../../lib/units'
import { REPS_RANGE, rangeErrorMessage } from '../../lib/validation'
import type { LoggedSet, TrackingType, WeightUnit } from '../../db/types'

/** What the form holds as text while someone is typing. */
export interface SetFormValues {
  weight: string
  reps: string
  /** Seconds, for timed holds and carries. */
  seconds: string
  /** Minutes, for steady-state cardio. */
  minutes: string
  /** Distance in km (kg users) or miles (lb users). */
  distance: string
  rpe: number | null
  note: string
}

export const EMPTY_FORM: SetFormValues = { weight: '', reps: '', seconds: '', minutes: '', distance: '', rpe: null, note: '' }

export const SECONDS_RANGE = { min: 1, max: 6 * 3600 }
export const MINUTES_RANGE = { min: 1, max: 6 * 60 }
export const DISTANCE_RANGE = { min: 0, max: 500 }
const M_PER_KM = 1000
const M_PER_MILE = 1609.344

export const distanceUnitFor = (unit: WeightUnit): 'km' | 'mi' => (unit === 'lb' ? 'mi' : 'km')

export interface FieldErrors {
  weight: string | null
  reps: string | null
  seconds: string | null
  minutes: string | null
  distance: string | null
}

export interface Validation {
  errors: FieldErrors
  /** The entries needed to log this kind of set are present and in range. */
  canSubmit: boolean
  /** Required entry missing (as opposed to wrong): drives the gentle "enter your reps" hint. */
  missing: string | null
}

const num = (s: string) => (s.trim() === '' ? undefined : Number(s))

export function validateValues(v: SetFormValues, tracking: TrackingType, unit: WeightUnit, showWeight: boolean): Validation {
  const errors: FieldErrors = {
    weight: showWeight ? rangeErrorMessage(v.weight, workoutLoadRangeForUnit(unit), unit) : null,
    reps: tracking === 'weight-reps' || tracking === 'bodyweight-reps' ? rangeErrorMessage(v.reps, REPS_RANGE, 'reps') : null,
    seconds: tracking === 'duration' ? rangeErrorMessage(v.seconds, SECONDS_RANGE, 'seconds') : null,
    minutes: tracking === 'distance-time' ? rangeErrorMessage(v.minutes, MINUTES_RANGE, 'minutes') : null,
    distance: tracking === 'distance-time' ? rangeErrorMessage(v.distance, DISTANCE_RANGE, distanceUnitFor(unit)) : null,
  }
  const anyError = Object.values(errors).some(Boolean)
  const missing =
    tracking === 'duration' ? (v.seconds.trim() === '' ? 'time' : null) : tracking === 'distance-time' ? (v.minutes.trim() === '' ? 'minutes' : null) : v.reps.trim() === '' ? 'reps' : null
  return { errors, canSubmit: !anyError && missing === null, missing }
}

/** Form text → a logged set, or null when it isn't valid. */
export function setFromValues(v: SetFormValues, tracking: TrackingType, unit: WeightUnit, setIndex: number, showWeight: boolean): LoggedSet | null {
  if (!validateValues(v, tracking, unit, showWeight).canSubmit) return null
  const base: LoggedSet = { setIndex, rpe: v.rpe ?? undefined, note: v.note.trim() || undefined }
  switch (tracking) {
    case 'weight-reps':
      return { ...base, weightKg: parseWeight(v.weight, unit) ?? undefined, reps: Number(v.reps) }
    case 'bodyweight-reps':
      return { ...base, reps: Number(v.reps) }
    case 'duration':
      return { ...base, weightKg: showWeight ? (parseWeight(v.weight, unit) ?? undefined) : undefined, durationSeconds: Number(v.seconds) }
    case 'distance-time': {
      const d = num(v.distance)
      return {
        ...base,
        durationSeconds: Number(v.minutes) * 60,
        distanceM: d ? Math.round(d * (unit === 'lb' ? M_PER_MILE : M_PER_KM)) : undefined,
      }
    }
  }
}

/** A logged set → form text, for editing. */
export function valuesFromSet(s: LoggedSet, unit: WeightUnit): SetFormValues {
  const miles = unit === 'lb'
  return {
    weight: s.weightKg ? formatWeight(s.weightKg, unit, false) : '',
    reps: s.reps !== undefined ? String(s.reps) : '',
    seconds: s.durationSeconds !== undefined && s.reps === undefined ? String(s.durationSeconds) : '',
    minutes: s.durationSeconds !== undefined ? String(Math.round((s.durationSeconds / 60) * 10) / 10) : '',
    distance: s.distanceM ? String(Math.round((s.distanceM / (miles ? M_PER_MILE : M_PER_KM)) * 100) / 100) : '',
    rpe: s.rpe ?? null,
    note: s.note ?? '',
  }
}

/** One short line describing a set: "20 kg × 8", "45 s", "30 min · 4.5 km". */
export function describeSet(s: LoggedSet, unit: WeightUnit, tracking?: TrackingType): string {
  const w = s.weightKg ? `${formatWeight(s.weightKg, unit)} × ` : ''
  if (tracking === 'distance-time' || (s.distanceM && !s.reps)) {
    const mins = Math.round(((s.durationSeconds ?? 0) / 60) * 10) / 10
    const dist = s.distanceM ? ` · ${Math.round((s.distanceM / (unit === 'lb' ? M_PER_MILE : M_PER_KM)) * 100) / 100} ${distanceUnitFor(unit)}` : ''
    return `${mins} min${dist}`
  }
  if (s.reps === undefined && s.durationSeconds !== undefined) return `${w}${s.durationSeconds} s`
  return `${w}${s.reps ?? 0} reps`
}

/** "16 kg × 8, 8, 7" — collapses repeated weights so a last-time line stays short. */
export function summariseSets(sets: LoggedSet[], unit: WeightUnit, tracking?: TrackingType): string {
  if (tracking === 'distance-time' || tracking === 'duration' && sets.every((s) => !s.weightKg)) {
    return sets.map((s) => describeSet(s, unit, tracking)).join(', ')
  }
  const groups: { weightKg?: number; parts: number[] }[] = []
  for (const s of sets) {
    const part = s.reps ?? s.durationSeconds ?? 0
    const last = groups[groups.length - 1]
    if (last && last.weightKg === s.weightKg) last.parts.push(part)
    else groups.push({ weightKg: s.weightKg, parts: [part] })
  }
  const suffix = tracking === 'duration' ? ' s' : ' reps'
  return groups
    .map((g) => `${g.weightKg ? `${formatWeight(g.weightKg, unit)} × ` : ''}${g.parts.join(', ')}${g.weightKg ? '' : suffix}`)
    .join(' · ')
}

/** "6–10 reps", "30–60 s", "15–30 min": the planned target in the exercise's own measure. */
export function targetLabel(low: number, high: number, tracking: TrackingType | undefined): string {
  const unit = tracking === 'duration' ? 's' : tracking === 'distance-time' ? 'min' : 'reps'
  return low === high ? `${low} ${unit}` : `${low}–${high} ${unit}`
}
