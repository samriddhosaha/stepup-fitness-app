import { describe, expect, it } from 'vitest'
import { DEFAULT_PLATES, calculatePlates, describePlates } from './plates'

describe('calculatePlates', () => {
  it('loads an exact weight, heaviest plates first, per side', () => {
    const load = calculatePlates(100, 20, DEFAULT_PLATES.kg) // 40 per side
    expect(load.perSide).toEqual([25, 15])
    expect(load.achieved).toBe(100)
    expect(load.shortBy).toBe(0)
  })

  it('uses the small plates for fine jumps without float drift', () => {
    const load = calculatePlates(62.5, 20, DEFAULT_PLATES.kg) // 21.25 per side
    expect(load.perSide).toEqual([20, 1.25])
    expect(load.achieved).toBe(62.5)
  })

  it('works in pounds with a 45 lb bar', () => {
    const load = calculatePlates(135, 45, DEFAULT_PLATES.lb)
    expect(load.perSide).toEqual([45])
    expect(load.achieved).toBe(135)
    expect(calculatePlates(225, 45, DEFAULT_PLATES.lb).perSide).toEqual([45, 45])
  })

  it('reports how far short it is when the plates cannot make the target', () => {
    const load = calculatePlates(61, 20, DEFAULT_PLATES.kg) // 20.5 per side; smallest plate is 1.25
    expect(load.perSide).toEqual([20])
    expect(load.achieved).toBe(60)
    expect(load.shortBy).toBe(1)
  })

  it('is just the bar at the bar weight, and flags anything lighter', () => {
    expect(calculatePlates(20, 20, DEFAULT_PLATES.kg)).toMatchObject({ perSide: [], achieved: 20, shortBy: 0, belowBar: false })
    expect(calculatePlates(15, 20, DEFAULT_PLATES.kg)).toMatchObject({ perSide: [], achieved: 20, belowBar: true })
  })

  it('respects whatever plates it is given, in any order', () => {
    expect(calculatePlates(60, 20, [5, 10]).perSide).toEqual([10, 10])
  })
})

describe('describePlates', () => {
  it('joins plates or says just the bar', () => {
    expect(describePlates([20, 10, 1.25])).toBe('20 + 10 + 1.25')
    expect(describePlates([])).toBe('just the bar')
  })
})
