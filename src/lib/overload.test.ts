import { describe, expect, it } from 'vitest'
import { suggestNextLoad } from './overload'
import type { LoggedSet, PlanExercise } from '../db/types'

const planned: PlanExercise = {
  exerciseId: 'back-squat',
  targetSets: 3,
  targetRepsLow: 6,
  targetRepsHigh: 10,
  startingLoadKg: 40,
}

function sets(reps: number, rpe: number, count = 3): LoggedSet[] {
  return Array.from({ length: count }, (_, i) => ({ setIndex: i, weightKg: 40, reps, rpe }))
}

describe('suggestNextLoad', () => {
  it('suggests increasing load when the range is cleared at low RPE', () => {
    const result = suggestNextLoad(planned, sets(10, 2))
    expect(result.action).toBe('increase')
    expect(result.suggestedWeightKg).toBeGreaterThan(planned.startingLoadKg!)
  })

  it('suggests backing off when the range is missed at high RPE', () => {
    const result = suggestNextLoad(planned, sets(4, 5))
    expect(result.action).toBe('decrease')
    expect(result.suggestedWeightKg).toBeLessThan(planned.startingLoadKg!)
  })

  it('holds steady when the range is missed but effort was low', () => {
    const result = suggestNextLoad(planned, sets(4, 2))
    expect(result.action).toBe('hold')
  })

  it('holds at the same load when the range is cleared but effort was high', () => {
    const result = suggestNextLoad(planned, sets(10, 4))
    expect(result.action).toBe('hold')
    expect(result.suggestedWeightKg).toBe(planned.startingLoadKg)
  })

  it('falls back to a rep-based suggestion for bodyweight exercises with no load', () => {
    const bodyweightPlanned: PlanExercise = {
      exerciseId: 'push-up',
      targetSets: 3,
      targetRepsLow: 8,
      targetRepsHigh: 15,
    }
    const result = suggestNextLoad(bodyweightPlanned, sets(15, 2))
    expect(result.action).toBe('increase')
    expect(result.suggestedWeightKg).toBeUndefined()
  })
})
