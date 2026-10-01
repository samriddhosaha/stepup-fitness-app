import type { Exercise, FitnessLevel, PlanExercise, PrimaryGoal } from '../../db/types'

export type Role = 'main' | 'accessory'

interface Rx {
  sets: number
  low: number
  high: number
  rest: number
}

// Sets × reps × rest by goal. Main lifts get the heavier end; accessories are higher-rep.
const GOAL_RX: Record<PrimaryGoal, Record<Role, Rx>> = {
  'lift-heavier': { main: { sets: 4, low: 3, high: 6, rest: 150 }, accessory: { sets: 3, low: 6, high: 10, rest: 90 } },
  'build-muscle': { main: { sets: 3, low: 6, high: 10, rest: 120 }, accessory: { sets: 3, low: 10, high: 15, rest: 75 } },
  'lean-out': { main: { sets: 3, low: 8, high: 12, rest: 75 }, accessory: { sets: 3, low: 12, high: 15, rest: 60 } },
  'go-longer': { main: { sets: 3, low: 10, high: 15, rest: 60 }, accessory: { sets: 2, low: 12, high: 20, rest: 45 } },
  'feel-better': { main: { sets: 3, low: 8, high: 12, rest: 75 }, accessory: { sets: 2, low: 10, high: 15, rest: 60 } },
}

/** Seconds per set when someone is working rather than resting (used for time estimates). */
export const WORK_SECONDS_PER_SET = 40

function secondsRx(e: Exercise, level: FitnessLevel): Rx {
  const easy = level === 'new'
  switch (e.movementPattern) {
    case 'conditioning':
      return { sets: 6, low: 30, high: 45, rest: 60 } // interval rounds
    case 'mobility':
      return { sets: 2, low: 30, high: 45, rest: 10 }
    case 'carry':
      return { sets: 3, low: 30, high: 60, rest: 75 }
    default:
      return easy ? { sets: 3, low: 15, high: 40, rest: 45 } : { sets: 3, low: 30, high: 60, rest: 45 }
  }
}

/**
 * What to do for one exercise: sets, rep (or second / minute) range, rest.
 * Goal shapes the ranges; beginners get fewer sets and a steadier rep range; a gentle start caps volume.
 */
export function prescribe(
  e: Exercise,
  role: Role,
  goal: PrimaryGoal,
  level: FitnessLevel,
  gentle: boolean,
  sessionMinutes: number,
): Pick<PlanExercise, 'targetSets' | 'targetRepsLow' | 'targetRepsHigh' | 'restSeconds'> {
  let rx: Rx
  if (e.trackingType === 'duration') {
    rx = secondsRx(e, level)
  } else if (e.trackingType === 'distance-time') {
    // minutes; never longer than the session the user asked for
    const cap = Math.max(5, sessionMinutes - 5)
    rx = level === 'new' ? { sets: 1, low: 10, high: 20, rest: 0 } : { sets: 1, low: 15, high: 30, rest: 0 }
    rx = { ...rx, low: Math.min(rx.low, cap), high: Math.min(rx.high, cap) }
  } else if (e.movementPattern === 'mobility') {
    rx = { sets: 2, low: 8, high: 12, rest: 10 }
  } else if (e.movementPattern === 'core' || e.movementPattern === 'isolation') {
    const base = GOAL_RX[goal].accessory
    rx = e.movementPattern === 'core' ? { ...base, low: Math.max(base.low, 8), high: Math.max(base.high, 12) } : base
  } else {
    rx = GOAL_RX[goal][role]
    if (level === 'new') rx = { ...rx, low: Math.max(rx.low, 8), high: Math.max(rx.high, 12) }
  }

  let sets = rx.sets
  if (level === 'new' && e.trackingType !== 'duration') sets = Math.min(sets, 3)
  if (gentle) sets = Math.min(sets, 2)
  return {
    targetSets: sets,
    targetRepsLow: rx.low,
    targetRepsHigh: rx.high,
    restSeconds: rx.rest + (gentle ? 15 : 0),
  }
}

/** Minutes for one exercise including rest (duration sets count their own working time). */
export function exerciseMinutes(pe: Pick<PlanExercise, 'targetSets' | 'targetRepsHigh' | 'restSeconds'>, e: Exercise): number {
  const rest = pe.restSeconds ?? 90
  if (e.trackingType === 'distance-time') return pe.targetRepsHigh
  const work = e.trackingType === 'duration' ? pe.targetRepsHigh : WORK_SECONDS_PER_SET
  return (pe.targetSets * (work + rest)) / 60
}
