import type { Exercise } from './types'
import { LEGACY_META, NEW_EXERCISES, finalize, type BaseExercise } from './exerciseData'

// Warm-up ramp: ascending-load sets before the working sets, expressed as a
// percentage of that day's working weight. Only defined for the three
// barbell lifts where ramping matters most (audit gap: "no warm-up guidance").
const BARBELL_WARMUP_RAMP = [
  { percentOfWorking: 0.4, reps: 8 },
  { percentOfWorking: 0.6, reps: 5 },
  { percentOfWorking: 0.8, reps: 3 },
]

const LEGACY_EXERCISES: BaseExercise[] = [
  // ---- Squat pattern ----
  {
    id: 'back-squat',
    name: 'Back Squat',
    movementPattern: 'squat',
    primaryMuscles: ['quads', 'glutes', 'core'],
    equipmentRequired: ['bench-rack', 'full-gym'],
    substitutionGroupId: 'squat',
    formCues: [
      'Brace before you unrack.',
      'Hips and knees break together.',
      'Keep the bar over mid-foot.',
    ],
    warmupRamp: BARBELL_WARMUP_RAMP,
  },
  {
    id: 'goblet-squat',
    name: 'Goblet Squat',
    movementPattern: 'squat',
    primaryMuscles: ['quads', 'glutes', 'core'],
    equipmentRequired: ['dumbbells'],
    substitutionGroupId: 'squat',
    formCues: [
      'Hold the load close to your chest.',
      'Elbows trace inside your knees.',
      'Drive through the whole foot.',
    ],
  },
  {
    id: 'band-squat',
    name: 'Band Squat',
    movementPattern: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    equipmentRequired: ['bands'],
    substitutionGroupId: 'squat',
    formCues: [
      'Anchor the band under both feet.',
      'Sit back like into a low chair.',
      'Stand tall, don’t lean forward.',
    ],
  },
  {
    id: 'bodyweight-squat',
    name: 'Bodyweight Squat',
    movementPattern: 'squat',
    primaryMuscles: ['quads', 'glutes'],
    equipmentRequired: ['none'],
    substitutionGroupId: 'squat',
    formCues: [
      'Push knees out over your toes.',
      'Keep your chest tall, not tipped forward.',
      'Full depth, then stand tall.',
    ],
  },

  // ---- Hinge pattern ----
  {
    id: 'deadlift',
    name: 'Deadlift',
    movementPattern: 'hinge',
    primaryMuscles: ['hamstrings', 'glutes', 'back'],
    equipmentRequired: ['bench-rack', 'full-gym'],
    substitutionGroupId: 'hinge',
    formCues: [
      'Bar close to your shins to start.',
      'Push the floor away, don’t yank the bar.',
      'Lock out hips and knees together.',
    ],
    warmupRamp: BARBELL_WARMUP_RAMP,
  },
  {
    id: 'dumbbell-rdl',
    name: 'Dumbbell Romanian Deadlift',
    movementPattern: 'hinge',
    primaryMuscles: ['hamstrings', 'glutes'],
    equipmentRequired: ['dumbbells'],
    substitutionGroupId: 'hinge',
    formCues: [
      'Push hips back, not down.',
      'Keep the dumbbells close to your legs.',
      'Feel a stretch, not a rounded back.',
    ],
  },
  {
    id: 'band-good-morning',
    name: 'Band Good Morning',
    movementPattern: 'hinge',
    primaryMuscles: ['hamstrings', 'glutes', 'back'],
    equipmentRequired: ['bands'],
    substitutionGroupId: 'hinge',
    formCues: [
      'Soft knees, hinge from the hips.',
      'Keep the band tension steady.',
      'Stand tall to finish each rep.',
    ],
  },
  {
    id: 'bodyweight-hip-hinge',
    name: 'Bodyweight Hip Hinge',
    movementPattern: 'hinge',
    primaryMuscles: ['hamstrings', 'glutes'],
    equipmentRequired: ['none'],
    substitutionGroupId: 'hinge',
    formCues: [
      'Reach hips back behind you.',
      'Keep a soft bend in the knees.',
      'Squeeze glutes to stand back up.',
    ],
  },

  // ---- Horizontal press ----
  {
    id: 'bench-press',
    name: 'Bench Press',
    movementPattern: 'press',
    primaryMuscles: ['chest', 'shoulders', 'triceps'],
    equipmentRequired: ['bench-rack', 'full-gym'],
    substitutionGroupId: 'horizontal-press',
    formCues: [
      'Set your shoulder blades before you unrack.',
      'Bar path touches low on the chest.',
      'Feet stay planted through the press.',
    ],
    warmupRamp: BARBELL_WARMUP_RAMP,
  },
  {
    id: 'dumbbell-bench-press',
    name: 'Dumbbell Bench Press',
    movementPattern: 'press',
    primaryMuscles: ['chest', 'shoulders', 'triceps'],
    equipmentRequired: ['dumbbells'],
    substitutionGroupId: 'horizontal-press',
    formCues: [
      'Press up and slightly in.',
      'Control the dumbbells on the way down.',
      'Keep wrists stacked over elbows.',
    ],
  },
  {
    id: 'band-chest-press',
    name: 'Band Chest Press',
    movementPattern: 'press',
    primaryMuscles: ['chest', 'shoulders', 'triceps'],
    equipmentRequired: ['bands'],
    substitutionGroupId: 'horizontal-press',
    formCues: [
      'Anchor the band behind you at chest height.',
      'Press straight out, exhale on the push.',
      'Return with control, don’t snap back.',
    ],
  },
  {
    id: 'push-up',
    name: 'Push-Up',
    movementPattern: 'press',
    primaryMuscles: ['chest', 'shoulders', 'triceps'],
    equipmentRequired: ['none'],
    substitutionGroupId: 'horizontal-press',
    formCues: [
      'Keep a straight line from shoulders to ankles.',
      'Elbows track back at roughly 45 degrees.',
      'Chest to just above the floor.',
    ],
  },

  // ---- Vertical press ----
  {
    id: 'overhead-press',
    name: 'Overhead Press',
    movementPattern: 'press',
    primaryMuscles: ['shoulders', 'triceps', 'core'],
    equipmentRequired: ['bench-rack', 'full-gym'],
    substitutionGroupId: 'vertical-press',
    formCues: [
      'Brace your core before you press.',
      'Bar path stays close to your face.',
      'Finish with the bar over your head, not in front.',
    ],
  },
  {
    id: 'dumbbell-shoulder-press',
    name: 'Dumbbell Shoulder Press',
    movementPattern: 'press',
    primaryMuscles: ['shoulders', 'triceps'],
    equipmentRequired: ['dumbbells'],
    substitutionGroupId: 'vertical-press',
    formCues: [
      'Start with elbows just below shoulder height.',
      'Press straight up, not forward.',
      'Avoid overarching your lower back.',
    ],
  },
  {
    id: 'band-shoulder-press',
    name: 'Band Shoulder Press',
    movementPattern: 'press',
    primaryMuscles: ['shoulders', 'triceps'],
    equipmentRequired: ['bands'],
    substitutionGroupId: 'vertical-press',
    formCues: [
      'Stand on the band, one handle per hand.',
      'Press straight overhead.',
      'Keep ribs down, don’t lean back.',
    ],
  },
  {
    id: 'pike-push-up',
    name: 'Pike Push-Up',
    movementPattern: 'press',
    primaryMuscles: ['shoulders', 'triceps'],
    equipmentRequired: ['none'],
    substitutionGroupId: 'vertical-press',
    formCues: [
      'Hips high, forming an inverted V.',
      'Lower the crown of your head toward your hands.',
      'Press back up through your palms.',
    ],
  },

  // ---- Horizontal pull ----
  {
    id: 'barbell-row',
    name: 'Barbell Row',
    movementPattern: 'pull',
    primaryMuscles: ['back', 'biceps'],
    equipmentRequired: ['bench-rack', 'full-gym'],
    substitutionGroupId: 'horizontal-pull',
    formCues: [
      'Hinge forward, flat back.',
      'Pull the bar to your lower ribs.',
      'Squeeze your shoulder blades together at the top.',
    ],
  },
  {
    id: 'dumbbell-row',
    name: 'Dumbbell Row',
    movementPattern: 'pull',
    primaryMuscles: ['back', 'biceps'],
    equipmentRequired: ['dumbbells'],
    substitutionGroupId: 'horizontal-pull',
    formCues: [
      'Support yourself with your free hand.',
      'Pull with your elbow, not your hand.',
      'Control the weight back down.',
    ],
  },
  {
    id: 'band-row',
    name: 'Band Row',
    movementPattern: 'pull',
    primaryMuscles: ['back', 'biceps'],
    equipmentRequired: ['bands'],
    substitutionGroupId: 'horizontal-pull',
    formCues: [
      'Anchor the band at chest height.',
      'Pull elbows straight back.',
      'Pause briefly at full contraction.',
    ],
  },
  {
    id: 'superman-hold',
    name: 'Superman Row Hold',
    movementPattern: 'pull',
    primaryMuscles: ['back'],
    equipmentRequired: ['none'],
    substitutionGroupId: 'horizontal-pull',
    formCues: [
      'Lie face down, arms extended ahead.',
      'Lift chest and arms together.',
      'Squeeze your back at the top, then lower slowly.',
    ],
  },

  // ---- Vertical pull ----
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    movementPattern: 'pull',
    primaryMuscles: ['back', 'biceps'],
    equipmentRequired: ['full-gym'],
    substitutionGroupId: 'vertical-pull',
    formCues: [
      'Lead with your elbows, not your hands.',
      'Pull to your upper chest.',
      'Control the return to a full stretch.',
    ],
  },
  {
    id: 'band-pulldown',
    name: 'Band Pulldown',
    movementPattern: 'pull',
    primaryMuscles: ['back', 'biceps'],
    equipmentRequired: ['bands'],
    substitutionGroupId: 'vertical-pull',
    formCues: [
      'Anchor the band overhead.',
      'Pull down and slightly back.',
      'Keep your ribs down through the pull.',
    ],
  },
  {
    id: 'doorway-row',
    name: 'Doorway Row',
    movementPattern: 'pull',
    primaryMuscles: ['back', 'biceps'],
    equipmentRequired: ['none'],
    substitutionGroupId: 'vertical-pull',
    formCues: [
      'Grip a sturdy frame, lean back with straight arms.',
      'Pull your chest toward your hands.',
      'Keep your body in one straight line.',
    ],
  },

  // ---- Carry ----
  {
    id: 'farmers-carry',
    name: 'Farmer’s Carry',
    movementPattern: 'carry',
    primaryMuscles: ['core', 'grip', 'shoulders'],
    equipmentRequired: ['dumbbells', 'full-gym'],
    substitutionGroupId: 'carry',
    formCues: [
      'Stand tall, shoulders back.',
      'Walk with short, controlled steps.',
      'Grip hard through the whole set.',
    ],
  },
  {
    id: 'suitcase-carry',
    name: 'Suitcase Carry',
    movementPattern: 'carry',
    primaryMuscles: ['core', 'grip'],
    equipmentRequired: ['dumbbells', 'bands', 'none'],
    substitutionGroupId: 'carry',
    formCues: [
      'Resist leaning toward the loaded side.',
      'Ribs stacked over hips.',
      'Walk slow enough to stay upright.',
    ],
  },

  // ---- Core ----
  {
    id: 'plank',
    name: 'Plank',
    movementPattern: 'core',
    primaryMuscles: ['core'],
    equipmentRequired: ['none'],
    substitutionGroupId: 'core-static',
    formCues: [
      'Squeeze glutes and brace your abs.',
      'Keep hips level, not sagging or piked.',
      'Breathe steadily, don’t hold your breath.',
    ],
  },
  {
    id: 'band-dead-bug',
    name: 'Dead Bug',
    movementPattern: 'core',
    primaryMuscles: ['core'],
    equipmentRequired: ['none', 'bands'],
    substitutionGroupId: 'core-dynamic',
    formCues: [
      'Press your lower back into the floor.',
      'Move opposite arm and leg together, slowly.',
      'Exhale as you extend.',
    ],
  },
  {
    id: 'hanging-knee-raise',
    name: 'Hanging Knee Raise',
    movementPattern: 'core',
    primaryMuscles: ['core'],
    equipmentRequired: ['full-gym', 'bench-rack'],
    substitutionGroupId: 'core-dynamic',
    formCues: [
      'Start from a dead hang.',
      'Curl your pelvis, not just your legs.',
      'Lower with control, no swinging.',
    ],
  },

  // ---- Conditioning ----
  {
    id: 'intervals-bike',
    name: 'Bike Intervals',
    movementPattern: 'conditioning',
    primaryMuscles: ['legs', 'cardio'],
    equipmentRequired: ['full-gym', 'none'],
    substitutionGroupId: 'intervals',
    formCues: [
      'Go hard on the work interval, really hard.',
      'Let the rest interval actually feel easy.',
      'Keep the same effort split each round.',
    ],
  },
  {
    id: 'easy-jog',
    name: 'Easy Jog',
    movementPattern: 'conditioning',
    primaryMuscles: ['legs', 'cardio'],
    equipmentRequired: ['none'],
    substitutionGroupId: 'endurance',
    formCues: [
      'Pace you could hold a conversation at.',
      'Land light, don’t overstride.',
      'Push the distance about ten percent over time.',
    ],
  },

  // ---- Mobility ----
  {
    id: 'hip-flexor-stretch',
    name: 'Hip Flexor Stretch',
    movementPattern: 'mobility',
    primaryMuscles: ['hips'],
    equipmentRequired: ['none'],
    substitutionGroupId: 'mobility-hips',
    formCues: [
      'Tuck your back hip under you.',
      'Keep your torso tall, not leaning forward.',
      'Ease into the stretch, don’t force it.',
    ],
  },
  {
    id: 'thoracic-rotation',
    name: 'Thoracic Rotation',
    movementPattern: 'mobility',
    primaryMuscles: ['upper back'],
    equipmentRequired: ['none'],
    substitutionGroupId: 'mobility-upper-back',
    formCues: [
      'Stack your hips and keep them still.',
      'Rotate from your upper back, not your lower back.',
      'Follow your top hand with your eyes.',
    ],
  },
]

/** Every built-in exercise: the original set (with planning metadata added) plus the expanded library. */
export const EXERCISE_LIBRARY: Exercise[] = [
  ...LEGACY_EXERCISES.map((e) => finalize(e, LEGACY_META[e.id])),
  ...NEW_EXERCISES,
]

const EXERCISE_BY_ID = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]))

// The person's own exercises. Held in memory (loaded from IndexedDB at start-up and kept in sync)
// so lookups stay synchronous everywhere.
let customById = new Map<string, Exercise>()

export function setCustomExercises(list: Exercise[]): void {
  customById = new Map(list.map((e) => [e.id, e]))
}

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISE_BY_ID.get(id) ?? customById.get(id)
}

/** True for the built-in library (the AI coach's server only knows these). */
export function isBuiltInExercise(id: string): boolean {
  return EXERCISE_BY_ID.has(id)
}

/** Built-in plus custom exercises. Plan generation uses only the built-in library. */
export function allExercises(): Exercise[] {
  return customById.size === 0 ? EXERCISE_LIBRARY : [...EXERCISE_LIBRARY, ...customById.values()]
}

export function getSubstitutes(exercise: Exercise, availableEquipment: string[]): Exercise[] {
  return allExercises().filter(
    (e) =>
      e.substitutionGroupId === exercise.substitutionGroupId &&
      e.id !== exercise.id &&
      // A bodyweight-only move ('none') is always a valid swap target,
      // regardless of what other equipment the user selected.
      e.equipmentRequired.some((eq) => eq === 'none' || availableEquipment.includes(eq)),
  )
}
