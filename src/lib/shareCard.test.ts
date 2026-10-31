import { describe, expect, it } from 'vitest'
import { buildSummaryCardData, wrapText } from './shareCard'
import type { WorkoutSession } from '../db/types'

const session: WorkoutSession = {
  id: 1,
  date: '2026-10-31',
  planSessionName: 'Full Body A',
  startedAt: 1,
  completedAt: 2,
  durationSeconds: 2712,
  skips: [],
  exercises: [
    { exerciseId: 'goblet-squat', sets: [{ setIndex: 0, weightKg: 20, reps: 10 }, { setIndex: 1, weightKg: 24, reps: 8 }] },
    { exerciseId: 'push-up', sets: [{ setIndex: 0, reps: 15 }] },
    { exerciseId: 'plank', sets: [{ setIndex: 0, durationSeconds: 45 }] },
  ],
}
const name = (id: string) => ({ 'goblet-squat': 'Goblet Squat', 'push-up': 'Push-up', plank: 'Plank' })[id] ?? id

describe('buildSummaryCardData', () => {
  it('summarises time, sets and lifted volume, with each lift’s top set', () => {
    const d = buildSummaryCardData({ session, records: [], exerciseName: name, unit: 'kg' })
    expect(d.title).toBe('Full Body A')
    expect(d.stats).toEqual([
      { label: 'Time', value: '45:12' },
      { label: 'Sets', value: '4' },
      { label: 'Lifted', value: '392 kg' }, // 20*10 + 24*8
    ])
    expect(d.lifts).toEqual([
      { name: 'Goblet Squat', detail: '24 kg × 8 · 2 sets' },
      { name: 'Push-up', detail: 'best 15 reps · 1 set' },
      { name: 'Plank', detail: '1 set' },
    ])
  })

  it('shows pounds for lb users, and leaves out volume with no weights', () => {
    const lb = buildSummaryCardData({ session, records: [], exerciseName: name, unit: 'lb' })
    expect(lb.lifts[0]?.detail).toBe('52.9 lb × 8 · 2 sets')
    const bodyweight = buildSummaryCardData({ session: { ...session, exercises: [session.exercises[1]!] }, records: [], exerciseName: name, unit: 'kg' })
    expect(bodyweight.stats.map((s) => s.label)).toEqual(['Time', 'Sets'])
  })

  it('labels records the way the workout-complete screen does, and caps them at three', () => {
    const records = [
      { exerciseId: 'goblet-squat', kind: 'weight' as const, value: 24 },
      { exerciseId: 'push-up', kind: 'reps' as const, value: 15 },
      { exerciseId: 'plank', kind: 'time' as const, value: 45 },
      { exerciseId: 'goblet-squat', kind: 'e1rm' as const, value: 30 },
    ]
    const d = buildSummaryCardData({ session, records, exerciseName: name, unit: 'kg' })
    expect(d.records).toEqual(['Goblet Squat: 24 kg lifted', 'Push-up: 15 reps', 'Plank: 45 s hold'])
  })

  it('caps the lifts it lists at five and has no place for a person’s name', () => {
    const many = { ...session, exercises: Array.from({ length: 8 }, (_, i) => ({ exerciseId: `x${i}`, sets: [{ setIndex: 0, reps: 5 }] })) }
    const d = buildSummaryCardData({ session: many, records: [], exerciseName: (id) => id, unit: 'kg', streakLine: '3 weeks in a row' })
    expect(d.lifts).toHaveLength(5)
    expect(d.streakLine).toBe('3 weeks in a row')
    // there is no field a person's name could be in
    expect(Object.keys(d).sort()).toEqual(['dateLabel', 'lifts', 'records', 'stats', 'streakLine', 'title'])
  })

  it('formats the date in local time without shifting the day', () => {
    expect(buildSummaryCardData({ session, records: [], exerciseName: name, unit: 'kg' }).dateLabel).toMatch(/31/)
  })
})

describe('wrapText', () => {
  const measure = (t: string) => t.length * 10
  it('wraps greedily on words', () => {
    expect(wrapText(measure, 'one two three four', 90, 5)).toEqual(['one two', 'three', 'four'])
  })
  it('cuts with an ellipsis on the last allowed line', () => {
    const lines = wrapText(measure, 'alpha beta gamma delta epsilon', 60, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1]!.endsWith('…')).toBe(true)
    expect(lines.every((l) => measure(l) <= 60)).toBe(true)
  })
  it('never loops on a single word wider than the line', () => {
    expect(wrapText(measure, 'supercalifragilistic', 50, 3)).toEqual(['supercalifragilistic'])
  })
})
