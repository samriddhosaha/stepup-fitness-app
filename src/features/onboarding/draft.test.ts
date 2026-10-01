import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { generatePlan } from '../../lib/plan'
import { AGE_GATE } from '../../lib/validation'
import {
  INITIAL_DRAFT,
  STEPS,
  ageError,
  clearDraft,
  explainPlan,
  loadDraft,
  needsGentleStart,
  needsGuardianNote,
  saveDraft,
  stepValid,
  toProfile,
  type OnboardingDraft,
} from './draft'

const draft = (over: Partial<OnboardingDraft> = {}): OnboardingDraft => ({
  ...INITIAL_DRAFT,
  name: 'Sam',
  age: 30,
  fitnessLevel: 'new',
  primaryGoal: 'build-muscle',
  equipment: ['dumbbells'],
  ...over,
})

describe('flow', () => {
  it('has a long path and a three-question quick path', () => {
    expect(STEPS.quick).toHaveLength(3)
    expect(STEPS.full.length).toBeGreaterThan(8)
    expect(STEPS.full.at(-1)).toBe('review')
    expect(STEPS.full).toContain('readiness')
  })
})

describe('age gate', () => {
  it('is one constant: 16', () => expect(AGE_GATE).toBe(16))

  it('asks 13–15 year olds to involve a parent or guardian, and blocks under 13', () => {
    expect(needsGuardianNote(15)).toBe(true)
    expect(needsGuardianNote(16)).toBe(false)
    expect(ageError(12)).toMatch(/13 and up/)
    expect(ageError(30)).toBeNull()
    expect(stepValid('basics', draft({ age: 14 }))).toBe(false)
    expect(stepValid('basics', draft({ age: 14, guardianAck: true }))).toBe(true)
    expect(stepValid('basics', draft({ age: 12, guardianAck: true }))).toBe(false)
    expect(stepValid('basics', draft({ age: undefined }))).toBe(false)
  })
})

describe('step validation', () => {
  it('requires what the plan needs', () => {
    expect(stepValid('name', draft({ name: '   ' }))).toBe(false)
    expect(stepValid('name', draft())).toBe(true)
    expect(stepValid('level', draft({ fitnessLevel: undefined }))).toBe(false)
    expect(stepValid('goals', draft({ primaryGoal: undefined }))).toBe(false)
    expect(stepValid('equipment', draft({ equipment: [] }))).toBe(false)
    expect(stepValid('schedule', draft({ trainingDays: [] }))).toBe(false)
    expect(stepValid('schedule', draft({ trainingDays: [0, 1, 2, 3, 4, 5, 6] }))).toBe(false)
    expect(stepValid('schedule', draft({ trainingDays: [1, 3] }))).toBe(true)
    expect(stepValid('preferences', draft())).toBe(true)
  })

  it('checks height and weight in the chosen unit', () => {
    expect(stepValid('basics', draft({ heightCm: 90 }))).toBe(false)
    expect(stepValid('basics', draft({ weightInput: '20', weightUnit: 'kg' }))).toBe(false)
    expect(stepValid('basics', draft({ weightInput: '150', weightUnit: 'lb' }))).toBe(true)
    expect(stepValid('basics', draft({ weightInput: '20', weightUnit: 'lb' }))).toBe(false)
  })
})

describe('toProfile', () => {
  it('converts weight to kg, derives days from the chosen weekdays and keeps structured injuries', () => {
    const p = toProfile(
      draft({ weightUnit: 'lb', weightInput: '165', trainingDays: [4, 0, 2], injuryAreas: ['knee'], injuriesNote: 'old ACL', exclusions: ' no burpees ' }),
      'full',
      5,
    )
    expect(p).toMatchObject({
      startingWeightKg: 74.84,
      weightUnit: 'lb',
      daysPerWeek: 3,
      trainingDays: [0, 2, 4],
      injuryAreas: ['knee'],
      injuries: 'old ACL',
      exclusions: 'no burpees',
      createdAt: 5,
      onboardingCompleted: true,
    })
  })

  it('quick start leaves out age and sensible defaults fill the rest', () => {
    const p = toProfile(draft({ age: 40, fitnessLevel: undefined, primaryGoal: undefined }), 'quick')
    expect(p.age).toBeUndefined()
    expect(p).toMatchObject({ fitnessLevel: 'new', primaryGoal: 'feel-better' })
  })

  it('a readiness "yes" starts gently, and that reaches the plan', () => {
    const d = draft({ readiness: { dizzy: 'yes', heart: 'no' }, equipment: ['full-gym'], fitnessLevel: 'experienced' })
    expect(needsGentleStart(d)).toBe(true)
    const p = toProfile(d, 'full')
    expect(p.gentleStart).toBe(true)
    for (const s of generatePlan(p).sessions) for (const e of s.exercises) expect(e.targetSets).toBeLessThanOrEqual(2)
    expect(toProfile(draft({ readiness: { dizzy: 'no' } }), 'full').gentleStart).toBeUndefined()
  })

  it('the plan it builds honours the injuries and days that were picked', () => {
    const p = toProfile(draft({ equipment: ['full-gym', 'dumbbells'], trainingDays: [1, 3, 5], injuryAreas: ['lower-back'], exclusions: 'no squats' }), 'full')
    const plan = generatePlan(p)
    expect(plan.sessions.map((s) => s.dayIndex)).toEqual([1, 3, 5])
  })
})

describe('explainPlan', () => {
  it('says why, in plain words, without promising what it does not do', () => {
    const lines = explainPlan(draft({ trainingDays: [0, 3], injuryAreas: ['shoulder'], exclusions: 'no lunges', primaryGoal: 'lift-heavier' }))
    const text = lines.join('\n')
    expect(text).toContain('2 days a week (Monday, Thursday)')
    expect(text).toMatch(/strength/i)
    expect(text).toMatch(/shoulders/)
    expect(text).toContain('no lunges')
    expect(text).not.toContain('!')
  })
})

describe('draft persistence', () => {
  beforeEach(async () => {
    await db.settings.clear()
  })

  it('saves and restores the draft and where the person was', async () => {
    expect(await loadDraft()).toBeUndefined()
    await saveDraft({ draft: draft({ name: 'Riley' }), step: 3, mode: 'full' })
    const back = await loadDraft()
    expect(back?.draft.name).toBe('Riley')
    expect(back?.step).toBe(3)
    expect(back?.mode).toBe('full')
    await clearDraft()
    expect(await loadDraft()).toBeUndefined()
  })

  it('tolerates a draft from an older shape and an out-of-range step', async () => {
    await db.settings.put({ key: 'onboardingDraft', value: { draft: { name: 'Old' }, step: 99, mode: 'quick' } })
    const back = await loadDraft()
    expect(back?.draft).toMatchObject({ name: 'Old', trainingDays: [0, 2, 4] })
    expect(back?.step).toBe(STEPS.quick.length - 1)
    await db.settings.put({ key: 'onboardingDraft', value: { draft: {}, step: 0, mode: 'nonsense' } })
    expect(await loadDraft()).toBeUndefined()
  })
})
