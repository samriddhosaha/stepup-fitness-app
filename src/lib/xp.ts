import { db } from '../db/schema'
import type { XPEvent, XPEventType } from '../db/types'

export const XP_VALUES: Record<XPEventType, number> = {
  set: 5,
  exercise: 10,
  workout: 30,
  pr: 50,
}

/** Appends an XP event. Safe to call inside a Dexie transaction that includes `xpEvents`. */
export async function awardXP(type: XPEventType, note?: string): Promise<XPEvent> {
  const amount = XP_VALUES[type]
  const occurredAt = Date.now()
  const id = await db.xpEvents.add({ type, amount, occurredAt, note })
  return { id, type, amount, occurredAt, note }
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
  let rank = RANKS[0]?.name ?? 'Beginner'
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
    xpIntoLevel: Math.max(0, totalXP - currentFloor),
    xpForNextLevel: nextCeiling - currentFloor,
    totalXP,
  }
}
