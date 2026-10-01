import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { applyBackup, buildBackup, parseBackup, sessionsToCsv } from './backup'
import type { Profile, WorkoutSession } from '../db/types'

const profile: Profile = {
  name: 'Sam',
  fitnessLevel: 'regular',
  liftsAlready: true,
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
}

const session = (date: string, weightKg = 20): Omit<WorkoutSession, 'id'> => ({
  date,
  planSessionName: 'Full Body A',
  exercises: [{ exerciseId: 'goblet-squat', sets: [{ setIndex: 0, weightKg, reps: 8, rpe: 3 }] }],
  skips: [],
  startedAt: 10,
  completedAt: 20,
})

async function seed() {
  await db.profile.add(profile)
  await db.workoutSessions.bulkAdd([session('2026-01-05'), session('2026-01-12', 22.5)])
  await db.exerciseState.put({ exerciseId: 'goblet-squat', workingWeightKg: 22.5, lastReps: [8], lastDate: '2026-01-12', consecutiveFails: 0, updatedAt: 5 })
}

async function wipe() {
  await Promise.all([
    db.profile.clear(),
    db.plans.clear(),
    db.workoutSessions.clear(),
    db.progressSnapshots.clear(),
    db.personalRecords.clear(),
    db.xpEvents.clear(),
    db.appEvents.clear(),
    db.exerciseState.clear(),
  ])
}

beforeEach(wipe)

const roundTrip = async () => JSON.stringify(await buildBackup())

describe('parseBackup', () => {
  it('accepts a valid export and summarises it', async () => {
    await seed()
    const r = parseBackup(await roundTrip())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.summary).toMatchObject({ workouts: 2, firstDate: '2026-01-05', lastDate: '2026-01-12', profileName: 'Sam' })
    }
  })

  it.each([
    ['not JSON', 'hello'],
    ['JSON without a version', '{"tables":{}}'],
    ['an array', '[1,2,3]'],
    ['null', 'null'],
  ])('rejects %s with a friendly message', (_n, text) => {
    const r = parseBackup(text)
    expect(r).toEqual({ ok: false, error: 'This file doesn’t look like a StepUp backup.' })
  })

  it('rejects a newer version', () => {
    const r = parseBackup(JSON.stringify({ version: 99, exportedAt: 1, tables: {} }))
    expect(r.ok === false && r.error).toMatch(/newer version/)
  })

  it('rejects partial files (missing tables)', () => {
    const r = parseBackup(JSON.stringify({ version: 2, exportedAt: 1, tables: { profile: [] } }))
    expect(r.ok).toBe(false)
  })

  it('rejects damaged rows and names where', async () => {
    await seed()
    const b = JSON.parse(await roundTrip())
    b.tables.workoutSessions[0].date = 'yesterday'
    const r = parseBackup(JSON.stringify(b))
    expect(r.ok === false && r.error).toMatch(/damaged.*workoutSessions/)
  })

  it('rejects out-of-range values', async () => {
    await seed()
    const b = JSON.parse(await roundTrip())
    b.tables.workoutSessions[0].exercises[0].sets[0].reps = 99999
    expect(parseBackup(JSON.stringify(b)).ok).toBe(false)
  })

  it('upgrades a v1 file by rebuilding exerciseState from history', async () => {
    await seed()
    const b = JSON.parse(await roundTrip())
    b.version = 1
    delete b.tables.exerciseState
    const r = parseBackup(JSON.stringify(b))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.backup.tables.exerciseState).toHaveLength(1)
      expect(r.backup.tables.exerciseState?.[0]).toMatchObject({ exerciseId: 'goblet-squat', workingWeightKg: 22.5 })
    }
  })
})

describe('applyBackup', () => {
  it('round-trips: export, wipe, restore gives the same data', async () => {
    await seed()
    const before = await buildBackup()
    const parsed = parseBackup(JSON.stringify(before))
    expect(parsed.ok).toBe(true)
    await wipe()
    if (parsed.ok) await applyBackup(parsed.backup)
    const after = await buildBackup()
    expect({ ...after, exportedAt: 0 }).toEqual({ ...before, exportedAt: 0 })
  })

  it('a failed import leaves existing data untouched', async () => {
    await seed()
    const sessionsBefore = await db.workoutSessions.toArray()
    const bad = JSON.parse(await roundTrip())
    // duplicate primary keys make bulkAdd throw inside the transaction
    bad.tables.workoutSessions = [
      { ...bad.tables.workoutSessions[0], id: 7 },
      { ...bad.tables.workoutSessions[1], id: 7 },
    ]
    bad.tables.profile[0].name = 'Replaced'
    const parsed = parseBackup(JSON.stringify(bad))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) await expect(applyBackup(parsed.backup)).rejects.toThrow()

    expect(await db.workoutSessions.toArray()).toEqual(sessionsBefore)
    expect((await db.profile.toArray())[0]?.name).toBe('Sam')
    expect(await db.exerciseState.count()).toBe(1)
  })
})

describe('sessionsToCsv', () => {
  it('writes one row per set with kg weights and escapes awkward text', () => {
    const csv = sessionsToCsv(
      [{ ...session('2026-01-05'), exercises: [{ exerciseId: 'x', sets: [{ setIndex: 0, weightKg: 20, reps: 8, rpe: 3, note: 'felt "great", easy' }] }] } as WorkoutSession],
      () => 'Goblet, Squat',
    )
    const [header, row] = csv.trim().split('\n')
    expect(header).toBe('date,session,exercise,set,weight_kg,reps,duration_seconds,rpe,note')
    expect(row).toBe('2026-01-05,Full Body A,"Goblet, Squat",1,20,8,,3,"felt ""great"", easy"')
  })

  it('skips sessions that were never completed', () => {
    const open = { ...session('2026-01-05'), completedAt: undefined } as WorkoutSession
    expect(sessionsToCsv([open]).trim().split('\n')).toHaveLength(1)
  })
})
