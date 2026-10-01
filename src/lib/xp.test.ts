import { describe, expect, it } from 'vitest'
import { getLevelProgress, getTotalXP, levelForXP, rankForLevel, xpRequiredForLevel, XP_VALUES } from './xp'
import type { XPEvent } from '../db/types'

describe('xp', () => {
  it('sums events', () => {
    const events: XPEvent[] = [
      { type: 'set', amount: XP_VALUES.set, occurredAt: 1 },
      { type: 'workout', amount: XP_VALUES.workout, occurredAt: 2 },
    ]
    expect(getTotalXP(events)).toBe(XP_VALUES.set + XP_VALUES.workout)
  })

  it('never takes XP away', () => {
    expect(Object.values(XP_VALUES).every((v) => v > 0)).toBe(true)
  })

  it('requires strictly more XP for each successive level', () => {
    for (let level = 1; level < 60; level += 1) {
      expect(xpRequiredForLevel(level + 1)).toBeGreaterThan(xpRequiredForLevel(level))
    }
  })

  it('levelForXP lands exactly on each threshold and just below it', () => {
    for (let level = 2; level < 40; level += 1) {
      const threshold = xpRequiredForLevel(level)
      expect(levelForXP(threshold)).toBe(level)
      expect(levelForXP(threshold - 1)).toBe(level - 1)
    }
    expect(levelForXP(0)).toBe(1)
  })

  it('rank changes at the documented level boundaries and never goes backwards', () => {
    expect(rankForLevel(1)).toBe('Beginner')
    expect(rankForLevel(4)).toBe('Beginner')
    expect(rankForLevel(5)).toBe('Committed')
    expect(rankForLevel(10)).toBe('Disciplined')
    expect(rankForLevel(50)).toBe('Summit')
    const order = ['Beginner', 'Committed', 'Disciplined', 'Seasoned', 'Relentless', 'Summit']
    let last = 0
    for (let level = 1; level <= 80; level += 1) {
      const idx = order.indexOf(rankForLevel(level))
      expect(idx).toBeGreaterThanOrEqual(last)
      last = idx
    }
  })

  it('getLevelProgress: xpIntoLevel stays within [0, xpForNextLevel)', () => {
    for (const total of [0, 1, 99, 100, 250, 5000]) {
      const p = getLevelProgress(total)
      expect(p.xpIntoLevel).toBeGreaterThanOrEqual(0)
      expect(p.xpIntoLevel).toBeLessThan(p.xpForNextLevel)
      expect(xpRequiredForLevel(p.level) + p.xpIntoLevel).toBe(total)
    }
  })

  it('clamps progress for a negative total instead of going below zero', () => {
    expect(getLevelProgress(-40).xpIntoLevel).toBe(0)
    expect(getLevelProgress(-40).level).toBe(1)
  })
})
