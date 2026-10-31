import { describe, expect, it } from 'vitest'
import { daysBetween, lastNDays, parseISODateLocal, weekdayIndexOfISO, weekStartOfISO, toISODate } from './format'
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

describe.each(TIME_ZONES)('day counting in %s', (tz) => {
  it('counts whole days between dates, across month ends and DST changes', () =>
    withTZ(tz, () => {
      expect(daysBetween('2026-10-24', '2026-10-31')).toBe(7)
      expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
      expect(daysBetween('2026-03-20', '2026-03-29')).toBe(9) // spans a European DST change
      expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2) // spans a US DST change
      expect(daysBetween('2026-10-31', '2026-10-31')).toBe(0)
      expect(daysBetween('2026-11-02', '2026-10-31')).toBe(-2)
    }))

  it('lists the last N days, newest first, across month and DST boundaries', () =>
    withTZ(tz, () => {
      expect(lastNDays('2026-03-01', 3)).toEqual(['2026-03-01', '2026-02-28', '2026-02-27'])
      expect(lastNDays('2026-03-09', 3)).toEqual(['2026-03-09', '2026-03-08', '2026-03-07'])
      expect(lastNDays('2026-04-01', 1)).toEqual(['2026-04-01'])
    }))
})
