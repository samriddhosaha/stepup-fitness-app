import { describe, expect, it } from 'vitest'
import {
  balancePlan,
  deloadDue,
  estimateCalibrationHintKg,
  estimateSessionMinutes,
  exerciseCountFor,
  generatePlan,
  planBalance,
  trainingDayIndices,
} from './plan'
import { inferInjuryAreas, matchesKeywords, parseExclusions } from './planning/constraints'
import { getExerciseById } from '../db/exerciseLibrary'
import type { Equipment, FitnessLevel, InjuryArea, Plan, PrimaryGoal, Profile } from '../db/types'

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    name: 'Test',
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
    ...overrides,
  }
}

const exercisesOf = (plan: Plan) => plan.sessions.flatMap((s) => s.exercises.map((pe) => ({ pe, ex: getExerciseById(pe.exerciseId)! })))

const EQUIPMENT_SETS: Equipment[][] = [
  ['none'],
  ['bands'],
  ['dumbbells'],
  ['bench-rack'],
  ['full-gym'],
  ['dumbbells', 'bands'],
  ['none', 'dumbbells', 'bands', 'bench-rack', 'full-gym'],
]
const LEVELS: FitnessLevel[] = ['new', 'regular', 'experienced']
const GOALS: PrimaryGoal[] = ['build-muscle', 'lift-heavier', 'lean-out', 'go-longer', 'feel-better']
const INJURY_SETS: InjuryArea[][] = [[], ['lower-back'], ['knee', 'shoulder'], ['lower-back', 'knee', 'shoulder', 'wrist-elbow', 'neck', 'hip']]

describe('generatePlan: invariants across the whole input space', () => {
  const plans: { p: Profile; plan: Plan }[] = []
  for (const equipment of EQUIPMENT_SETS)
    for (const daysPerWeek of [1, 2, 3, 4, 5, 6])
      for (const fitnessLevel of LEVELS)
        for (const primaryGoal of GOALS)
          for (const injuryAreas of INJURY_SETS) {
            const p = profile({ equipment, daysPerWeek, fitnessLevel, primaryGoal, injuryAreas })
            plans.push({ p, plan: generatePlan(p) })
          }

  it('produced a plan for every combination', () => {
    expect(plans.length).toBe(7 * 6 * 3 * 5 * 4)
  })

  it('never leaves a session empty', () => {
    for (const { p, plan } of plans) {
      for (const s of plan.sessions) {
        expect(s.exercises.length, `${JSON.stringify([p.equipment, p.daysPerWeek, p.fitnessLevel, p.primaryGoal, p.injuryAreas])} ${s.name}`).toBeGreaterThan(0)
      }
    }
  })

  it('never includes an exercise that aggravates a declared injury', () => {
    for (const { p, plan } of plans) {
      for (const { ex } of exercisesOf(plan)) {
        const clash = ex.contraindications.filter((a) => p.injuryAreas?.includes(a))
        expect(clash, `${ex.id} for ${p.injuryAreas}`).toEqual([])
      }
    }
  })

  it('only uses equipment the person has (or bodyweight)', () => {
    for (const { p, plan } of plans) {
      for (const { ex } of exercisesOf(plan)) {
        expect(ex.equipmentRequired.some((e) => e === 'none' || p.equipment.includes(e)), ex.id).toBe(true)
      }
    }
  })

  it('beginners only get beginner-friendly movements, never skill 3', () => {
    for (const { p, plan } of plans.filter((x) => x.p.fitnessLevel === 'new')) {
      for (const { ex } of exercisesOf(plan)) {
        expect(ex.skill, `${ex.id}`).toBeLessThan(3)
        expect(ex.id).not.toBe('deadlift')
      }
      if (p.injuryAreas?.length === 0) {
        for (const { ex } of exercisesOf(plan)) expect(ex.beginnerFriendly, ex.id).toBe(true)
      }
    }
  })

  it('has no duplicate exercise within a session', () => {
    for (const { plan } of plans) {
      for (const s of plan.sessions) {
        const ids = s.exercises.map((e) => e.exerciseId)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })

  it('schedules one session per training day, on distinct weekdays', () => {
    for (const { p, plan } of plans) {
      expect(plan.sessions.length).toBe(p.daysPerWeek)
      const d = plan.sessions.map((s) => s.dayIndex)
      expect(new Set(d).size).toBe(d.length)
    }
  })
})

describe('generatePlan: honouring what people tell us', () => {
  it('E2 from the audit: bad lower back, no deadlifts, no squats, bodyweight preference, 30 min, rack or gym', () => {
    for (const equipment of [['bench-rack'], ['full-gym']] as Equipment[][]) {
      const plan = generatePlan(
        profile({
          age: 45,
          fitnessLevel: 'regular',
          equipment,
          injuries: 'bad lower back, no deadlifts',
          exclusions: 'no squats',
          trainingPreferences: ['bodyweight'],
          sessionLengthMinutes: 30,
        }),
      )
      for (const { ex } of exercisesOf(plan)) {
        expect(ex.contraindications, ex.id).not.toContain('lower-back')
        expect(ex.name.toLowerCase(), ex.id).not.toMatch(/squat|deadlift/)
        expect(['back-squat', 'deadlift', 'barbell-row']).not.toContain(ex.id)
      }
      expect(plan.sessions.every((s) => s.exercises.length > 0)).toBe(true)
    }
  })

  it('E3: dumbbells only still avoids squats, deadlift variants and back-loading hinges', () => {
    const plan = generatePlan(
      profile({ age: 45, fitnessLevel: 'regular', equipment: ['dumbbells'], injuries: 'bad lower back, no deadlifts', exclusions: 'no squats', trainingPreferences: ['bodyweight'], sessionLengthMinutes: 30 }),
    )
    const ids = exercisesOf(plan).map((x) => x.ex.id)
    for (const banned of ['dumbbell-rdl', 'goblet-squat', 'bodyweight-squat', 'band-squat']) expect(ids).not.toContain(banned)
  })

  it('exclusions match whole movements, plurals and plain words', () => {
    const plan = generatePlan(profile({ equipment: ['none', 'dumbbells', 'bands'], exclusions: 'no lunges, avoid push-ups and burpees, I hate planks' }))
    for (const { ex } of exercisesOf(plan)) {
      expect(ex.id).not.toMatch(/lunge|split-squat|push-up|plank/)
    }
  })

  it('"no cardio" removes conditioning even for go-longer', () => {
    const plan = generatePlan(profile({ primaryGoal: 'go-longer', equipment: ['none'], exclusions: 'no cardio', daysPerWeek: 4 }))
    expect(exercisesOf(plan).some((x) => x.ex.movementPattern === 'conditioning')).toBe(false)
  })

  it('free-text injuries still steer the plan when no area was ticked', () => {
    expect(inferInjuryAreas('bad lower back and a sore knee')).toEqual(['lower-back', 'knee'])
    const plan = generatePlan(profile({ equipment: ['none', 'dumbbells'], injuries: 'sore knee after surgery' }))
    for (const { ex } of exercisesOf(plan)) expect(ex.contraindications).not.toContain('knee')
  })

  it('avoided exercises never come back', () => {
    const base = generatePlan(profile({ equipment: ['dumbbells'] }))
    const first = exercisesOf(base)[0]!.ex.id
    const again = generatePlan(profile({ equipment: ['dumbbells'], avoidedExerciseIds: [first] }))
    expect(exercisesOf(again).map((x) => x.ex.id)).not.toContain(first)
  })

  it('uses the training days the user picked', () => {
    expect(trainingDayIndices({ daysPerWeek: 3, trainingDays: [5, 1, 3] })).toEqual([1, 3, 5])
    const plan = generatePlan(profile({ daysPerWeek: 3, trainingDays: [1, 3, 5] }))
    expect(plan.sessions.map((s) => s.dayIndex)).toEqual([1, 3, 5])
    expect(trainingDayIndices({ daysPerWeek: 4 })).toHaveLength(4)
  })

  it('a gentle start caps volume and avoids barbells', () => {
    const plan = generatePlan(profile({ gentleStart: true, equipment: ['full-gym'], fitnessLevel: 'experienced', primaryGoal: 'lift-heavier' }))
    for (const { pe, ex } of exercisesOf(plan)) {
      expect(pe.targetSets).toBeLessThanOrEqual(2)
      expect(ex.kit).not.toBe('barbell')
    }
  })
})

describe('generatePlan: goals, level and time', () => {
  const upper = (p: Profile) => exercisesOf(generatePlan(p)).find((x) => x.ex.movementPattern === 'squat' || x.ex.movementPattern === 'press')!.pe

  it('goals change the prescription (strength is heavier/lower-rep than endurance)', () => {
    const base = { equipment: ['full-gym'] as Equipment[], fitnessLevel: 'experienced' as FitnessLevel }
    const strength = upper(profile({ ...base, primaryGoal: 'lift-heavier' }))
    const muscle = upper(profile({ ...base, primaryGoal: 'build-muscle' }))
    const endurance = upper(profile({ ...base, primaryGoal: 'go-longer' }))
    expect(strength.targetRepsHigh).toBeLessThan(muscle.targetRepsHigh)
    expect(muscle.targetRepsHigh).toBeLessThan(endurance.targetRepsHigh)
    expect(strength.restSeconds!).toBeGreaterThan(endurance.restSeconds!)
    expect(strength.targetSets).toBeGreaterThanOrEqual(endurance.targetSets)
  })

  it('beginners get at most three sets and a steadier rep range', () => {
    const plan = generatePlan(profile({ primaryGoal: 'lift-heavier', equipment: ['full-gym'] }))
    for (const { pe, ex } of exercisesOf(plan)) {
      if (ex.trackingType === 'weight-reps' || ex.trackingType === 'bodyweight-reps') {
        expect(pe.targetSets).toBeLessThanOrEqual(3)
      }
    }
    expect(upper(profile({ primaryGoal: 'lift-heavier', equipment: ['full-gym'] })).targetRepsLow).toBeGreaterThanOrEqual(8)
  })

  it('session length sizes the session and the estimate stays within 10% of what was asked', () => {
    expect(exerciseCountFor(15)).toBe(3)
    expect(exerciseCountFor(45)).toBe(5)
    expect(exerciseCountFor(90)).toBe(8)
    for (const length of [15, 20, 30, 45, 60, 75, 90]) {
      for (const equipment of EQUIPMENT_SETS) {
        for (const goal of GOALS) {
          const plan = generatePlan(profile({ sessionLengthMinutes: length, equipment, primaryGoal: goal, daysPerWeek: 5, fitnessLevel: 'regular' }))
          for (const s of plan.sessions) {
            expect(estimateSessionMinutes(s), `${length} min ${s.name} ${equipment} ${goal}`).toBeLessThanOrEqual(length * 1.1 + 0.5)
          }
        }
      }
    }
  })

  it('longer sessions hold more exercises than shorter ones', () => {
    const short = generatePlan(profile({ sessionLengthMinutes: 30, equipment: ['full-gym'] }))
    const long = generatePlan(profile({ sessionLengthMinutes: 75, equipment: ['full-gym'] }))
    expect(long.sessions[0]!.exercises.length).toBeGreaterThan(short.sessions[0]!.exercises.length)
  })

  it('duration and distance exercises are prescribed in seconds / minutes, not "reps"', () => {
    const plan = generatePlan(profile({ equipment: ['none'], primaryGoal: 'go-longer', daysPerWeek: 4, trainingPreferences: ['mobility'] }))
    const plank = exercisesOf(plan).find((x) => x.ex.trackingType === 'duration' && x.ex.movementPattern === 'core')
    if (plank) {
      expect(plank.pe.targetRepsLow).toBeGreaterThanOrEqual(15)
      expect(plank.pe.targetRepsHigh).toBeLessThanOrEqual(60)
    }
    const cardio = exercisesOf(plan).find((x) => x.ex.trackingType === 'distance-time')
    expect(cardio).toBeDefined()
    expect(cardio!.pe.targetSets).toBe(1)
    expect(cardio!.pe.targetRepsHigh).toBeLessThanOrEqual(40)
  })
})

describe('generatePlan: structure', () => {
  it('conditioning reaches 3-day plans as a finisher (it used to be silently dropped)', () => {
    const plan = generatePlan(profile({ primaryGoal: 'go-longer', equipment: ['none'], daysPerWeek: 3 }))
    expect(exercisesOf(plan).some((x) => x.ex.movementPattern === 'conditioning')).toBe(true)
    expect(plan.sessions).toHaveLength(3)
  })

  it('4+ days with cardio goals gets a dedicated conditioning day', () => {
    const plan = generatePlan(profile({ primaryGoal: 'lean-out', equipment: ['full-gym'], daysPerWeek: 4, fitnessLevel: 'regular' }))
    expect(plan.sessions.at(-1)!.type).toBe('intervals')
  })

  it('goals that do not want cardio do not get it', () => {
    const plan = generatePlan(profile({ primaryGoal: 'build-muscle', equipment: ['full-gym'], daysPerWeek: 4 }))
    expect(exercisesOf(plan).some((x) => x.ex.movementPattern === 'conditioning')).toBe(false)
  })

  it('repeated Upper/Lower days rotate their accessories', () => {
    const plan = generatePlan(profile({ equipment: ['full-gym'], daysPerWeek: 4, fitnessLevel: 'regular', sessionLengthMinutes: 60 }))
    const lowers = plan.sessions.filter((s) => s.type === 'lower-body')
    expect(lowers).toHaveLength(2)
    const a = lowers[0]!.exercises.slice(2).map((e) => e.exerciseId)
    const b = lowers[1]!.exercises.slice(2).map((e) => e.exerciseId)
    expect(b.some((id) => !a.includes(id))).toBe(true)
  })

  it('mobility preference adds a warm-up and a cool-down block', () => {
    const plan = generatePlan(profile({ trainingPreferences: ['mobility'], sessionLengthMinutes: 60, equipment: ['none'] }))
    const first = plan.sessions[0]!.exercises
    expect(first[0]!.block).toBe('warm-up')
    expect(first.at(-1)!.block).toBe('cool-down')
    expect(first.filter((e) => e.block === 'main').length).toBeGreaterThanOrEqual(3)
  })

  it('preferences tilt the choice toward the preferred kit', () => {
    const base = { equipment: ['dumbbells', 'bands', 'none'] as Equipment[], fitnessLevel: 'new' as FitnessLevel }
    const dumbbell = exercisesOf(generatePlan(profile({ ...base, trainingPreferences: ['dumbbell'] }))).filter((x) => x.ex.kit === 'dumbbell').length
    const band = exercisesOf(generatePlan(profile({ ...base, trainingPreferences: ['bodyweight'] }))).filter((x) => x.ex.kit === 'bodyweight').length
    const neither = exercisesOf(generatePlan(profile({ ...base }))).filter((x) => x.ex.kit === 'dumbbell').length
    expect(dumbbell).toBeGreaterThanOrEqual(neither)
    expect(band).toBeGreaterThan(0)
  })

  it('is deterministic for the same profile', () => {
    const p = profile({ equipment: ['full-gym'], daysPerWeek: 5, fitnessLevel: 'regular' })
    const strip = (plan: Plan) => JSON.stringify(plan.sessions)
    expect(strip(generatePlan(p))).toBe(strip(generatePlan(p)))
  })

  it('balances pushing and pulling by default, and balancePlan repairs a lopsided plan', () => {
    const p = profile({ equipment: ['full-gym'], daysPerWeek: 3, fitnessLevel: 'regular' })
    const plan = generatePlan(p)
    expect(planBalance(plan).uneven).toBe(false)

    // sabotage: strip every pull from the plan
    const lopsided: Plan = {
      ...plan,
      sessions: plan.sessions.map((s) => ({
        ...s,
        exercises: s.exercises.filter((e) => getExerciseById(e.exerciseId)!.movementPattern !== 'pull'),
      })),
    }
    expect(planBalance(lopsided).uneven).toBe(true)
    const fixed = balancePlan(lopsided, p)
    expect(planBalance(fixed).uneven).toBe(false)
    expect(fixed.volumeUneven).toBe(false)
  })

  it('balancePlan keeps the safety rules (no contraindicated pulls added)', () => {
    const p = profile({ equipment: ['full-gym'], daysPerWeek: 3, fitnessLevel: 'regular', injuryAreas: ['lower-back', 'shoulder'] })
    const fixed = balancePlan(
      { ...generatePlan(p), sessions: generatePlan(p).sessions.map((s) => ({ ...s, exercises: s.exercises.filter((e) => getExerciseById(e.exerciseId)!.movementPattern !== 'pull') })) },
      p,
    )
    for (const { ex } of exercisesOf(fixed)) expect(ex.contraindications).not.toContain('lower-back')
  })
})

describe('keyword matching', () => {
  it('parses lists, leads and plurals', () => {
    expect(parseExclusions('no squats, avoid burpees and lunges').phrases).toEqual(expect.arrayContaining(['squat', 'burpee', 'lunge']))
    expect(parseExclusions('I hate running').phrases).toContain('jog')
    expect(parseExclusions('bad lower back', true).phrases).toEqual([]) // a condition, not an exercise
    expect(parseExclusions('bad lower back, no deadlifts', true).phrases).toEqual(['deadlift'])
  })

  it('matches by name, group and kit', () => {
    const k = parseExclusions('no machines, no pull ups')
    expect(matchesKeywords(getExerciseById('leg-press')!, k)).toBe(true)
    expect(matchesKeywords(getExerciseById('pull-up')!, k)).toBe(true)
    expect(matchesKeywords(getExerciseById('dumbbell-row')!, k)).toBe(false)
  })
})

describe('deload and calibration hints', () => {
  const WEEK = 7 * 24 * 60 * 60 * 1000
  it('suggests an easy week after about six weeks of training', () => {
    expect(deloadDue(0, 10, 5 * WEEK)).toBe(false)
    expect(deloadDue(0, 10, 6 * WEEK)).toBe(true)
    expect(deloadDue(0, 2, 8 * WEEK)).toBe(false) // hasn't actually been training
    expect(deloadDue(0, 10, 8 * WEEK, 7 * WEEK)).toBe(false) // just had one
  })

  it('calibration hint has no sex adjustment and trims only at the age extremes', () => {
    const base = { fitnessLevel: 'regular' as const, startingWeightKg: 80 }
    expect(estimateCalibrationHintKg('goblet-squat', base)).toBe(28)
    expect(estimateCalibrationHintKg('goblet-squat', { ...base, age: 30 })).toBe(28)
    expect(estimateCalibrationHintKg('goblet-squat', { ...base, age: 60 })!).toBeLessThan(28)
    expect(estimateCalibrationHintKg('plank', base)).toBeUndefined()
    expect((estimateCalibrationHintKg('deadlift', { ...base, fitnessLevel: 'new' }) ?? 0)).toBeLessThan(estimateCalibrationHintKg('deadlift', { ...base, fitnessLevel: 'experienced' })!)
  })
})
