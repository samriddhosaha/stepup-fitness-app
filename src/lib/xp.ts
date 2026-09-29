import { db } from '../db/schema'
import type { XPEvent, XPEventType } from '../db/types'

export const XP_VALUES: Record<XPEventType, number> = {
  set: 5,
  exercise: 10,
  workout: 30,
  pr: 50,
  streak: 15,
  'weekly-mission': 40,
  loss: -5,
}

// Deliberately gentle: skipped exercises/missed workouts cost XP, but the
// loss is capped so a bad day or week can't spiral. Matches the original
// app's "capped, not punitive" XP-loss mechanic.
const MAX_LOSS_PER_DAY = -15
const MAX_LOSS_PER_WEEK = -50

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfWeek(ts: number): number {
  const d = new Date(ts)
  const day = d.getDay()
  const diff = (day + 6) % 7 // Monday as start of week
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export async function awardXP(
  type: XPEventType,
  note?: string,
  amountOverride?: number,
): Promise<XPEvent> {
  const amount = amountOverride ?? XP_VALUES[type]
  const now = Date.now()

  if (amount < 0) {
    const dayStart = startOfDay(now)
    const weekStart = startOfWeek(now)
    const [todayEvents, weekEvents] = await Promise.all([
      db.xpEvents.where('occurredAt').aboveOrEqual(dayStart).toArray(),
      db.xpEvents.where('occurredAt').aboveOrEqual(weekStart).toArray(),
    ])
    const lossToday = todayEvents
      .filter((e) => e.amount < 0)
      .reduce((sum, e) => sum + e.amount, 0)
    const lossThisWeek = weekEvents
      .filter((e) => e.amount < 0)
      .reduce((sum, e) => sum + e.amount, 0)

    // Room remaining before hitting each cap (negative = still room to lose;
    // zero or positive = cap already reached). Applying the least-negative
    // (closest to zero) of the desired amount and both caps' remaining room
    // guarantees neither cap is breached.
    const roomToday = MAX_LOSS_PER_DAY - lossToday
    const roomThisWeek = MAX_LOSS_PER_WEEK - lossThisWeek
    const finalAmount = Math.min(0, Math.max(amount, roomToday, roomThisWeek))

    const id = await db.xpEvents.add({ type, amount: finalAmount, occurredAt: now, note })
    return { id, type, amount: finalAmount, occurredAt: now, note }
  }

  const id = await db.xpEvents.add({ type, amount, occurredAt: now, note })
  return { id, type, amount, occurredAt: now, note }
}

export function getTotalXP(events: XPEvent[]): number {
  return events.reduce((sum, e) => sum + e.amount, 0)
}

// Cumulative XP required to reach a given level. Grows superlinearly so
// each level takes meaningfully longer than the last, without ever feeling
// like a wall.
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.round(100 * (level - 1) * (1 + (level - 1) * 0.12))
}

export function levelForXP(totalXP: number): number {
  let level = 1
  while (xpRequiredForLevel(level + 1) <= totalXP) {
    level += 1
  }
  return level
}

export interface LevelProgress {
  level: number
  rank: string
  xpIntoLevel: number
  xpForNextLevel: number
  totalXP: number
}

const RANKS: { minLevel: number; name: string }[] = [
  { minLevel: 1, name: 'Beginner' },
  { minLevel: 5, name: 'Committed' },
  { minLevel: 10, name: 'Disciplined' },
  { minLevel: 20, name: 'Seasoned' },
  { minLevel: 35, name: 'Relentless' },
  { minLevel: 50, name: 'Summit' },
]

export function rankForLevel(level: number): string {
  let rank = RANKS[0].name
  for (const r of RANKS) {
    if (level >= r.minLevel) rank = r.name
  }
  return rank
}

export function getLevelProgress(totalXP: number): LevelProgress {
  const level = levelForXP(totalXP)
  const currentFloor = xpRequiredForLevel(level)
  const nextCeiling = xpRequiredForLevel(level + 1)
  return {
    level,
    rank: rankForLevel(level),
    xpIntoLevel: totalXP - currentFloor,
    xpForNextLevel: nextCeiling - currentFloor,
    totalXP,
  }
}
