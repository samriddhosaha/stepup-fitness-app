import { describe, expect, it } from 'vitest'
import { getLevelProgress, getTotalXP, levelForXP, rankForLevel, xpRequiredForLevel } from './xp'
import type { XPEvent } from '../db/types'

describe('xp', () => {
  it('sums events, including negative (loss) amounts', () => {
    const events: XPEvent[] = [
      { type: 'set', amount: 5, occurredAt: 1 },
      { type: 'workout', amount: 30, occurredAt: 2 },
      { type: 'loss', amount: -5, occurredAt: 3 },
    ]
    expect(getTotalXP(events)).toBe(30)
  })

  it('requires strictly more XP for each successive level', () => {
    for (let level = 1; level < 30; level += 1) {
      expect(xpRequiredForLevel(level + 1)).toBeGreaterThan(xpRequiredForLevel(level))
    }
  })

  it('levelForXP is consistent with xpRequiredForLevel thresholds', () => {
    for (let level = 1; level < 20; level += 1) {
      const threshold = xpRequiredForLevel(level)
      expect(levelForXP(threshold)).toBeGreaterThanOrEqual(level)
      expect(levelForXP(threshold - 1)).toBeLessThan(levelForXP(threshold + 1) + 1)
    }
  })

  it('rankForLevel is monotonically non-decreasing with level', () => {
    const ranksSeen = new Set<string>()
    let lastLevel = 0
    for (let level = 1; level <= 60; level += 1) {
      ranksSeen.add(rankForLevel(level))
      expect(level).toBeGreaterThan(lastLevel)
      lastLevel = level
    }
    expect(ranksSeen.size).toBeGreaterThan(1)
  })

  it('getLevelProgress reports xpIntoLevel below xpForNextLevel', () => {
    const progress = getLevelProgress(250)
    expect(progress.xpIntoLevel).toBeLessThan(progress.xpForNextLevel)
    expect(progress.xpIntoLevel).toBeGreaterThanOrEqual(0)
  })
})
