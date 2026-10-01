import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { generateWeeklyRecap } from './recap'
import { buildWeeklyReviewPayload } from './aiCoach'
import { weeklyReviewSchema } from '../../shared/weeklyReviewSchema'
import { daysAgoISO, todayISODate } from './format'
import type { Plan, WorkoutSession } from '../db/types'

const plan: Plan = {
  createdAt: 1,
  volumeUneven: false,
  sessions: [
    {
      name: 'Full Body A',
      type: 'full-body-a',
      dayIndex: 0,
      exercises: [{ exerciseId: 'goblet-squat', targetSets: 3, targetRepsLow: 6, targetRepsHigh: 10, startingLoadKg: 16 }],
    },
    { name: 'Full Body B', type: 'full-body-b', dayIndex: 2, exercises: [] },
    { name: 'Full Body C', type: 'full-body-c', dayIndex: 4, exercises: [] },
  ],
}

const done = (date: string, over: Partial<WorkoutSession> = {}): Omit<WorkoutSession, 'id'> => ({
  date,
  planSessionName: 'Full Body A',
  exercises: [
    {
      exerciseId: 'goblet-squat',
      sets: [
        { setIndex: 0, weightKg: 16, reps: 10, rpe: 2 },
        { setIndex: 1, weightKg: 16, reps: 10, rpe: 3 },
      ],
    },
  ],
  skips: [],
  startedAt: 1,
  completedAt: 2,
  ...over,
})

beforeEach(async () => {
  await Promise.all([
    db.plans.clear(),
    db.workoutSessions.clear(),
    db.personalRecords.clear(),
    db.progressSnapshots.clear(),
    db.profile.clear(),
  ])
  await db.plans.add(plan)
  await db.profile.add({
    name: 'T',
    fitnessLevel: 'new',
    liftsAlready: false,
    doesCardioAlready: false,
    primaryGoal: 'build-muscle',
    daysPerWeek: 3,
    sessionLengthMinutes: 45,
    equipment: ['dumbbells'],
    trainingPreferences: [],
    weightUnit: 'kg',
    appearance: 'system',
    onboardingCompleted: true,
    createdAt: 1,
  })
})

describe('generateWeeklyRecap', () => {
  it('reports completed vs planned sessions', async () => {
    await db.workoutSessions.add(done(daysAgoISO(1)))
    expect(await generateWeeklyRecap()).toBe('This week you completed 1/3 sessions.')
  })

  it('mentions real PRs but not silent baselines', async () => {
    await db.workoutSessions.add(done(daysAgoISO(1)))
    await db.personalRecords.bulkAdd([
      { exerciseId: 'goblet-squat', value: 22, reps: 10, achievedAt: Date.now(), baseline: true },
      { exerciseId: 'dumbbell-row', value: 30, reps: 8, achievedAt: Date.now() },
    ])
    const recap = await generateWeeklyRecap()
    expect(recap).toContain('hit a PR on Dumbbell Row')
    expect(recap).not.toContain('Goblet Squat')
  })

  it('names the most-skipped exercise, its reason and a swap', async () => {
    await db.workoutSessions.add(
      done(daysAgoISO(2), { skips: [{ exerciseId: 'goblet-squat', reason: 'equipment-not-free' }] }),
    )
    const recap = await generateWeeklyRecap()
    expect(recap).toMatch(/skipped Goblet Squat 1 time citing equipment not being free/)
    expect(recap).toContain('consider swapping to')
  })
})

describe('buildWeeklyReviewPayload', () => {
  it('sends exercise IDs (never names) and passes the shared schema', async () => {
    await db.workoutSessions.add(done(daysAgoISO(1), { skips: [{ exerciseId: 'dumbbell-row', reason: 'too-difficult' }] }))
    await db.personalRecords.add({ exerciseId: 'goblet-squat', value: 22, reps: 10, achievedAt: Date.now() })
    await db.progressSnapshots.bulkAdd([
      { date: daysAgoISO(5), bodyWeightKg: 80 },
      { date: daysAgoISO(1), bodyWeightKg: 79.5 },
    ])
    const payload = await buildWeeklyReviewPayload()
    expect(weeklyReviewSchema.safeParse(payload).success).toBe(true)
    expect(payload).toMatchObject({
      sessionsCompleted: 1,
      sessionsPlanned: 3,
      exercises: [{ exerciseId: 'goblet-squat', totalSets: 2, metTargetRange: true }],
      skips: [{ exerciseId: 'dumbbell-row', reason: 'too-difficult', count: 1 }],
      prs: [{ exerciseId: 'goblet-squat', value: 22 }],
      bodyWeightTrendKg: { start: 80, end: 79.5 },
    })
    expect(JSON.stringify(payload)).not.toContain('Goblet Squat')
  })

  it('leaves out baselines and has no body-weight trend with one reading', async () => {
    await db.personalRecords.add({ exerciseId: 'goblet-squat', value: 22, reps: 10, achievedAt: Date.now(), baseline: true })
    await db.progressSnapshots.add({ date: todayISODate(), bodyWeightKg: 80 })
    const payload = await buildWeeklyReviewPayload()
    expect(payload.prs).toEqual([])
    expect(payload.bodyWeightTrendKg).toBeNull()
  })

  it('maps unknown skip reasons to "unspecified" so a damaged row can’t fail validation', async () => {
    await db.workoutSessions.add(
      done(daysAgoISO(1), { skips: [{ exerciseId: 'dumbbell-row', reason: 'bogus' as never }] }),
    )
    const payload = await buildWeeklyReviewPayload()
    expect(payload.skips[0]?.reason).toBe('unspecified')
  })
})
