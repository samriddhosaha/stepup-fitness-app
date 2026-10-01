import { describe, expect, it } from 'vitest'
import { parseISODateLocal, weekdayIndexOfISO, weekStartOfISO, toISODate } from './format'
import { TIME_ZONES, withTZ } from '../test/tz'

describe.each(TIME_ZONES)('date-only helpers in %s', (tz) => {
  it('parses as local midnight and round-trips', () =>
    withTZ(tz, () => {
      const d = parseISODateLocal('2026-10-01')
      expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 1, 0])
      expect(toISODate(d)).toBe('2026-10-01')
    }))

  it('gives Monday-first weekday indexes (Thu = 3, Sun = 6, Mon = 0)', () =>
    withTZ(tz, () => {
      expect(weekdayIndexOfISO('2026-10-01')).toBe(3)
      expect(weekdayIndexOfISO('2026-10-04')).toBe(6)
      expect(weekdayIndexOfISO('2026-09-28')).toBe(0)
    }))

  it('finds the Monday that starts the week', () =>
    withTZ(tz, () => {
      expect(weekStartOfISO('2026-10-01')).toBe('2026-09-28')
      expect(weekStartOfISO('2026-09-28')).toBe('2026-09-28')
      expect(weekStartOfISO('2026-10-04')).toBe('2026-09-28')
      expect(weekStartOfISO('2026-01-01')).toBe('2025-12-29')
    }))
})
