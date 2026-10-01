import { describe, expect, it } from 'vitest'
import { EXERCISE_LIBRARY, getExerciseById, getSubstitutes } from './exerciseLibrary'
import type { Equipment, MovementPattern } from './types'

const EQUIPMENT: Equipment[] = ['none', 'dumbbells', 'bands', 'bench-rack', 'full-gym']
const PATTERNS: MovementPattern[] = ['squat', 'hinge', 'press', 'pull', 'carry', 'core', 'isolation', 'conditioning', 'mobility']

// IDs that existing users' history refers to; they must never change.
const ORIGINAL_IDS = [
  'back-squat', 'goblet-squat', 'band-squat', 'bodyweight-squat', 'deadlift', 'dumbbell-rdl', 'band-good-morning',
  'bodyweight-hip-hinge', 'bench-press', 'dumbbell-bench-press', 'band-chest-press', 'push-up', 'overhead-press',
  'dumbbell-shoulder-press', 'band-shoulder-press', 'pike-push-up', 'barbell-row', 'dumbbell-row', 'band-row',
  'superman-hold', 'lat-pulldown', 'band-pulldown', 'doorway-row', 'farmers-carry', 'suitcase-carry', 'plank',
  'band-dead-bug', 'hanging-knee-raise', 'intervals-bike', 'easy-jog', 'hip-flexor-stretch', 'thoracic-rotation',
]

describe('exercise library', () => {
  it('is broad enough (80–100 exercises) and keeps every original ID', () => {
    expect(EXERCISE_LIBRARY.length).toBeGreaterThanOrEqual(80)
    expect(EXERCISE_LIBRARY.length).toBeLessThanOrEqual(100)
    for (const id of ORIGINAL_IDS) expect(getExerciseById(id), id).toBeDefined()
  })

  it('has unique ids and names', () => {
    const ids = EXERCISE_LIBRARY.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    const names = EXERCISE_LIBRARY.map((e) => e.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('gives every exercise valid equipment, exactly three cues and consistent metadata', () => {
    for (const e of EXERCISE_LIBRARY) {
      expect(e.equipmentRequired.length, e.id).toBeGreaterThan(0)
      for (const eq of e.equipmentRequired) expect(EQUIPMENT, `${e.id} equipment ${eq}`).toContain(eq)
      expect(e.formCues, e.id).toHaveLength(3)
      for (const cue of e.formCues) expect(cue.trim().length, `${e.id} cue`).toBeGreaterThan(5)
      expect(PATTERNS, e.id).toContain(e.movementPattern)
      expect(['weight-reps', 'bodyweight-reps', 'duration', 'distance-time'], e.id).toContain(e.trackingType)
      if (e.beginnerFriendly) expect(e.skill, `${e.id} beginner-friendly implies skill 1`).toBe(1)
      if (e.kit === 'barbell') expect(e.skill, `${e.id} barbell lifts need practice`).toBeGreaterThanOrEqual(2)
      if (e.movementPattern === 'press' || e.movementPattern === 'pull') {
        expect(e.plane, `${e.id} press/pull has a plane`).toBeDefined()
      }
    }
  })

  it('every substitution group offers a real swap: ≥ 2 members with different equipment', () => {
    const groups = new Map<string, string[]>()
    for (const e of EXERCISE_LIBRARY) {
      groups.set(e.substitutionGroupId, [...(groups.get(e.substitutionGroupId) ?? []), [...e.equipmentRequired].sort().join('+')])
    }
    for (const [group, signatures] of groups) {
      expect(signatures.length, `group ${group} has too few members`).toBeGreaterThanOrEqual(2)
      expect(new Set(signatures).size, `group ${group} has one equipment tier only`).toBeGreaterThanOrEqual(2)
    }
  })

  it('covers the patterns the old library lacked', () => {
    const groups = new Set(EXERCISE_LIBRARY.map((e) => e.substitutionGroupId))
    for (const g of ['lunge', 'glute-bridge', 'leg-curl', 'quad-isolation', 'calves', 'biceps', 'triceps', 'rear-delt', 'core-anti-rotation', 'mobility-lower-body']) {
      expect(groups, g).toContain(g)
    }
    const planes = new Set(EXERCISE_LIBRARY.filter((e) => e.movementPattern === 'pull').map((e) => e.plane))
    expect(planes).toEqual(new Set(['horizontal', 'vertical']))
  })

  it('offers every equipment tier a beginner-friendly option for each main pattern', () => {
    for (const eq of EQUIPMENT) {
      for (const pattern of ['squat', 'hinge', 'press', 'pull', 'core'] as MovementPattern[]) {
        const options = EXERCISE_LIBRARY.filter(
          (e) =>
            e.movementPattern === pattern &&
            e.beginnerFriendly &&
            e.equipmentRequired.some((r) => r === 'none' || r === eq),
        )
        expect(options.length, `${eq} / ${pattern}`).toBeGreaterThan(0)
      }
    }
  })

  it('getSubstitutes only returns same-group exercises the user can do', () => {
    const goblet = getExerciseById('goblet-squat')!
    const subs = getSubstitutes(goblet, ['dumbbells'])
    expect(subs.length).toBeGreaterThan(0)
    for (const s of subs) {
      expect(s.substitutionGroupId).toBe('squat')
      expect(s.id).not.toBe('goblet-squat')
      expect(s.equipmentRequired.some((r) => r === 'none' || r === 'dumbbells')).toBe(true)
    }
  })
})
