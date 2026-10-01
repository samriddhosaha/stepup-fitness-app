import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { weeklyVolumeSeries } from './progress'
import { TIME_ZONES, withTZ } from '../test/tz'

function session(date: string, weightKg: number, reps: number) {
  return {
    date,
    planSessionName: 'A',
    exercises: [{ exerciseId: 'back-squat', sets: [{ setIndex: 0, weightKg, reps }] }],
    skips: [],
    startedAt: 1,
    completedAt: 2,
  }
}

describe.each(TIME_ZONES)('weeklyVolumeSeries in %s', (tz) => {
  beforeEach(async () => {
    await db.workoutSessions.clear()
  })

  it('buckets Monday and Sunday sessions into the same Monday-start week', () =>
    withTZ(tz, async () => {
      await db.workoutSessions.bulkAdd([
        session('2026-09-28', 100, 5), // Mon
        session('2026-10-04', 100, 5), // Sun, same week
        session('2026-10-05', 50, 10), // next Mon
      ])
      expect(await weeklyVolumeSeries()).toEqual([
        { date: '2026-09-28', value: 1000 },
        { date: '2026-10-05', value: 500 },
      ])
    }))
})
