import type { Appearance, Equipment, FitnessLevel, PrimaryGoal, Sex, TrainingPreference, WeightUnit } from '../db/types'

// One source for the choice lists used by onboarding and profile editing.
// `label` is the full wording (onboarding); `short` fits compact lists.
export interface Option<T extends string> {
  value: T
  label: string
  short: string
}

export const FITNESS_LEVELS: Option<FitnessLevel>[] = [
  { value: 'new', label: "I'm new to structured workouts", short: 'New to structured workouts' },
  { value: 'regular', label: 'I already work out regularly', short: 'Work out regularly' },
  { value: 'experienced', label: "I've trained consistently for a while", short: 'Trained consistently for a while' },
]

export const GOALS: Option<PrimaryGoal>[] = [
  { value: 'build-muscle', label: 'Build muscle', short: 'Build muscle' },
  { value: 'lift-heavier', label: 'Lift heavier over time', short: 'Lift heavier over time' },
  { value: 'lean-out', label: 'Lean out while keeping muscle', short: 'Lean out while keeping muscle' },
  { value: 'go-longer', label: 'Go longer without fading', short: 'Go longer without fading' },
  { value: 'feel-better', label: 'Feel better across the board', short: 'Feel better across the board' },
]

export const EQUIPMENT_OPTIONS: Option<Equipment>[] = [
  { value: 'none', label: 'No equipment / Bodyweight only', short: 'No equipment' },
  { value: 'dumbbells', label: 'Dumbbells', short: 'Dumbbells' },
  { value: 'bands', label: 'Resistance bands', short: 'Bands' },
  { value: 'bench-rack', label: 'Bench/bar/rack at home', short: 'Bench/bar/rack' },
  { value: 'full-gym', label: 'Full gym (machines/racks/the lot)', short: 'Full gym' },
]

export const PREFERENCE_OPTIONS: Option<TrainingPreference>[] = [
  { value: 'barbell', label: 'Barbell work', short: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell work', short: 'Dumbbell' },
  { value: 'bodyweight', label: 'Bodyweight training', short: 'Bodyweight' },
  { value: 'machines', label: 'Machines', short: 'Machines' },
  { value: 'conditioning', label: 'Conditioning / cardio', short: 'Conditioning' },
  { value: 'mobility', label: 'Mobility & stretching', short: 'Mobility' },
]

export const SEX_OPTIONS: Option<Sex>[] = [
  { value: 'female', label: 'Female', short: 'Female' },
  { value: 'male', label: 'Male', short: 'Male' },
  { value: 'unspecified', label: 'Prefer not to say', short: 'Prefer not to say' },
]

export const UNIT_OPTIONS: Option<WeightUnit>[] = [
  { value: 'kg', label: 'Kilograms', short: 'kg' },
  { value: 'lb', label: 'Pounds', short: 'lb' },
]

export const APPEARANCE_OPTIONS: Option<Appearance>[] = [
  { value: 'light', label: 'Light', short: 'Light' },
  { value: 'dark', label: 'Dark', short: 'Dark' },
  { value: 'system', label: 'System', short: 'System' },
]

export const toggleInArray = <T,>(arr: T[], value: T): T[] =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]

export const withLabel = <T extends string>(opts: Option<T>[], key: 'label' | 'short' = 'label') =>
  opts.map((o) => ({ value: o.value, label: o[key] }))
