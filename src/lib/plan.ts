import type {
  Equipment,
  Exercise,
  MovementPattern,
  Plan,
  PlanExercise,
  PlanSession,
  Profile,
  SessionType,
} from '../db/types'
import { EXERCISE_LIBRARY } from '../db/exerciseLibrary'

// Bodyweight-only moves (equipmentRequired includes 'none') don't require
// the user to have picked "No equipment" — anyone can do a plank regardless
// of what other kit they have. Everything else still needs an equipment match.
function isAvailable(exercise: Exercise, equipment: Equipment[]): boolean {
  return exercise.equipmentRequired.some((eq) => eq === 'none' || equipment.includes(eq))
}

function pickForPattern(
  pattern: MovementPattern,
  equipment: Equipment[],
  exclude: Set<string>,
  substitutionGroupHint?: string,
): Exercise | undefined {
  const tierRank: Record<Equipment, number> = {
    'full-gym': 4,
    'bench-rack': 3,
    dumbbells: 2,
    bands: 1,
    none: 0,
  }
  const byTierDesc = (a: Exercise, b: Exercise) => {
    const aTier = Math.max(...a.equipmentRequired.map((eq) => tierRank[eq]))
    const bTier = Math.max(...b.equipmentRequired.map((eq) => tierRank[eq]))
    return bTier - aTier
  }

  const matches = (excludeUsed: boolean) =>
    EXERCISE_LIBRARY.filter(
      (e) =>
        e.movementPattern === pattern &&
        (!excludeUsed || !exclude.has(e.id)) &&
        isAvailable(e, equipment) &&
        (!substitutionGroupHint || e.substitutionGroupId === substitutionGroupHint),
    ).sort(byTierDesc)

  // Prefer an exercise not already used elsewhere this week, but with a
  // small equipment pool (e.g. dumbbells-only) that can run out — falling
  // back to reusing one rather than leaving the session short an exercise.
  return matches(true)[0] ?? matches(false)[0]
}

// Coefficients are kg of load per kg of bodyweight, calibrated to a
// "regular" trainer as the baseline. This is a starting estimate only —
// the in-workout progressive overload logic recalibrates it within a
// couple of sessions based on actual performance and RPE.
const LOAD_COEFFICIENTS: Record<string, number> = {
  'back-squat': 0.75,
  'goblet-squat': 0.35,
  deadlift: 1.0,
  'dumbbell-rdl': 0.3,
  'bench-press': 0.6,
  'dumbbell-bench-press': 0.25,
  'overhead-press': 0.35,
  'dumbbell-shoulder-press': 0.15,
  'barbell-row': 0.5,
  'dumbbell-row': 0.2,
}

export function estimateStartingLoadKg(
  exerciseId: string,
  profile: Pick<Profile, 'fitnessLevel' | 'sex' | 'age' | 'startingWeightKg'>,
): number | undefined {
  const coefficient = LOAD_COEFFICIENTS[exerciseId]
  if (!coefficient) return undefined

  const bodyWeightKg = profile.startingWeightKg ?? 70

  const levelMultiplier =
    profile.fitnessLevel === 'new' ? 0.6 : profile.fitnessLevel === 'experienced' ? 1.3 : 1.0

  // A single starting estimate has to pick some default; this is
  // recalibrated within the first couple of logged sessions regardless.
  const sexMultiplier = profile.sex === 'female' ? 0.7 : profile.sex === 'male' ? 1.0 : 0.85

  let ageMultiplier = 1.0
  if (profile.age !== undefined) {
    if (profile.age >= 55 || profile.age < 18) ageMultiplier = 0.85
  }

  const raw = bodyWeightKg * coefficient * levelMultiplier * sexMultiplier * ageMultiplier
  const roundTo = coefficient >= 0.5 ? 2.5 : 1
  return Math.max(roundTo, Math.round(raw / roundTo) * roundTo)
}

function buildStrengthSession(
  name: string,
  type: SessionType,
  dayIndex: number,
  patterns: MovementPattern[],
  profile: Profile,
  usedIds: Set<string>,
): PlanSession {
  const exercises: PlanExercise[] = []
  for (const pattern of patterns) {
    const exercise = pickForPattern(pattern, profile.equipment, usedIds)
    if (!exercise) continue
    usedIds.add(exercise.id)
    exercises.push({
      exerciseId: exercise.id,
      targetSets: pattern === 'core' ? 3 : 3,
      targetRepsLow: pattern === 'core' ? 30 : 6,
      targetRepsHigh: pattern === 'core' ? 60 : 10,
      startingLoadKg: estimateStartingLoadKg(exercise.id, profile),
    })
  }

  const pushVolumeSets = exercises
    .filter((pe) => getExercisePattern(pe.exerciseId) === 'press')
    .reduce((sum, pe) => sum + pe.targetSets, 0)
  const pullVolumeSets = exercises
    .filter((pe) => getExercisePattern(pe.exerciseId) === 'pull')
    .reduce((sum, pe) => sum + pe.targetSets, 0)

  return { name, type, dayIndex, exercises, pushVolumeSets, pullVolumeSets }
}

function getExercisePattern(exerciseId: string): MovementPattern | undefined {
  return EXERCISE_LIBRARY.find((e) => e.id === exerciseId)?.movementPattern
}

function buildConditioningSession(
  name: string,
  type: SessionType,
  dayIndex: number,
  exerciseId: string,
): PlanSession {
  return {
    name,
    type,
    dayIndex,
    exercises: [
      { exerciseId, targetSets: type === 'intervals' ? 6 : 1, targetRepsLow: 1, targetRepsHigh: 1 },
    ],
  }
}

export function generatePlan(profile: Profile): Plan {
  const days = Math.min(Math.max(profile.daysPerWeek, 1), 6)
  const sessions: PlanSession[] = []
  const usedPerWeek = new Set<string>()
  const wantsConditioning =
    profile.primaryGoal === 'go-longer' ||
    profile.secondaryGoal === 'go-longer' ||
    profile.doesCardioAlready

  const dayIndices = spreadAcrossWeek(days)

  if (days <= 2) {
    sessions.push(
      buildStrengthSession(
        'Full Body A',
        'full-body-a',
        dayIndices[0],
        ['squat', 'press', 'pull', 'core'],
        profile,
        usedPerWeek,
      ),
    )
    if (days === 2) {
      sessions.push(
        buildStrengthSession(
          'Full Body B',
          'full-body-b',
          dayIndices[1],
          ['hinge', 'press', 'pull', 'carry'],
          profile,
          usedPerWeek,
        ),
      )
    }
  } else if (days === 3) {
    sessions.push(
      buildStrengthSession(
        'Full Body A',
        'full-body-a',
        dayIndices[0],
        ['squat', 'press', 'pull', 'core'],
        profile,
        usedPerWeek,
      ),
      buildStrengthSession(
        'Full Body B',
        'full-body-b',
        dayIndices[1],
        ['hinge', 'press', 'pull', 'carry'],
        profile,
        usedPerWeek,
      ),
      buildStrengthSession(
        'Full Body C',
        'full-body-c',
        dayIndices[2],
        ['squat', 'hinge', 'press', 'pull', 'core'],
        profile,
        usedPerWeek,
      ),
    )
  } else {
    // 4+ days: alternate Upper/Lower, and swap the last slot for
    // conditioning if the goal calls for it.
    const upperLowerCount = wantsConditioning ? days - 1 : days
    for (let i = 0; i < upperLowerCount; i += 1) {
      usedPerWeek.clear() // allow repeats across different days in the week
      if (i % 2 === 0) {
        sessions.push(
          buildStrengthSession(
            'Lower Body',
            'lower-body',
            dayIndices[i],
            ['squat', 'hinge', 'core'],
            profile,
            usedPerWeek,
          ),
        )
      } else {
        sessions.push(
          buildStrengthSession(
            'Upper Body',
            'upper-body',
            dayIndices[i],
            ['press', 'pull', 'press', 'pull'],
            profile,
            usedPerWeek,
          ),
        )
      }
    }
    if (wantsConditioning) {
      sessions.push(
        buildConditioningSession(
          'Easy Endurance',
          'easy-endurance',
          dayIndices[days - 1],
          'easy-jog',
        ),
      )
    }
  }

  if (wantsConditioning && days <= 3) {
    // Fold a light conditioning touch in even on lower-frequency weeks by
    // upgrading the last full-body/full-body-adjacent day's type label —
    // kept simple: append a standalone conditioning day only if there's
    // an unused day left in the week.
    const unusedDay = dayIndices.find((d) => !sessions.some((s) => s.dayIndex === d))
    if (unusedDay !== undefined) {
      sessions.push(
        buildConditioningSession('Intervals', 'intervals', unusedDay, 'intervals-bike'),
      )
    }
  }

  const totalPush = sessions.reduce((sum, s) => sum + (s.pushVolumeSets ?? 0), 0)
  const totalPull = sessions.reduce((sum, s) => sum + (s.pullVolumeSets ?? 0), 0)
  const volumeUneven =
    totalPush + totalPull > 0 && Math.abs(totalPush - totalPull) / Math.max(totalPush, totalPull, 1) > 0.3

  return {
    createdAt: Date.now(),
    sessions,
    volumeUneven,
  }
}

function spreadAcrossWeek(days: number): number[] {
  // Even-ish spread across a 7-day week (0 = Monday), leaving rest days
  // between sessions where possible.
  const spreads: Record<number, number[]> = {
    1: [1],
    2: [1, 4],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
  }
  return spreads[days] ?? [0, 1, 2, 3, 4, 5].slice(0, days)
}
