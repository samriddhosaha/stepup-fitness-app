import { describe, expect, it } from 'vitest'
import { trainingHeatmap } from './heatmap'
import type { WorkoutSession } from '../db/types'
import { TIME_ZONES, withTZ } from '../test/tz'

const done = (date: string, completed = true): WorkoutSession => ({
  date,
  planSessionName: 'A',
  exercises: [],
  skips: [],
  startedAt: 1,
  completedAt: completed ? 2 : undefined,
})

const TODAY = '2026-10-01' // Thursday; this week is Mon 09-28 .. Sun 10-04

describe.each(TIME_ZONES)('trainingHeatmap in %s', (tz) => {
  it('is twelve Monday-to-Sunday weeks ending with the current one', () =>
    withTZ(tz, () => {
      const h = trainingHeatmap([], TODAY)
      expect(h.weeks).toHaveLength(12)
      expect(h.weeks.every((w) => w.length === 7)).toBe(true)
      expect(h.weeks[11]?.[0]?.date).toBe('2026-09-28')
      expect(h.weeks[11]?.[6]?.date).toBe('2026-10-04')
      expect(h.weeks[0]?.[0]?.date).toBe('2026-07-13') // 11 weeks before
    }))

  it('counts completed workouts per day, ignoring unfinished ones', () =>
    withTZ(tz, () => {
      const h = trainingHeatmap([done('2026-09-29'), done('2026-09-29'), done('2026-09-30', false)], TODAY)
      const tue = h.weeks[11]?.[1]
      expect(tue).toMatchObject({ date: '2026-09-29', count: 2 })
      expect(h.weeks[11]?.[2]?.count).toBe(0)
      expect(h.totalSessions).toBe(2)
    }))

  it('marks days after today as future, not as misses', () =>
    withTZ(tz, () => {
      const week = trainingHeatmap([], TODAY).weeks[11]!
      expect(week.map((d) => d.future)).toEqual([false, false, false, false, true, true, true])
    }))

  it('counts active weeks and drops anything older than the window', () =>
    withTZ(tz, () => {
      const h = trainingHeatmap([done('2026-09-29'), done('2026-09-15'), done('2026-01-05')], TODAY)
      expect(h.activeWeeks).toBe(2)
      expect(h.totalSessions).toBe(2)
    }))

  it('crosses a year end and a DST change without losing or repeating a day', () =>
    withTZ(tz, () => {
      const dates = trainingHeatmap([], '2026-01-08', 4).weeks.flat().map((d) => d.date)
      expect(new Set(dates).size).toBe(28)
      expect(dates[0]).toBe('2025-12-15')
      expect(dates.at(-1)).toBe('2026-01-11')
      const march = trainingHeatmap([], '2026-03-30', 4).weeks.flat().map((d) => d.date)
      expect(new Set(march).size).toBe(28)
    }))
})
