import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/schema'
import { getWeeklyReview, hashPayload, needsFetch, REFRESH_MS } from './weeklyReview'
import type { WeeklyReviewPayload } from './aiCoach'

const payload: WeeklyReviewPayload = {
  sessionsCompleted: 1,
  sessionsPlanned: 3,
  exercises: [],
  skips: [],
  prs: [],
  activeWeeksInARow: 1,
  bodyWeightTrendKg: null,
}
const WEEK = '2026-09-28'
const T0 = 1_000_000

beforeEach(async () => {
  await db.weeklyReviews.clear()
})

describe('weekly review cache', () => {
  it('hashes identical payloads identically and different ones differently', async () => {
    expect(await hashPayload(payload)).toBe(await hashPayload({ ...payload }))
    expect(await hashPayload(payload)).not.toBe(await hashPayload({ ...payload, sessionsCompleted: 2 }))
  })

  it('fetches once, then serves from cache on later opens', async () => {
    const fetchReview = vi.fn().mockResolvedValue('A calm week.')
    const args = { buildPayload: async () => payload, fetchReview, weekKey: WEEK }
    const first = await getWeeklyReview({ ...args, now: T0 })
    const second = await getWeeklyReview({ ...args, now: T0 + 60_000 })
    expect(first).toMatchObject({ text: 'A calm week.', fromCache: false })
    expect(second).toMatchObject({ text: 'A calm week.', fromCache: true })
    expect(fetchReview).toHaveBeenCalledTimes(1)
  })

  it('does not refetch when data changed but the cache is under 6 hours old', async () => {
    const fetchReview = vi.fn().mockResolvedValue('v1')
    await getWeeklyReview({ buildPayload: async () => payload, fetchReview, weekKey: WEEK, now: T0 })
    const r = await getWeeklyReview({
      buildPayload: async () => ({ ...payload, sessionsCompleted: 2 }),
      fetchReview,
      weekKey: WEEK,
      now: T0 + REFRESH_MS - 1,
    })
    expect(r.fromCache).toBe(true)
    expect(fetchReview).toHaveBeenCalledTimes(1)
  })

  it('refetches after 6 hours when the data changed, but not when it did not', async () => {
    const fetchReview = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2')
    await getWeeklyReview({ buildPayload: async () => payload, fetchReview, weekKey: WEEK, now: T0 })
    const same = await getWeeklyReview({ buildPayload: async () => payload, fetchReview, weekKey: WEEK, now: T0 + REFRESH_MS })
    expect(same.fromCache).toBe(true)
    const changed = await getWeeklyReview({
      buildPayload: async () => ({ ...payload, sessionsCompleted: 2 }),
      fetchReview,
      weekKey: WEEK,
      now: T0 + REFRESH_MS,
    })
    expect(changed).toMatchObject({ text: 'v2', fromCache: false })
  })

  it('a failed fetch leaves the cache untouched and rejects', async () => {
    const ok = vi.fn().mockResolvedValue('v1')
    await getWeeklyReview({ buildPayload: async () => payload, fetchReview: ok, weekKey: WEEK, now: T0 })
    const bad = vi.fn().mockRejectedValue(new Error('503'))
    await expect(
      getWeeklyReview({ buildPayload: async () => payload, fetchReview: bad, weekKey: WEEK, now: T0 + REFRESH_MS, force: true }),
    ).rejects.toThrow('503')
    expect((await db.weeklyReviews.get(WEEK))?.text).toBe('v1')
  })

  it('needsFetch: force still honours the 6 hour floor', () => {
    const cached = { weekKey: WEEK, payloadHash: 'h', text: 't', createdAt: T0 }
    expect(needsFetch(cached, 'h', T0 + 1000, true)).toBe(false)
    expect(needsFetch(cached, 'h', T0 + REFRESH_MS, true)).toBe(true)
    expect(needsFetch(undefined, 'h', T0)).toBe(true)
  })
})
