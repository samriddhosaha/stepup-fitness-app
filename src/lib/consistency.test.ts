import { describe, expect, it } from 'vitest'
import { activeWeeksInARow, completedThisWeek, isTodayScheduledAndIncomplete } from './consistency'
import type { Plan, WorkoutSession } from '../db/types'

const done = (date: string): WorkoutSession => ({
  date,
  planSessionName: 'A',
  exercises: [],
  skips: [],
  startedAt: 1,
  completedAt: 2,
})

// Thursday 2026-10-01; weeks start Mondays: 09-28, 09-21, 09-14, 09-07 …
const TODAY = '2026-10-01'

describe('activeWeeksInARow', () => {
  it('is 0 with no completed workouts, and ignores unfinished ones', () => {
    expect(activeWeeksInARow([], TODAY)).toBe(0)
    expect(activeWeeksInARow([{ ...done('2026-09-30'), completedAt: undefined }], TODAY)).toBe(0)
  })

  it('counts consecutive active weeks including the current one', () => {
    expect(activeWeeksInARow([done('2026-09-29'), done('2026-09-22'), done('2026-09-16')], TODAY)).toBe(3)
  })

  it('does not break just because this week has no session yet', () => {
    expect(activeWeeksInARow([done('2026-09-22'), done('2026-09-16')], TODAY)).toBe(2)
  })

  it('forgives a single empty week', () => {
    // active: 09-28, (09-21 empty), 09-14, 09-07
    expect(activeWeeksInARow([done('2026-09-29'), done('2026-09-15'), done('2026-09-08')], TODAY)).toBe(3)
  })

  it('two empty weeks in a row end the run', () => {
    // active: 09-28; 09-21 + 09-14 empty; 09-07 active but cut off
    expect(activeWeeksInARow([done('2026-09-29'), done('2026-09-08')], TODAY)).toBe(1)
  })

  it('counts several sessions in one week once', () => {
    expect(activeWeeksInARow([done('2026-09-28'), done('2026-09-30'), done('2026-10-01')], TODAY)).toBe(1)
  })
})

describe('completedThisWeek / isTodayScheduledAndIncomplete', () => {
  it('counts only sessions since Monday', () => {
    expect(completedThisWeek([done('2026-09-27'), done('2026-09-28'), done('2026-10-01')], TODAY)).toBe(2)
  })

  const plan: Plan = {
    createdAt: 1,
    volumeUneven: false,
    sessions: [{ name: 'A', type: 'full-body-a', dayIndex: 3, exercises: [] }],
  }
  it('is true only when today is scheduled and not yet done', () => {
    expect(isTodayScheduledAndIncomplete(plan, [], TODAY, 3)).toBe(true)
    expect(isTodayScheduledAndIncomplete(plan, [done(TODAY)], TODAY, 3)).toBe(false)
    expect(isTodayScheduledAndIncomplete(plan, [], TODAY, 2)).toBe(false)
    expect(isTodayScheduledAndIncomplete(undefined, [], TODAY, 3)).toBe(false)
  })
})
