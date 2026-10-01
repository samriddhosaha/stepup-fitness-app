import { describe, expect, it } from 'vitest'
import { formatWeight, kgToUnit, parseWeight, roundToUnitGrid, unitToKg, workoutLoadRangeForUnit } from './units'

describe('units', () => {
  it('round-trips lb through kg without visible drift', () => {
    for (const lb of [5, 45, 87.5, 135, 225, 315]) {
      const kg = unitToKg(lb, 'lb')
      expect(Math.round(kgToUnit(kg, 'lb') * 10) / 10).toBeCloseTo(lb, 1)
    }
  })

  it('formats with the unit, dropping trailing zeros', () => {
    expect(formatWeight(40, 'kg')).toBe('40 kg')
    expect(formatWeight(41.96, 'lb')).toBe('92.5 lb')
    expect(formatWeight(41.96, 'lb', false)).toBe('92.5')
  })

  it('parses user input in the chosen unit to kg', () => {
    expect(parseWeight('100', 'kg')).toBe(100)
    expect(parseWeight('225', 'lb')).toBeCloseTo(102.06, 2)
    expect(parseWeight('', 'kg')).toBeNull()
    expect(parseWeight('abc', 'lb')).toBeNull()
  })

  it('snaps to unit-native grids', () => {
    expect(roundToUnitGrid(40, 'lb', 2.5)).toBeCloseTo(unitToKg(87.5, 'lb'), 2)
    expect(roundToUnitGrid(41.3, 'kg', 2.5)).toBe(42.5)
  })

  it('converts the load range per unit', () => {
    expect(workoutLoadRangeForUnit('kg').max).toBe(500)
    expect(workoutLoadRangeForUnit('lb').max).toBeGreaterThan(1000)
  })
})
