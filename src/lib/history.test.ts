import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { deleteCompletedSession, updateCompletedSet } from './workout'
import { deleteBodyWeight, saveBodyWeight, sevenDayAverage } from './bodyWeight'
import { liftsWithData, weeklyMuscleSets } from './progress'
import type { WorkoutSession } from '../db/types'

const session = (date: string, weightKg: number, reps: number, completedAt = 10): Omit<WorkoutSession, 'id'> => ({
  date,
  planSessionName: 'A',
  exercises: [{ exerciseId: 'goblet-squat', sets: [{ setIndex: 0, weightKg, reps }, { setIndex: 1, weightKg, reps }] }],
  skips: [],
  startedAt: 1,
  completedAt,
})

beforeEach(async () => {
  await Promise.all([
    db.workoutSessions.clear(),
    db.personalRecords.clear(),
    db.exerciseState.clear(),
    db.progressSnapshots.clear(),
  ])
})

describe('deleting and correcting finished workouts', () => {
  it('deleting a workout removes its PRs and re-derives progression from what remains', async () => {
    const a = (await db.workoutSessions.add(session('2026-01-05', 16, 8, 10))) as number
    const b = (await db.workoutSessions.add(session('2026-01-12', 24, 8, 20))) as number
    await db.personalRecords.bulkAdd([
      { exerciseId: 'goblet-squat', value: 20, reps: 8, achievedAt: 10, sessionId: a, baseline: true },
      { exerciseId: 'goblet-squat', value: 30, reps: 8, achievedAt: 20, sessionId: b },
    ])
    await db.exerciseState.put({ exerciseId: 'goblet-squat', workingWeightKg: 24, lastReps: [8, 8], lastDate: '2026-01-12', consecutiveFails: 0, updatedAt: 20 })

    await deleteCompletedSession(b)

    expect(await db.workoutSessions.count()).toBe(1)
    expect((await db.personalRecords.toArray()).map((r) => r.sessionId)).toEqual([a])
    expect(await db.exerciseState.get('goblet-squat')).toMatchObject({ workingWeightKg: 16, lastDate: '2026-01-05' })
  })

  it('deleting the only workout clears that exercise’s state', async () => {
    const a = (await db.workoutSessions.add(session('2026-01-05', 16, 8))) as number
    await db.exerciseState.put({ exerciseId: 'goblet-squat', workingWeightKg: 16, lastReps: [8], lastDate: '2026-01-05', consecutiveFails: 0, updatedAt: 1 })
    await deleteCompletedSession(a)
    expect(await db.exerciseState.get('goblet-squat')).toBeUndefined()
  })

  it('correcting a set updates the log and the progression state', async () => {
    const a = (await db.workoutSessions.add(session('2026-01-05', 16, 8))) as number
    expect(await updateCompletedSet(a, 'goblet-squat', 1, { weightKg: 20, reps: 10 })).toBe(true)
    const sets = (await db.workoutSessions.get(a))?.exercises[0]?.sets
    expect(sets?.[1]).toMatchObject({ weightKg: 20, reps: 10 })
    expect(await db.exerciseState.get('goblet-squat')).toMatchObject({ workingWeightKg: 20, lastReps: [8, 10] })
  })

  it('rejects out-of-range corrections and unknown sets', async () => {
    const a = (await db.workoutSessions.add(session('2026-01-05', 16, 8))) as number
    expect(await updateCompletedSet(a, 'goblet-squat', 0, { reps: 5000 })).toBe(false)
    expect(await updateCompletedSet(a, 'goblet-squat', 9, { reps: 5 })).toBe(false)
    expect(await updateCompletedSet(a, 'nope', 0, { reps: 5 })).toBe(false)
  })
})

describe('body weight', () => {
  it('keeps one reading per day (a second log replaces the first)', async () => {
    await saveBodyWeight('2026-03-01', 80)
    await saveBodyWeight('2026-03-01', 79.4)
    const rows = await db.progressSnapshots.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.bodyWeightKg).toBe(79.4)
  })

  it('tidies old duplicate rows for the same day', async () => {
    await db.progressSnapshots.bulkAdd([
      { date: '2026-03-01', bodyWeightKg: 80 },
      { date: '2026-03-01', bodyWeightKg: 81 },
    ])
    await saveBodyWeight('2026-03-01', 79)
    expect(await db.progressSnapshots.count()).toBe(1)
  })

  it('deletes a reading', async () => {
    await saveBodyWeight('2026-03-01', 80)
    const [row] = await db.progressSnapshots.toArray()
    await deleteBodyWeight(row!.id!)
    expect(await db.progressSnapshots.count()).toBe(0)
  })

  it('averages only the 7 days up to the end date', () => {
    const readings = [
      { date: '2026-02-20', bodyWeightKg: 90 }, // outside the window
      { date: '2026-02-26', bodyWeightKg: 80 },
      { date: '2026-03-01', bodyWeightKg: 82 },
      { date: '2026-03-03', bodyWeightKg: 84 }, // after the end date
    ]
    expect(sevenDayAverage(readings, '2026-03-01')).toBe(81)
    expect(sevenDayAverage(readings, '2026-01-01')).toBeUndefined()
  })
})

describe('progress queries', () => {
  it('lists lifts that have loaded sets, most recently trained first', async () => {
    await db.workoutSessions.bulkAdd([
      session('2026-01-05', 16, 8),
      {
        ...session('2026-01-12', 40, 5),
        exercises: [
          { exerciseId: 'back-squat', sets: [{ setIndex: 0, weightKg: 40, reps: 5 }] },
          { exerciseId: 'plank', sets: [{ setIndex: 0, reps: 30 }] }, // unloaded: not a lift
        ],
      },
    ])
    expect(await liftsWithData()).toEqual(['back-squat', 'goblet-squat'])
  })

  it('sums this week’s completed sets per primary muscle', async () => {
    await db.workoutSessions.bulkAdd([
      session('2026-09-29', 16, 8), // this week (Mon 28 Sep)
      session('2026-09-20', 16, 8), // last week: ignored
      { ...session('2026-09-30', 16, 8), completedAt: undefined }, // unfinished: ignored
    ])
    const rows = await weeklyMuscleSets('2026-10-01')
    expect(rows.find((r) => r.muscle === 'quads')?.sets).toBe(2)
    expect(rows.every((r) => r.sets === 2)).toBe(true)
  })
})
