import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import {
  discardAndStart,
  finishSession,
  getInProgressSession,
  logSet,
  startSession,
  swapExercise,
  setCurrentIndex,
  STALE_SESSION_MS,
} from './workout'
import { getTotalXP } from './xp'
import type { PlanSession } from '../db/types'

const lower: PlanSession = {
  name: 'Lower',
  type: 'lower-body',
  dayIndex: 0,
  exercises: [
    { exerciseId: 'goblet-squat', targetSets: 2, targetRepsLow: 6, targetRepsHigh: 10, startingLoadKg: 16 },
    { exerciseId: 'dumbbell-rdl', targetSets: 2, targetRepsLow: 6, targetRepsHigh: 10, startingLoadKg: 16 },
  ],
}
const upper: PlanSession = { ...lower, name: 'Upper', type: 'upper-body' }

async function reset() {
  await Promise.all([
    db.workoutSessions.clear(),
    db.personalRecords.clear(),
    db.xpEvents.clear(),
    db.exerciseState.clear(),
  ])
}
const totalXP = async () => getTotalXP(await db.xpEvents.toArray())

async function newSession(plan = lower) {
  const r = await startSession(plan)
  if (r.status === 'conflict') throw new Error('conflict')
  return r.id
}

beforeEach(reset)

describe('startSession', () => {
  it('snapshots the plan, order and index on the session row', async () => {
    const id = await newSession()
    const s = await db.workoutSessions.get(id)
    expect(s).toMatchObject({
      exerciseOrder: ['goblet-squat', 'dumbbell-rdl'],
      currentIndex: 0,
      plannedDayIndex: 0,
      swapMap: {},
    })
    expect(s?.plannedSnapshot).toHaveLength(2)
  })

  it('resumes the same fresh session instead of creating another', async () => {
    const a = await startSession(lower)
    const b = await startSession(lower)
    expect(a.status).toBe('started')
    expect(b).toEqual({ status: 'resumed', id: (a as { id: number }).id })
    expect(await db.workoutSessions.count()).toBe(1)
  })

  it('returns a conflict for a different plan session, and for a stale one', async () => {
    await startSession(lower)
    expect((await startSession(upper)).status).toBe('conflict')
    const later = Date.now() + STALE_SESSION_MS + 1000
    expect((await startSession(lower, later)).status).toBe('conflict')
  })

  it('discardAndStart replaces the open session', async () => {
    const first = await newSession(lower)
    const second = await discardAndStart(upper)
    expect(second).not.toBe(first)
    expect((await getInProgressSession())?.planSessionName).toBe('Upper')
    expect(await db.workoutSessions.count()).toBe(1)
  })

  it('persists swaps and position so a reload restores them', async () => {
    const id = await newSession()
    await swapExercise(id, 0, 'bodyweight-squat')
    await setCurrentIndex(id, 1)
    const s = await db.workoutSessions.get(id)
    expect(s?.exerciseOrder).toEqual(['bodyweight-squat', 'dumbbell-rdl'])
    expect(s?.swapMap).toEqual({ 'bodyweight-squat': 'goblet-squat' })
    expect(s?.currentIndex).toBe(1)
  })
})

describe('logSet', () => {
  it('rejects a blank set', async () => {
    const id = await newSession()
    expect(await logSet(id, 'goblet-squat', { setIndex: 0, weightKg: 16 })).toEqual({ ok: false, reason: 'incomplete' })
    expect(await totalXP()).toBe(0)
  })

  it('rejects out-of-range reps and loads', async () => {
    const id = await newSession()
    expect((await logSet(id, 'goblet-squat', { setIndex: 0, reps: 500 })).ok).toBe(false)
    expect((await logSet(id, 'goblet-squat', { setIndex: 0, reps: 5, weightKg: 9000 })).ok).toBe(false)
  })

  it('a double-tap logs exactly one set and one set of XP', async () => {
    const id = await newSession()
    const set = { setIndex: 0, weightKg: 16, reps: 8 }
    const results = await Promise.all([logSet(id, 'goblet-squat', set), logSet(id, 'goblet-squat', set)])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect((await db.workoutSessions.get(id))?.exercises[0]?.sets).toHaveLength(1)
    expect(await totalXP()).toBe(5)
  })

  it('consecutive sets are all kept', async () => {
    const id = await newSession()
    await logSet(id, 'goblet-squat', { setIndex: 0, weightKg: 16, reps: 8 })
    await logSet(id, 'goblet-squat', { setIndex: 1, weightKg: 16, reps: 8 })
    expect((await db.workoutSessions.get(id))?.exercises[0]?.sets).toHaveLength(2)
  })
})

describe('finishSession', () => {
  async function loggedSession(weightKg = 16, reps = 8) {
    const id = await newSession()
    await logSet(id, 'goblet-squat', { setIndex: 0, weightKg, reps, rpe: 3 })
    await logSet(id, 'goblet-squat', { setIndex: 1, weightKg, reps, rpe: 3 })
    return id
  }

  it('blocks a session with zero logged sets', async () => {
    const id = await newSession()
    expect(await finishSession(id, true)).toEqual({ status: 'empty' })
    expect((await db.workoutSessions.get(id))?.completedAt).toBeUndefined()
    expect(await totalXP()).toBe(0)
  })

  it('is idempotent: finishing twice awards once', async () => {
    const id = await loggedSession()
    const first = await finishSession(id, false)
    const xpAfterFirst = await totalXP()
    const second = await finishSession(id, false)
    expect(first.status).toBe('completed')
    expect(second.status).toBe('already-complete')
    expect(await totalXP()).toBe(xpAfterFirst)
  })

  it('concurrent finishes award once', async () => {
    const id = await loggedSession()
    await Promise.all([finishSession(id, false), finishSession(id, false)])
    const workoutEvents = (await db.xpEvents.toArray()).filter((e) => e.type === 'workout')
    expect(workoutEvents).toHaveLength(1)
  })

  it('the first log of a lift is a silent baseline, not a PR', async () => {
    const id = await loggedSession()
    const res = await finishSession(id, false)
    expect(res).toEqual({ status: 'completed', prs: [] })
    const records = await db.personalRecords.toArray()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ baseline: true, sessionId: id, kind: 'e1rm' })
    expect((await db.xpEvents.toArray()).some((e) => e.type === 'pr')).toBe(false)
  })

  it('a later improvement is a PR stored with its sessionId, and awards PR XP once', async () => {
    await finishSession(await loggedSession(16, 8), false)
    const id2 = await loggedSession(20, 8)
    const res = await finishSession(id2, false)
    expect(res.status === 'completed' && res.prs).toHaveLength(1)
    const pr = (await db.personalRecords.toArray()).find((r) => !r.baseline)
    expect(pr).toMatchObject({ sessionId: id2, kind: 'e1rm' })
    expect((await db.xpEvents.toArray()).filter((e) => e.type === 'pr')).toHaveLength(1)
  })

  it('a repeat of the same performance is not a PR', async () => {
    await finishSession(await loggedSession(16, 8), false)
    const res = await finishSession(await loggedSession(16, 8), false)
    expect(res).toEqual({ status: 'completed', prs: [] })
  })

  it('updates exerciseState with the weight actually lifted', async () => {
    await finishSession(await loggedSession(24, 8), false)
    expect(await db.exerciseState.get('goblet-squat')).toMatchObject({ workingWeightKg: 24, lastReps: [8, 8] })
  })

  it('swapped exercises get their own state and complete their planned slot for XP', async () => {
    const id = await newSession()
    await swapExercise(id, 0, 'bodyweight-squat')
    await logSet(id, 'bodyweight-squat', { setIndex: 0, reps: 15 }, 'goblet-squat')
    await logSet(id, 'bodyweight-squat', { setIndex: 1, reps: 15 }, 'goblet-squat')
    await finishSession(id, false)
    expect(await db.exerciseState.get('bodyweight-squat')).toBeDefined()
    expect(await db.exerciseState.get('goblet-squat')).toBeUndefined()
    const xp = await db.xpEvents.toArray()
    expect(xp.filter((e) => e.type === 'exercise')).toHaveLength(1) // 2 of 2 target sets
  })

  it('works after the plan changes mid-session (uses the snapshot)', async () => {
    const id = await loggedSession()
    await db.plans.clear() // plan rebuilt/removed
    expect((await finishSession(id, false)).status).toBe('completed')
  })
})
