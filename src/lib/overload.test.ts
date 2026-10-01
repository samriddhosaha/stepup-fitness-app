import { describe, expect, it } from 'vitest'
import { nextExerciseState, suggestNextLoad, warmupSets } from './overload'
import { kgToDisplay } from './format'
import type { ExerciseState, LoggedSet, PlanExercise, WeightUnit } from '../db/types'

const planned: PlanExercise = {
  exerciseId: 'back-squat',
  targetSets: 3,
  targetRepsLow: 6,
  targetRepsHigh: 10,
  startingLoadKg: 40,
}

function sets(reps: number | number[], rpe: number, weightKg = 40, count = 3): LoggedSet[] {
  const r = Array.isArray(reps) ? reps : Array.from({ length: count }, () => reps)
  return r.map((reps, i) => ({ setIndex: i, weightKg, reps, rpe }))
}

function stateAfter(
  logged: LoggedSet[],
  p: PlanExercise = planned,
  prev?: ExerciseState,
  date = '2026-01-01',
): ExerciseState {
  return nextExerciseState(prev, p.exerciseId, p, logged, date)!
}

describe('suggestNextLoad — single session', () => {
  it('increases when every set hits the top of the range at low RPE', () => {
    const r = suggestNextLoad(planned, [], stateAfter(sets(10, 2)), { unit: 'kg' })
    expect(r.action).toBe('increase')
    expect(r.suggestedWeightKg).toBe(42.5)
  })

  it('does NOT increase if only the average hit the top (per-set double progression)', () => {
    const r = suggestNextLoad(planned, [], stateAfter(sets([12, 10, 8], 2)), { unit: 'kg' })
    expect(r.action).toBe('hold')
  })

  it('does not increase when a set was missed even if the others were high', () => {
    const r = suggestNextLoad(planned, [], stateAfter(sets([10, 10], 2)), { unit: 'kg' })
    expect(r.action).toBe('hold') // only 2 of 3 target sets logged
  })

  it('holds (does not deload) after a single failed session', () => {
    const r = suggestNextLoad(planned, [], stateAfter(sets(4, 5)), { unit: 'kg' })
    expect(r.action).toBe('hold')
    expect(r.suggestedWeightKg).toBe(40)
  })

  it('holds at the same load when the range is cleared but effort was high', () => {
    const r = suggestNextLoad(planned, [], stateAfter(sets(10, 4)), { unit: 'kg' })
    expect(r.action).toBe('hold')
    expect(r.suggestedWeightKg).toBe(40)
  })

  it('works from raw history when there is no stored state yet', () => {
    const r = suggestNextLoad(planned, [sets(10, 2)], undefined, { unit: 'kg' })
    expect(r.action).toBe('increase')
  })

  it('suggests a rep target for bodyweight work', () => {
    const bw: PlanExercise = { exerciseId: 'push-up', targetSets: 3, targetRepsLow: 8, targetRepsHigh: 15 }
    const logged = sets(15, 2, 0)
    const r = suggestNextLoad(bw, [], stateAfter(logged, bw), { unit: 'kg' })
    expect(r.action).toBe('increase')
    expect(r.suggestedReps).toBe(17)
    expect(r.suggestedWeightKg).toBeUndefined()
  })
})

describe('progression over multiple sessions (audit E1)', () => {
  /** Simulates N sessions where the lifter always follows the suggestion and hits 3×10 @ RPE 2. */
  function simulate(unit: WeightUnit, weeks: number, startKg = 40) {
    let state: ExerciseState | undefined
    let load = startKg
    const loads: number[] = []
    for (let w = 0; w < weeks; w += 1) {
      loads.push(load)
      state = nextExerciseState(state, planned.exerciseId, planned, sets(10, 2, load), `2026-01-${String(w + 1).padStart(2, '0')}`)
      const s = suggestNextLoad({ ...planned, startingLoadKg: startKg }, [], state, { unit })
      load = s.suggestedWeightKg ?? load
    }
    return loads
  }

  it('climbs past startingLoad + one step (was stuck at 42.5 forever)', () => {
    const loads = simulate('kg', 6)
    expect(loads.slice(0, 5)).toEqual([40, 42.5, 45, 47.5, 50])
    expect(Math.max(...loads)).toBeGreaterThan(42.5)
  })

  it('lb lifters get lb-native 5 lb jumps and tidy numbers', () => {
    const loads = simulate('lb', 4).map((kg) => kgToDisplay(kg, 'lb'))
    // 40 kg → 87.5 lb on the 2.5 lb grid → +5 lb each time
    expect(loads.slice(1)).toEqual([92.5, 97.5, 102.5])
  })

  it('holds through a plateau', () => {
    let state: ExerciseState | undefined
    for (let w = 0; w < 4; w += 1) {
      state = nextExerciseState(state, planned.exerciseId, planned, sets(8, 3, 40), `2026-02-0${w + 1}`)
    }
    const s = suggestNextLoad(planned, [], state, { unit: 'kg' })
    expect(s.action).toBe('hold')
    expect(s.suggestedWeightKg).toBe(40)
  })

  it('deloads ~10% after two consecutive failed sessions, then resets', () => {
    let state = stateAfter(sets(4, 5, 60), planned)
    expect(state.consecutiveFails).toBe(1)
    state = stateAfter(sets(4, 5, 60), planned, state, '2026-01-08')
    expect(state.consecutiveFails).toBe(2)
    const s = suggestNextLoad(planned, [], state, { unit: 'kg' })
    expect(s.action).toBe('decrease')
    expect(s.suggestedWeightKg).toBeGreaterThanOrEqual(53)
    expect(s.suggestedWeightKg).toBeLessThanOrEqual(55)
    // a good session at the lighter load resets the fail counter
    const reset = stateAfter(sets(8, 3, 54), planned, state, '2026-01-15')
    expect(reset.consecutiveFails).toBe(0)
  })

  it('a swapped exercise uses its own estimate, not the original load', () => {
    const goblet: PlanExercise = { ...planned, exerciseId: 'goblet-squat', startingLoadKg: 16 }
    const s = suggestNextLoad(goblet, [], undefined, { unit: 'kg' })
    expect(s.suggestedWeightKg).toBe(16)
    expect(s.message).toContain('16 kg')
  })

  it('uses the weight actually lifted, not the plan estimate', () => {
    const state = stateAfter(sets(10, 2, 60)) // lifted 60 though plan said 40
    const s = suggestNextLoad(planned, [], state, { unit: 'kg' })
    expect(s.suggestedWeightKg).toBe(62.5)
  })

  it('regression: 40 kg × 10 @ RPE 2 progresses beyond 42.5 on the third week', () => {
    let state: ExerciseState | undefined
    let suggestion = 40
    for (let w = 0; w < 3; w += 1) {
      state = nextExerciseState(state, planned.exerciseId, planned, sets(10, 2, suggestion), `2026-03-0${w + 1}`)
      suggestion = suggestNextLoad(planned, [], state, { unit: 'kg' }).suggestedWeightKg!
    }
    expect(suggestion).toBeGreaterThan(42.5)
  })
})

describe('dumbbell increments', () => {
  it('uses small jumps for dumbbell upper-body work', () => {
    const p: PlanExercise = { exerciseId: 'dumbbell-shoulder-press', targetSets: 3, targetRepsLow: 6, targetRepsHigh: 10, startingLoadKg: 8 }
    const st = nextExerciseState(undefined, p.exerciseId, p, sets(10, 2, 8), '2026-01-01')
    expect(suggestNextLoad(p, [], st, { unit: 'kg' }).suggestedWeightKg).toBe(9)
    const heavier = nextExerciseState(undefined, p.exerciseId, p, sets(10, 2, 14), '2026-01-01')
    expect(suggestNextLoad(p, [], heavier, { unit: 'kg' }).suggestedWeightKg).toBe(16)
  })
})

describe('warmupSets', () => {
  const ramp = [
    { percentOfWorking: 0.4, reps: 8 },
    { percentOfWorking: 0.6, reps: 5 },
    { percentOfWorking: 0.8, reps: 3 },
  ]
  it('is hidden without a load', () => {
    expect(warmupSets(ramp, undefined, 'kg')).toEqual([])
    expect(warmupSets(ramp, 0, 'kg')).toEqual([])
    expect(warmupSets(undefined, 60, 'kg')).toEqual([])
  })
  it('ramps from today’s working weight in plate steps', () => {
    expect(warmupSets(ramp, 100, 'kg').map((w) => w.weightKg)).toEqual([40, 60, 80])
    expect(warmupSets(ramp, 62.5, 'kg').map((w) => w.weightKg)).toEqual([25, 37.5, 50])
  })
  it('uses 5 lb steps for lb lifters', () => {
    const lb = warmupSets(ramp, 45.36, 'lb').map((w) => kgToDisplay(w.weightKg, 'lb')) // 100 lb
    expect(lb).toEqual([40, 60, 80])
  })
  it('drops duplicate rounded weights at light loads', () => {
    const out = warmupSets(ramp, 10, 'kg')
    const weights = out.map((w) => w.weightKg)
    expect(new Set(weights).size).toBe(weights.length)
  })
})
