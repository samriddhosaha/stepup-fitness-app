import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { StepUpDB } from './schema'

async function seedV1(name: string) {
  const v1 = new Dexie(name)
  v1.version(1).stores({
    profile: '++id, createdAt',
    plans: '++id, createdAt',
    exercises: 'id, movementPattern, substitutionGroupId',
    workoutSessions: '++id, date, completedAt',
    progressSnapshots: '++id, date',
    personalRecords: '++id, exerciseId, achievedAt',
    xpEvents: '++id, type, occurredAt',
    appEvents: '++id, name, occurredAt',
  })
  await v1.open()
  await v1.table('profile').add({ name: 'Old', onboardingCompleted: true, createdAt: 1 })
  await v1.table('exercises').add({ id: 'back-squat', name: 'Back Squat' })
  await v1.table('personalRecords').add({ exerciseId: 'back-squat', value: 60, reps: 5, achievedAt: 5 })
  await v1.table('workoutSessions').bulkAdd([
    {
      date: '2026-01-01',
      planSessionName: 'A',
      startedAt: 1,
      completedAt: 2,
      skips: [],
      exercises: [{ exerciseId: 'back-squat', sets: [{ setIndex: 0, weightKg: 50, reps: 8, rpe: 3 }] }],
    },
    {
      date: '2026-01-08',
      planSessionName: 'A',
      startedAt: 10,
      completedAt: 20,
      skips: [],
      exercises: [
        {
          exerciseId: 'back-squat',
          sets: [
            { setIndex: 0, weightKg: 55, reps: 8, rpe: 3 },
            { setIndex: 1, weightKg: 55, reps: 7, rpe: 4 },
          ],
        },
      ],
    },
    // abandoned session must not feed progression
    { date: '2026-01-09', planSessionName: 'B', startedAt: 30, skips: [], exercises: [{ exerciseId: 'deadlift', sets: [{ setIndex: 0, weightKg: 100, reps: 5 }] }] },
  ])
  v1.close()
}

describe('schema v1 → v2 migration', () => {
  it('keeps existing data, backfills exerciseState from completed sessions, and clears the dead exercises table', async () => {
    await seedV1('mig-test')
    const db = new StepUpDB('mig-test')
    await db.open()

    expect(db.verno).toBe(2)
    expect((await db.profile.toArray())[0]?.name).toBe('Old')
    expect(await db.workoutSessions.count()).toBe(3)
    expect(await db.personalRecords.count()).toBe(1)
    expect(await db.exercises.count()).toBe(0)

    const states = await db.exerciseState.toArray()
    expect(states.map((s) => s.exerciseId)).toEqual(['back-squat'])
    expect(states[0]).toMatchObject({ workingWeightKg: 55, lastReps: [8, 7], lastDate: '2026-01-08', consecutiveFails: 0 })

    // new tables are usable
    await db.settings.put({ key: 'installToken', value: 'x' })
    await db.weeklyReviews.put({ weekKey: '2026-01-05', payloadHash: 'h', text: 't', createdAt: 1 })
    expect((await db.settings.get('installToken'))?.value).toBe('x')
    db.close()
  })

  it('opens a brand-new database at v2', async () => {
    const db = new StepUpDB('fresh-test')
    await db.open()
    expect(db.verno).toBe(2)
    expect(await db.exerciseState.count()).toBe(0)
    db.close()
  })
})
