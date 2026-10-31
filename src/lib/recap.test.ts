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
    db.mealLogs.clear(),
    db.checkIns.clear(),
    db.waterLogs.clear(),
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

describe('generateWeeklyRecap: protein and sleep', () => {
  it('says nothing about them until something is logged', async () => {
    await db.workoutSessions.add(done(daysAgoISO(1)))
    const text = await generateWeeklyRecap()
    expect(text).not.toMatch(/protein|slept/i)
  })

  it('mentions the protein average (with the target) and sleep, locally, with no opt-in needed', async () => {
    await db.workoutSessions.add(done(daysAgoISO(1)))
    await db.profile.toCollection().modify({ proteinTargetG: 140 }) // no aiCoachIncludeHealth: this never leaves the device
    await db.mealLogs.bulkAdd([
      { date: todayISODate(), name: 'a', servings: 1, loggedAt: 1, calories: 500, proteinG: 120, carbsG: 0, fatG: 0 },
      { date: daysAgoISO(1), name: 'b', servings: 1, loggedAt: 2, calories: 500, proteinG: 100, carbsG: 0, fatG: 0 },
    ])
    await db.checkIns.add({ date: todayISODate(), sleepHours: 7, soreness: 1, energy: 3, createdAt: 1 })
    const text = await generateWeeklyRecap()
    expect(text).toContain('Protein averaged 110 g across 2 logged days (target 140 g).')
    expect(text).toContain('You slept about 7 h on the 1 night you checked in.')
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

  it('never includes the nutrition / recovery summary unless the person opted in', async () => {
    await db.mealLogs.add({ date: todayISODate(), name: 'Paneer', servings: 1, loggedAt: 1, calories: 265, proteinG: 18, carbsG: 1, fatG: 21 })
    await db.checkIns.add({ date: todayISODate(), sleepHours: 7, soreness: 1, energy: 3, createdAt: 1 })
    const payload = await buildWeeklyReviewPayload()
    expect('wellbeing' in payload).toBe(false)
    expect(JSON.stringify(payload)).not.toMatch(/Paneer|sleep|protein/i)
  })

  it('adds averages only (no food names) once they opt in, and it still passes the shared schema', async () => {
    await db.profile.toCollection().modify({ aiCoachIncludeHealth: true, proteinTargetG: 140 })
    await db.mealLogs.bulkAdd([
      { date: todayISODate(), name: 'Paneer curry', servings: 1, loggedAt: 1, calories: 600, proteinG: 40, carbsG: 30, fatG: 30 },
      { date: daysAgoISO(1), name: 'Dal', servings: 1, loggedAt: 2, calories: 400, proteinG: 20, carbsG: 50, fatG: 8 },
    ])
    await db.checkIns.add({ date: todayISODate(), sleepHours: 7, soreness: 2, energy: 3, createdAt: 1 })
    await db.waterLogs.add({ date: todayISODate(), ml: 1500, loggedAt: 1 })
    const payload = await buildWeeklyReviewPayload({ focus: 'next-week' })
    expect(weeklyReviewSchema.safeParse(payload).success).toBe(true)
    expect(payload.focus).toBe('next-week')
    expect(payload.wellbeing).toEqual({
      nutrition: { daysLogged: 2, avgProteinG: 30, avgCalories: 500, proteinTargetG: 140 },
      recovery: { checkIns: 1, avgSleepHours: 7, avgSoreness: 2, avgEnergy: 3 },
      hydration: { daysLogged: 1, avgMl: 1500 },
    })
    expect(JSON.stringify(payload)).not.toMatch(/Paneer|Dal/)
  })

  it('omits the section entirely when they opted in but have logged nothing', async () => {
    await db.profile.toCollection().modify({ aiCoachIncludeHealth: true })
    expect('wellbeing' in (await buildWeeklyReviewPayload())).toBe(false)
  })

  it('maps unknown skip reasons to "unspecified" so a damaged row can’t fail validation', async () => {
    await db.workoutSessions.add(
      done(daysAgoISO(1), { skips: [{ exerciseId: 'dumbbell-row', reason: 'bogus' as never }] }),
    )
    const payload = await buildWeeklyReviewPayload()
    expect(payload.skips[0]?.reason).toBe('unspecified')
  })
})
