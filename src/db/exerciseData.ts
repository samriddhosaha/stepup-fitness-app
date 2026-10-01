import type {
  Equipment,
  Exercise,
  ImplementKind,
  InjuryArea,
  MovementPattern,
  TrackingType,
  WarmupRampSet,
} from './types'

/** The fields every exercise has always had; the rest are added by `finalize`. */
export type BaseExercise = Pick<
  Exercise,
  | 'id'
  | 'name'
  | 'movementPattern'
  | 'primaryMuscles'
  | 'equipmentRequired'
  | 'substitutionGroupId'
  | 'formCues'
  | 'warmupRamp'
>

interface Extra {
  track?: TrackingType
  skill?: 1 | 2 | 3
  beginner?: boolean
  contra?: InjuryArea[]
  plane?: 'vertical' | 'horizontal'
  uni?: boolean
  kit?: ImplementKind
  group?: string
}

const BARBELL_RAMP: WarmupRampSet[] = [
  { percentOfWorking: 0.4, reps: 8 },
  { percentOfWorking: 0.6, reps: 5 },
  { percentOfWorking: 0.8, reps: 3 },
]

function defaultTracking(eq: Equipment[]): TrackingType {
  return eq.every((e) => e === 'none' || e === 'bands') ? 'bodyweight-reps' : 'weight-reps'
}

function defaultKit(eq: Equipment[]): ImplementKind {
  if (eq.every((e) => e === 'none')) return 'bodyweight'
  if (eq.every((e) => e === 'none' || e === 'bands')) return 'band'
  if (eq.includes('bench-rack')) return 'barbell'
  if (eq.includes('dumbbells')) return 'dumbbell'
  return 'machine'
}

export function finalize(base: BaseExercise, x: Extra = {}): Exercise {
  const skill = x.skill ?? 1
  return {
    ...base,
    substitutionGroupId: x.group ?? base.substitutionGroupId,
    trackingType: x.track ?? defaultTracking(base.equipmentRequired),
    skill,
    beginnerFriendly: x.beginner ?? skill === 1,
    contraindications: x.contra ?? [],
    plane: x.plane,
    unilateral: x.uni ?? false,
    kit: x.kit ?? defaultKit(base.equipmentRequired),
  }
}

/** Planning metadata for the original 32 exercises (IDs are stable; user history refers to them). */
export const LEGACY_META: Record<string, Extra> = {
  'back-squat': { skill: 2, contra: ['knee', 'lower-back'] },
  'goblet-squat': { contra: ['knee'] },
  'band-squat': { contra: ['knee'] },
  'bodyweight-squat': { contra: ['knee'] },
  deadlift: { skill: 3, contra: ['lower-back', 'hip'] },
  'dumbbell-rdl': { contra: ['lower-back'] },
  'band-good-morning': { contra: ['lower-back'] },
  'bodyweight-hip-hinge': {},
  'bench-press': { skill: 2, contra: ['shoulder', 'wrist-elbow'], plane: 'horizontal' },
  'dumbbell-bench-press': { contra: ['shoulder'], plane: 'horizontal' },
  'band-chest-press': { contra: ['shoulder'], plane: 'horizontal' },
  'push-up': { contra: ['wrist-elbow', 'shoulder'], plane: 'horizontal' },
  'overhead-press': { skill: 2, contra: ['shoulder', 'neck', 'lower-back'], plane: 'vertical' },
  'dumbbell-shoulder-press': { contra: ['shoulder'], plane: 'vertical' },
  'band-shoulder-press': { contra: ['shoulder'], plane: 'vertical' },
  'pike-push-up': { skill: 2, contra: ['shoulder', 'wrist-elbow', 'neck'], plane: 'vertical' },
  'barbell-row': { skill: 2, contra: ['lower-back'], plane: 'horizontal' },
  'dumbbell-row': { plane: 'horizontal', uni: true },
  'band-row': { plane: 'horizontal' },
  'superman-hold': { track: 'duration', contra: ['lower-back', 'neck'], plane: 'horizontal' },
  'lat-pulldown': { plane: 'vertical' },
  'band-pulldown': { plane: 'vertical' },
  'doorway-row': { plane: 'horizontal', group: 'horizontal-pull' },
  'farmers-carry': { track: 'duration', kit: 'dumbbell' },
  'suitcase-carry': { track: 'duration', uni: true, kit: 'dumbbell' },
  plank: { track: 'duration', contra: ['wrist-elbow', 'shoulder'] },
  'band-dead-bug': { track: 'bodyweight-reps' },
  'hanging-knee-raise': { skill: 2, track: 'bodyweight-reps', contra: ['shoulder', 'wrist-elbow'], kit: 'bodyweight' },
  'intervals-bike': { track: 'duration', kit: 'machine' },
  'easy-jog': { track: 'distance-time', contra: ['knee', 'hip'], kit: 'bodyweight' },
  'hip-flexor-stretch': { track: 'duration' },
  'thoracic-rotation': { track: 'bodyweight-reps' },
}

const E = (
  id: string,
  name: string,
  movementPattern: MovementPattern,
  primaryMuscles: string[],
  equipmentRequired: Equipment[],
  substitutionGroupId: string,
  formCues: [string, string, string],
  x: Extra & { ramp?: WarmupRampSet[] } = {},
): Exercise =>
  finalize({ id, name, movementPattern, primaryMuscles, equipmentRequired, substitutionGroupId, formCues, warmupRamp: x.ramp }, x)

const RACK: Equipment[] = ['bench-rack', 'full-gym']
const DB: Equipment[] = ['dumbbells']
const NONE: Equipment[] = ['none']
const BANDS: Equipment[] = ['bands']
const GYM: Equipment[] = ['full-gym']

export const NEW_EXERCISES: Exercise[] = [
  // ---- Squat pattern ----
  E('front-squat', 'Front Squat', 'squat', ['quads', 'core'], RACK, 'squat',
    ['Elbows high, bar resting on your shoulders.', 'Stay upright as you sit down.', 'Drive up through the whole foot.'],
    { skill: 3, contra: ['knee', 'wrist-elbow', 'lower-back'], ramp: BARBELL_RAMP }),
  E('leg-press', 'Leg Press', 'squat', ['quads', 'glutes'], GYM, 'squat',
    ['Feet shoulder-width, flat on the plate.', 'Lower until knees reach about 90 degrees.', 'Press without locking your knees out.'],
    { contra: ['knee'] }),
  E('reverse-lunge', 'Reverse Lunge', 'squat', ['quads', 'glutes'], ['none', 'dumbbells'], 'lunge',
    ['Step back softly and drop straight down.', 'Front shin stays roughly vertical.', 'Push through the front heel to stand.'],
    { uni: true, contra: ['knee', 'hip'] }),
  E('walking-lunge', 'Walking Lunge', 'squat', ['quads', 'glutes'], ['none', 'dumbbells'], 'lunge',
    ['Take a long, steady step.', 'Keep your torso tall.', 'Let the back knee brush the floor.'],
    { uni: true, contra: ['knee', 'hip'], skill: 2 }),
  E('split-squat', 'Split Squat', 'squat', ['quads', 'glutes'], ['none', 'dumbbells'], 'lunge',
    ['Feet staggered, stay in that stance.', 'Lower straight down, not forward.', 'Keep your weight over the front foot.'],
    { uni: true, contra: ['knee'] }),
  E('bulgarian-split-squat', 'Bulgarian Split Squat', 'squat', ['quads', 'glutes'], ['dumbbells', 'bench-rack'], 'lunge',
    ['Back foot rests on a bench behind you.', 'Lower with control, torso slightly forward.', 'Drive through the front foot.'],
    { skill: 2, uni: true, contra: ['knee', 'hip'], kit: 'dumbbell' }),
  E('step-up', 'Step-Up', 'squat', ['quads', 'glutes'], ['none', 'dumbbells'], 'lunge',
    ['Place your whole foot on the step.', 'Drive up with the front leg, not the back.', 'Lower slowly on the way down.'],
    { uni: true, contra: ['knee'] }),
  E('leg-extension', 'Leg Extension', 'isolation', ['quads'], GYM, 'quad-isolation',
    ['Sit with your knees lined up to the pivot.', 'Lift smoothly, pause at the top.', 'Lower slowly, don’t drop the weight.'],
    { contra: ['knee'] }),
  E('wall-sit', 'Wall Sit', 'isolation', ['quads'], NONE, 'quad-isolation',
    ['Back flat against the wall.', 'Knees stacked over ankles, thighs near level.', 'Breathe steadily the whole time.'],
    { track: 'duration', contra: ['knee'] }),

  // ---- Hinge pattern ----
  E('romanian-deadlift', 'Romanian Deadlift', 'hinge', ['hamstrings', 'glutes'], RACK, 'hinge',
    ['Soft knees, push your hips back.', 'Bar stays close to your legs.', 'Stand tall by driving hips forward.'],
    { skill: 2, contra: ['lower-back'], ramp: BARBELL_RAMP }),
  E('single-leg-rdl', 'Single-Leg Romanian Deadlift', 'hinge', ['hamstrings', 'glutes'], ['none', 'dumbbells'], 'hinge',
    ['Hinge at the hip, back leg reaches behind.', 'Keep your hips square to the floor.', 'Slight bend in the standing knee.'],
    { skill: 2, uni: true }),
  E('band-pull-through', 'Band Pull-Through', 'hinge', ['glutes', 'hamstrings'], BANDS, 'hinge',
    ['Face away from the anchor, band between your legs.', 'Push your hips back, then snap forward.', 'Squeeze your glutes at the top.'], {}),
  E('glute-bridge', 'Glute Bridge', 'hinge', ['glutes'], NONE, 'glute-bridge',
    ['Feet flat, knees bent, ribs down.', 'Drive through your heels to lift.', 'Squeeze at the top, lower slowly.'], {}),
  E('hip-thrust', 'Hip Thrust', 'hinge', ['glutes'], ['dumbbells', 'bench-rack', 'full-gym'], 'glute-bridge',
    ['Upper back rests on a bench.', 'Chin tucked, ribs down.', 'Pause with hips fully extended.'], { contra: ['hip'], kit: 'dumbbell' }),
  E('single-leg-glute-bridge', 'Single-Leg Glute Bridge', 'hinge', ['glutes'], NONE, 'glute-bridge',
    ['One foot flat, the other leg extended.', 'Keep your hips level as you lift.', 'Control the way down.'], { uni: true }),
  E('banded-glute-bridge', 'Banded Glute Bridge', 'hinge', ['glutes'], BANDS, 'glute-bridge',
    ['Band just above your knees.', 'Press your knees out against it.', 'Lift until hips and shoulders line up.'], {}),
  E('leg-curl', 'Leg Curl', 'hinge', ['hamstrings'], GYM, 'leg-curl',
    ['Hips stay down against the pad.', 'Curl smoothly, squeeze at the end.', 'Lower slowly under control.'], {}),
  E('slider-hamstring-curl', 'Slider Hamstring Curl', 'hinge', ['hamstrings'], NONE, 'leg-curl',
    ['Heels on a towel or slider, hips lifted.', 'Slide out slowly, keep hips high.', 'Pull your heels back in.'], { skill: 2 }),
  E('band-leg-curl', 'Band Leg Curl', 'hinge', ['hamstrings'], BANDS, 'leg-curl',
    ['Anchor the band low behind you.', 'Curl your heel toward your glute.', 'Keep your thigh still.'], {}),

  // ---- Press pattern ----
  E('incline-push-up', 'Incline Push-Up', 'press', ['chest', 'triceps'], NONE, 'horizontal-press',
    ['Hands on a sturdy bench or counter.', 'Body in one straight line.', 'Lower your chest to the edge.'],
    { plane: 'horizontal', contra: ['wrist-elbow'] }),
  E('machine-chest-press', 'Machine Chest Press', 'press', ['chest', 'triceps'], GYM, 'horizontal-press',
    ['Handles at mid-chest height.', 'Press out without shrugging.', 'Return slowly, keep tension.'],
    { plane: 'horizontal', contra: ['shoulder'] }),
  E('floor-press', 'Dumbbell Floor Press', 'press', ['chest', 'triceps'], DB, 'horizontal-press',
    ['Lie on the floor, elbows about 45 degrees.', 'Press up and slightly in.', 'Pause when your triceps touch the floor.'],
    { plane: 'horizontal' }),
  E('machine-shoulder-press', 'Machine Shoulder Press', 'press', ['shoulders', 'triceps'], GYM, 'vertical-press',
    ['Seat set so handles start at shoulder height.', 'Press up without arching your back.', 'Lower under control.'],
    { plane: 'vertical', contra: ['shoulder'] }),

  // ---- Pull pattern ----
  E('inverted-row', 'Inverted Row', 'pull', ['back', 'biceps'], RACK, 'horizontal-pull',
    ['Body in a straight line under the bar.', 'Pull your chest to the bar.', 'Lower slowly to full arms.'],
    { skill: 2, plane: 'horizontal', kit: 'bodyweight', track: 'bodyweight-reps' }),
  E('seated-cable-row', 'Seated Cable Row', 'pull', ['back', 'biceps'], GYM, 'horizontal-pull',
    ['Sit tall, chest proud.', 'Pull to your lower ribs.', 'Reach forward without rounding.'], { plane: 'horizontal' }),
  E('chest-supported-row', 'Chest-Supported Dumbbell Row', 'pull', ['back', 'biceps'], DB, 'horizontal-pull',
    ['Chest rests on an incline bench.', 'Pull elbows past your ribs.', 'Pause and lower slowly.'], { plane: 'horizontal' }),
  E('pull-up', 'Pull-Up', 'pull', ['back', 'biceps'], RACK, 'vertical-pull',
    ['Start from a full hang, shoulders set.', 'Pull your chest toward the bar.', 'Lower all the way down with control.'],
    { skill: 3, plane: 'vertical', track: 'bodyweight-reps', kit: 'bodyweight', contra: ['shoulder', 'wrist-elbow'] }),
  E('chin-up', 'Chin-Up', 'pull', ['back', 'biceps'], RACK, 'vertical-pull',
    ['Palms toward you, hands shoulder-width.', 'Pull until your chin clears the bar.', 'Lower under control.'],
    { skill: 3, plane: 'vertical', track: 'bodyweight-reps', kit: 'bodyweight', contra: ['wrist-elbow', 'shoulder'] }),
  E('assisted-pull-up', 'Assisted Pull-Up', 'pull', ['back', 'biceps'], GYM, 'vertical-pull',
    ['Choose assistance that lets you control every rep.', 'Pull your elbows down to your ribs.', 'Lower slowly.'],
    { skill: 2, plane: 'vertical', contra: ['shoulder'] }),

  // ---- Isolation (accessories) ----
  E('triceps-pushdown', 'Band Triceps Pushdown', 'isolation', ['triceps'], BANDS, 'triceps',
    ['Elbows pinned to your sides.', 'Straighten fully, squeeze.', 'Return slowly.'], { contra: ['wrist-elbow'] }),
  E('overhead-triceps-extension', 'Overhead Triceps Extension', 'isolation', ['triceps'], DB, 'triceps',
    ['Elbows point forward, close to your head.', 'Lower behind your head slowly.', 'Extend without flaring ribs.'],
    { contra: ['wrist-elbow', 'shoulder'] }),
  E('bench-dip', 'Bench Dip', 'isolation', ['triceps', 'chest'], NONE, 'triceps',
    ['Hands on a bench behind you, hips close.', 'Lower until elbows reach about 90 degrees.', 'Press up without shrugging.'],
    { skill: 2, contra: ['shoulder', 'wrist-elbow'], track: 'bodyweight-reps' }),
  E('dumbbell-curl', 'Dumbbell Curl', 'isolation', ['biceps'], DB, 'biceps',
    ['Elbows stay by your sides.', 'Curl up without swinging.', 'Lower slowly.'], { contra: ['wrist-elbow'] }),
  E('hammer-curl', 'Hammer Curl', 'isolation', ['biceps', 'forearms'], DB, 'biceps',
    ['Palms face each other throughout.', 'Keep your elbows still.', 'Squeeze at the top.'], { contra: ['wrist-elbow'] }),
  E('band-curl', 'Band Curl', 'isolation', ['biceps'], BANDS, 'biceps',
    ['Stand on the band, hands at your sides.', 'Curl without leaning back.', 'Control the return.'], { contra: ['wrist-elbow'] }),
  E('cable-curl', 'Cable Curl', 'isolation', ['biceps'], GYM, 'biceps',
    ['Elbows pinned, shoulders relaxed.', 'Curl through the full range.', 'Lower slowly.'], { contra: ['wrist-elbow'] }),
  E('reverse-fly', 'Reverse Fly', 'isolation', ['rear delts', 'upper back'], DB, 'rear-delt',
    ['Hinge forward, soft elbows.', 'Lift out to the sides to shoulder height.', 'Lower without swinging.'], { contra: ['lower-back'] }),
  E('band-pull-apart', 'Band Pull-Apart', 'isolation', ['rear delts', 'upper back'], BANDS, 'rear-delt',
    ['Arms straight in front, band at chest height.', 'Pull it apart to your sides.', 'Squeeze your shoulder blades.'], {}),
  E('face-pull', 'Face Pull', 'isolation', ['rear delts', 'upper back'], GYM, 'rear-delt',
    ['Pull the rope toward your eyes.', 'Elbows high, hands apart at the end.', 'Pause, then return slowly.'], {}),
  E('lateral-raise', 'Lateral Raise', 'isolation', ['shoulders'], DB, 'lateral-raise',
    ['Light weights, soft elbows.', 'Raise to shoulder height only.', 'Lower slowly.'], { contra: ['shoulder'] }),
  E('band-lateral-raise', 'Band Lateral Raise', 'isolation', ['shoulders'], BANDS, 'lateral-raise',
    ['Stand on the band, hands at your sides.', 'Lift out to shoulder height.', 'Control the way down.'], { contra: ['shoulder'] }),
  E('calf-raise', 'Calf Raise', 'isolation', ['calves'], NONE, 'calves',
    ['Rise as high as you can.', 'Pause at the top.', 'Lower slowly below the step if you can.'], {}),
  E('dumbbell-calf-raise', 'Dumbbell Calf Raise', 'isolation', ['calves'], DB, 'calves',
    ['Hold dumbbells at your sides.', 'Rise tall, pause.', 'Lower slowly.'], {}),
  E('machine-calf-raise', 'Machine Calf Raise', 'isolation', ['calves'], GYM, 'calves',
    ['Balls of your feet on the platform.', 'Full stretch at the bottom.', 'Pause at the top.'], {}),

  // ---- Core ----
  E('side-plank', 'Side Plank', 'core', ['obliques', 'core'], NONE, 'core-static',
    ['Elbow under your shoulder.', 'Body in one line from head to feet.', 'Hips stay lifted.'],
    { track: 'duration', uni: true, contra: ['shoulder', 'wrist-elbow'] }),
  E('pallof-hold', 'Pallof Hold', 'core', ['core', 'obliques'], BANDS, 'core-static',
    ['Stand side-on to the band anchor.', 'Press out and hold, resisting the pull.', 'Keep your hips and shoulders square.'],
    { track: 'duration' }),
  E('hollow-hold', 'Hollow Hold', 'core', ['core'], NONE, 'core-static',
    ['Press your lower back into the floor.', 'Lift shoulders and legs a little.', 'Shorten the lever if your back lifts.'],
    { track: 'duration', skill: 2, contra: ['neck'] }),
  E('bicycle-crunch', 'Bicycle Crunch', 'core', ['core', 'obliques'], NONE, 'core-dynamic',
    ['Hands light behind your head.', 'Rotate your ribs, not just your elbows.', 'Slow and controlled.'], { contra: ['neck', 'lower-back'] }),
  E('reverse-crunch', 'Reverse Crunch', 'core', ['core'], NONE, 'core-dynamic',
    ['Knees bent over your hips.', 'Curl your hips up off the floor.', 'Lower slowly, don’t swing.'], { contra: ['lower-back'] }),
  E('pallof-press', 'Pallof Press', 'core', ['core', 'obliques'], BANDS, 'core-anti-rotation',
    ['Stand side-on to the band anchor.', 'Press straight out and resist the pull.', 'Hips and shoulders stay square.'], {}),
  E('bird-dog', 'Bird Dog', 'core', ['core', 'glutes'], NONE, 'core-anti-rotation',
    ['Hands under shoulders, knees under hips.', 'Reach opposite arm and leg.', 'Keep your back flat, hips level.'],
    { track: 'bodyweight-reps' }),

  // ---- Conditioning ----
  E('rowing-intervals', 'Rowing Intervals', 'conditioning', ['legs', 'back', 'cardio'], GYM, 'intervals',
    ['Drive with the legs first, then lean, then pull.', 'Hard work interval, easy rest interval.', 'Keep a steady stroke rate.'],
    { track: 'duration', kit: 'machine', skill: 2 }),
  E('jump-rope-intervals', 'Jump-Rope Intervals', 'conditioning', ['calves', 'cardio'], NONE, 'intervals',
    ['Small hops, quiet landings.', 'Wrists turn the rope, not arms.', 'Rest fully between rounds.'],
    { track: 'duration', skill: 2, contra: ['knee'] }),
  E('brisk-walk', 'Brisk Walk', 'conditioning', ['legs', 'cardio'], NONE, 'endurance',
    ['A pace where you can talk but not sing.', 'Swing your arms naturally.', 'Add a few minutes over the weeks.'],
    { track: 'distance-time' }),
  E('easy-bike', 'Easy Bike Ride', 'conditioning', ['legs', 'cardio'], GYM, 'endurance',
    ['Pace you could hold a conversation at.', 'Smooth, round pedal strokes.', 'Add a few minutes over the weeks.'],
    { track: 'distance-time', kit: 'machine' }),

  // ---- Mobility ----
  E('90-90-hip-switch', '90/90 Hip Switch', 'mobility', ['hips'], NONE, 'mobility-hips',
    ['Sit tall with both knees bent at 90 degrees.', 'Rotate your knees side to side.', 'Move only as far as is comfortable.'],
    { track: 'bodyweight-reps', contra: ['knee'] }),
  E('banded-hip-flexor-stretch', 'Banded Hip Flexor Stretch', 'mobility', ['hips'], BANDS, 'mobility-hips',
    ['Loop a band around your front thigh.', 'Tuck your back hip under, ribs down.', 'Let the band guide you; ease off if it pinches.'],
    { track: 'duration' }),
  E('cat-cow', 'Cat-Cow', 'mobility', ['spine'], NONE, 'mobility-upper-back',
    ['Hands under shoulders, knees under hips.', 'Round, then arch, slowly.', 'Breathe with the movement.'],
    { track: 'bodyweight-reps' }),
  E('band-shoulder-dislocate', 'Band Shoulder Dislocate', 'mobility', ['shoulders'], BANDS, 'mobility-upper-back',
    ['Wide grip on the band, arms straight.', 'Lift overhead and part-way behind.', 'Widen your grip if it pinches.'],
    { track: 'bodyweight-reps', contra: ['shoulder'] }),
  E('hamstring-stretch', 'Hamstring Stretch', 'mobility', ['hamstrings'], NONE, 'mobility-lower-body',
    ['Heel forward, hips hinge back.', 'Long spine, soft front knee.', 'Ease in; it should feel like a stretch only.'],
    { track: 'duration' }),
  E('band-hamstring-stretch', 'Band Hamstring Stretch', 'mobility', ['hamstrings'], BANDS, 'mobility-lower-body',
    ['Lie on your back, band around one foot.', 'Raise the leg until you feel a gentle stretch.', 'Keep the other leg relaxed on the floor.'],
    { track: 'duration' }),
  E('worlds-greatest-stretch', 'World’s Greatest Stretch', 'mobility', ['hips', 'upper back'], NONE, 'mobility-lower-body',
    ['Deep lunge, hand beside your front foot.', 'Rotate and reach one arm to the sky.', 'Breathe slowly, switch sides.'],
    { track: 'bodyweight-reps', contra: ['knee'] }),
  E('calf-stretch', 'Calf Stretch', 'mobility', ['calves'], NONE, 'mobility-lower-body',
    ['Hands on a wall, one foot back.', 'Heel stays flat on the floor.', 'Lean in until you feel it in your calf.'],
    { track: 'duration' }),
]
