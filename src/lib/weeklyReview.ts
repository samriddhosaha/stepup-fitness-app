import { db } from '../db/schema'
import { todayISODate, weekStartOfISO } from './format'
import type { WeeklyReview } from '../db/types'
import type { WeeklyReviewPayload } from './aiCoach'

/** A cached review is only re-fetched after this long, even when the data changed. */
export const REFRESH_MS = 6 * 60 * 60 * 1000

export const currentWeekKey = (todayISO = todayISODate()): string => weekStartOfISO(todayISO)

export async function hashPayload(payload: WeeklyReviewPayload): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(payload))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Fetch only when there is no review for this week, or the data changed AND the cached
 * one is at least REFRESH_MS old. `force` (the Refresh button) still honours the 6 h floor.
 */
export function needsFetch(cached: WeeklyReview | undefined, payloadHash: string, now: number, force = false): boolean {
  if (!cached) return true
  const oldEnough = now - cached.createdAt >= REFRESH_MS
  if (force) return oldEnough
  return cached.payloadHash !== payloadHash && oldEnough
}

/** Whether a cached review is old enough that the Refresh button may call the API again. */
export function canRefreshReview(cached: WeeklyReview | undefined, now = Date.now()): boolean {
  return !cached || now - cached.createdAt >= REFRESH_MS
}

export interface ReviewResult {
  text: string
  createdAt: number
  fromCache: boolean
}

export async function getWeeklyReview(opts: {
  buildPayload: () => Promise<WeeklyReviewPayload>
  fetchReview: (payload: WeeklyReviewPayload) => Promise<string>
  force?: boolean
  now?: number
  weekKey?: string
}): Promise<ReviewResult> {
  const now = opts.now ?? Date.now()
  const weekKey = opts.weekKey ?? currentWeekKey()
  const [payload, cached] = await Promise.all([opts.buildPayload(), db.weeklyReviews.get(weekKey)])
  const payloadHash = await hashPayload(payload)

  if (cached && !needsFetch(cached, payloadHash, now, opts.force)) {
    return { text: cached.text, createdAt: cached.createdAt, fromCache: true }
  }
  const text = await opts.fetchReview(payload)
  await db.weeklyReviews.put({ weekKey, payloadHash, text, createdAt: now })
  return { text, createdAt: now, fromCache: false }
}
