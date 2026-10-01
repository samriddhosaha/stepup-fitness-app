import { describe, expect, it } from 'vitest'
import {
  EMPTY_FORM,
  describeSet,
  setFromValues,
  summariseSets,
  targetLabel,
  validateValues,
  valuesFromSet,
} from './setValues'
import type { LoggedSet } from '../../db/types'

const v = (over: Partial<typeof EMPTY_FORM>) => ({ ...EMPTY_FORM, ...over })

describe('validateValues', () => {
  it('weighted lifts need reps; weight is range-checked', () => {
    expect(validateValues(v({ weight: '20' }), 'weight-reps', 'kg', true)).toMatchObject({ canSubmit: false, missing: 'reps' })
    expect(validateValues(v({ weight: '20', reps: '8' }), 'weight-reps', 'kg', true).canSubmit).toBe(true)
    expect(validateValues(v({ weight: '9000', reps: '8' }), 'weight-reps', 'kg', true)).toMatchObject({ canSubmit: false })
    expect(validateValues(v({ weight: '20', reps: '0' }), 'weight-reps', 'kg', true).canSubmit).toBe(false)
  })

  it('bodyweight moves need only reps', () => {
    expect(validateValues(v({ reps: '12' }), 'bodyweight-reps', 'kg', false).canSubmit).toBe(true)
  })

  it('timed holds need seconds; the load is optional', () => {
    expect(validateValues(v({}), 'duration', 'kg', true)).toMatchObject({ canSubmit: false, missing: 'time' })
    expect(validateValues(v({ seconds: '45' }), 'duration', 'kg', true).canSubmit).toBe(true)
    expect(validateValues(v({ seconds: '45', weight: '-3' }), 'duration', 'kg', true).canSubmit).toBe(false)
  })

  it('cardio needs minutes; distance is optional but bounded', () => {
    expect(validateValues(v({}), 'distance-time', 'kg', false).missing).toBe('minutes')
    expect(validateValues(v({ minutes: '20' }), 'distance-time', 'kg', false).canSubmit).toBe(true)
    expect(validateValues(v({ minutes: '20', distance: '9999' }), 'distance-time', 'kg', false).canSubmit).toBe(false)
  })
})

describe('setFromValues / valuesFromSet', () => {
  it('builds each kind of set and refuses an invalid form', () => {
    expect(setFromValues(v({ weight: '20', reps: '8', rpe: 3, note: ' easy ' }), 'weight-reps', 'kg', 2, true)).toEqual({
      setIndex: 2,
      weightKg: 20,
      reps: 8,
      rpe: 3,
      note: 'easy',
    })
    expect(setFromValues(v({ reps: '12' }), 'bodyweight-reps', 'kg', 0, false)).toMatchObject({ reps: 12 })
    expect(setFromValues(v({ seconds: '45', weight: '16' }), 'duration', 'kg', 0, true)).toMatchObject({ durationSeconds: 45, weightKg: 16 })
    expect(setFromValues(v({ seconds: '45', weight: '16' }), 'duration', 'kg', 0, false)?.weightKg).toBeUndefined()
    expect(setFromValues(v({}), 'weight-reps', 'kg', 0, true)).toBeNull()
  })

  it('cardio stores seconds and metres, in miles for lb users', () => {
    expect(setFromValues(v({ minutes: '30', distance: '5' }), 'distance-time', 'kg', 0, false)).toMatchObject({ durationSeconds: 1800, distanceM: 5000 })
    const miles = setFromValues(v({ minutes: '30', distance: '3' }), 'distance-time', 'lb', 0, false)!
    expect(miles.distanceM).toBe(4828)
    expect(valuesFromSet(miles, 'lb').distance).toBe('3')
  })

  it('round-trips a set through the form, in lb too', () => {
    const set: LoggedSet = { setIndex: 0, weightKg: 45.36, reps: 5, rpe: 4, note: 'grindy' }
    const values = valuesFromSet(set, 'lb')
    expect(values).toMatchObject({ weight: '100', reps: '5', rpe: 4, note: 'grindy' })
    expect(setFromValues(values, 'weight-reps', 'lb', 0, true)).toMatchObject({ weightKg: 45.36, reps: 5 })
  })
})

describe('describing sets', () => {
  it('describes reps, holds, loaded holds and cardio', () => {
    expect(describeSet({ setIndex: 0, weightKg: 20, reps: 8 }, 'kg')).toBe('20 kg × 8 reps')
    expect(describeSet({ setIndex: 0, reps: 12 }, 'kg')).toBe('12 reps')
    expect(describeSet({ setIndex: 0, durationSeconds: 45 }, 'kg', 'duration')).toBe('45 s')
    expect(describeSet({ setIndex: 0, weightKg: 24, durationSeconds: 40 }, 'kg', 'duration')).toBe('24 kg × 40 s')
    expect(describeSet({ setIndex: 0, durationSeconds: 1800, distanceM: 4500 }, 'kg', 'distance-time')).toBe('30 min · 4.5 km')
    expect(describeSet({ setIndex: 0, durationSeconds: 600 }, 'lb', 'distance-time')).toBe('10 min')
  })

  it('summarises a session’s sets compactly', () => {
    const sets: LoggedSet[] = [
      { setIndex: 0, weightKg: 20, reps: 8 },
      { setIndex: 1, weightKg: 20, reps: 8 },
      { setIndex: 2, weightKg: 22.5, reps: 6 },
    ]
    expect(summariseSets(sets, 'kg')).toBe('20 kg × 8, 8 · 22.5 kg × 6')
    expect(summariseSets([{ setIndex: 0, reps: 10 }, { setIndex: 1, reps: 9 }], 'kg')).toBe('10, 9 reps')
    expect(summariseSets([{ setIndex: 0, durationSeconds: 30 }, { setIndex: 1, durationSeconds: 40 }], 'kg', 'duration')).toBe('30 s, 40 s')
  })

  it('labels targets by measure', () => {
    expect(targetLabel(6, 10, 'weight-reps')).toBe('6–10 reps')
    expect(targetLabel(30, 60, 'duration')).toBe('30–60 s')
    expect(targetLabel(15, 30, 'distance-time')).toBe('15–30 min')
    expect(targetLabel(10, 10, undefined)).toBe('10 reps')
  })
})
