import { describe, expect, it } from 'vitest'
import {
  bodyWeightRangeForUnit,
  HEIGHT_CM_RANGE,
  isInRange,
  rangeErrorMessage,
} from './validation'

describe('validation', () => {
  it('accepts empty input as valid (fields using this are optional)', () => {
    expect(rangeErrorMessage('', HEIGHT_CM_RANGE, 'cm')).toBeNull()
  })

  it('rejects a height of 300 cm as out of range', () => {
    expect(rangeErrorMessage('300', HEIGHT_CM_RANGE, 'cm')).not.toBeNull()
  })

  it('accepts a realistic height', () => {
    expect(rangeErrorMessage('175', HEIGHT_CM_RANGE, 'cm')).toBeNull()
  })

  it('rejects non-numeric input', () => {
    expect(rangeErrorMessage('abc', HEIGHT_CM_RANGE, 'cm')).not.toBeNull()
  })

  it('converts the bodyweight range to lb proportionally to kg', () => {
    const kgRange = bodyWeightRangeForUnit('kg')
    const lbRange = bodyWeightRangeForUnit('lb')
    expect(lbRange.min).toBeGreaterThan(kgRange.min)
    expect(lbRange.max).toBeGreaterThan(kgRange.max)
  })

  it('isInRange is inclusive of both bounds', () => {
    expect(isInRange(100, HEIGHT_CM_RANGE)).toBe(true)
    expect(isInRange(230, HEIGHT_CM_RANGE)).toBe(true)
    expect(isInRange(99, HEIGHT_CM_RANGE)).toBe(false)
    expect(isInRange(231, HEIGHT_CM_RANGE)).toBe(false)
  })
})
