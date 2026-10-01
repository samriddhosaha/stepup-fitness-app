import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/schema'
import { TIME_ZONES, withTZ } from '../test/tz'

const runReminderChecks = vi.fn()
vi.mock('./notifications', () => ({ runReminderChecks: (p: unknown) => runReminderChecks(p) }))

import { runChecks, checkOnce } from './useReminderChecks'

describe.each(TIME_ZONES)('reminder checks in %s', (tz) => {
  beforeEach(async () => {
    runReminderChecks.mockReset()
    await db.plans.clear()
    await db.workoutSessions.clear()
    // Thursday 2026-10-01, midday local time
    vi.useFakeTimers({ toFake: ['Date'] })
    await withTZ(tz, () => vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0)))
  })
  afterEach(() => vi.useRealTimers())

  it('flags yesterday (Wed) as missed when it was scheduled and not completed', () =>
    withTZ(tz, async () => {
      await db.plans.add({
        createdAt: 1,
        volumeUneven: false,
        sessions: [{ name: 'Wed session', type: 'full-body-a', dayIndex: 2, exercises: [] }],
      })
      await runChecks()
      expect(runReminderChecks).toHaveBeenCalledWith(
        expect.objectContaining({ yesterdayScheduledAndMissed: true }),
      )
    }))

  it('does not flag it once yesterday was completed', () =>
    withTZ(tz, async () => {
      await db.plans.add({
        createdAt: 1,
        volumeUneven: false,
        sessions: [{ name: 'Wed session', type: 'full-body-a', dayIndex: 2, exercises: [] }],
      })
      await db.workoutSessions.add({
        date: '2026-09-30',
        planSessionName: 'Wed session',
        exercises: [],
        skips: [],
        startedAt: 1,
        completedAt: 2,
      })
      await runChecks()
      expect(runReminderChecks).toHaveBeenCalledWith(
        expect.objectContaining({ yesterdayScheduledAndMissed: false }),
      )
    }))

  it('checkOnce swallows failures instead of leaking an unhandled rejection', async () => {
    runReminderChecks.mockRejectedValueOnce(new Error('boom'))
    await db.plans.add({ createdAt: 1, volumeUneven: false, sessions: [] })
    await expect(checkOnce()).resolves.toBeUndefined()
  })
})
