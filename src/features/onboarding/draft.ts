import { db, getSetting, setSetting } from '../../db/schema'
import { AGE_GATE, AGE_RANGE, HEIGHT_CM_RANGE, bodyWeightRangeForUnit, rangeErrorMessage } from '../../lib/validation'
import { parseWeight } from '../../lib/units'
import { EQUIPMENT_OPTIONS, GOALS, INJURY_AREA_OPTIONS, WEEKDAYS } from '../../lib/options'
import type {
  Equipment,
  FitnessLevel,
  InjuryArea,
  PrimaryGoal,
  Profile,
  Sex,
  TrainingPreference,
  WeightUnit,
} from '../../db/types'

export type OnboardingMode = 'full' | 'quick'

export type StepId =
  | 'name'
  | 'basics'
  | 'level'
  | 'activity'
  | 'goals'
  | 'schedule'
  | 'equipment'
  | 'preferences'
  | 'health'
  | 'readiness'
  | 'review'

/** The long path, and a three-question path for people who just want to start. */
export const STEPS: Record<OnboardingMode, StepId[]> = {
  full: ['name', 'basics', 'level', 'activity', 'goals', 'schedule', 'equipment', 'preferences', 'health', 'readiness', 'review'],
  quick: ['name', 'equipment', 'schedule'],
}

export const STEP_TITLES: Record<StepId, string> = {
  name: 'What should we call you?',
  basics: 'A few basics',
  level: 'How would you describe where you’re starting from?',
  activity: 'What are you already doing?',
  goals: 'What matters most right now?',
  schedule: 'How much time do you realistically have?',
  equipment: 'What do you have access to?',
  preferences: 'Anything you enjoy?',
  health: 'Anything to work around?',
  readiness: 'A quick check before we start',
  review: 'Here’s the plan we’ll build',
}

export type YesNo = 'yes' | 'no'

export const READINESS_QUESTIONS = [
  { id: 'heart', text: 'Has a doctor ever said you have a heart condition, or do you get chest pain when you’re active?' },
  { id: 'dizzy', text: 'Do you often feel faint or dizzy when you exercise?' },
  { id: 'advised', text: 'Has a health professional told you to limit physical activity?' },
  { id: 'pregnant', text: 'Are you pregnant, or within six weeks of giving birth?' },
  { id: 'joints', text: 'Do you have a bone or joint problem that gets worse when you’re active?' },
] as const

export interface OnboardingDraft {
  name: string
  weightUnit: WeightUnit
  age?: number
  guardianAck: boolean
  sex?: Sex
  heightCm?: number
  /** Typed in `weightUnit`; converted to kg when the profile is saved. */
  weightInput: string
  fitnessLevel?: FitnessLevel
  liftsAlready: boolean
  doesCardioAlready: boolean
  primaryGoal?: PrimaryGoal
  secondaryGoal?: PrimaryGoal
  trainingDays: number[]
  sessionLengthMinutes: number
  equipment: Equipment[]
  trainingPreferences: TrainingPreference[]
  injuryAreas: InjuryArea[]
  injuriesNote: string
  exclusions: string
  readiness: Partial<Record<(typeof READINESS_QUESTIONS)[number]['id'], YesNo>>
}

export const INITIAL_DRAFT: OnboardingDraft = {
  name: '',
  weightUnit: 'kg',
  guardianAck: false,
  weightInput: '',
  liftsAlready: false,
  doesCardioAlready: false,
  trainingDays: [0, 2, 4],
  sessionLengthMinutes: 45,
  equipment: [],
  trainingPreferences: [],
  injuryAreas: [],
  injuriesNote: '',
  exclusions: '',
  readiness: {},
}

export const needsGuardianNote = (age: number | undefined) => age !== undefined && age >= AGE_RANGE.min && age < AGE_GATE

export function ageError(age: number | undefined): string | null {
  if (age === undefined) return null
  if (age < AGE_RANGE.min) return `StepUp is for ages ${AGE_RANGE.min} and up.`
  return rangeErrorMessage(String(age), AGE_RANGE, 'years')
}

/** Which Continue buttons are enabled. Mirrors what the profile needs to be built. */
export function stepValid(step: StepId, d: OnboardingDraft): boolean {
  switch (step) {
    case 'name':
      return d.name.trim().length > 0 && d.name.trim().length <= 60
    case 'basics': {
      if (d.age === undefined || ageError(d.age)) return false
      if (needsGuardianNote(d.age) && !d.guardianAck) return false
      const h = rangeErrorMessage(String(d.heightCm ?? ''), HEIGHT_CM_RANGE, 'cm')
      const w = rangeErrorMessage(d.weightInput, bodyWeightRangeForUnit(d.weightUnit), d.weightUnit)
      return !h && !w
    }
    case 'level':
      return d.fitnessLevel !== undefined
    case 'goals':
      return d.primaryGoal !== undefined
    case 'schedule':
      return d.trainingDays.length >= 1 && d.trainingDays.length <= 6 && d.sessionLengthMinutes >= 15 && d.sessionLengthMinutes <= 90
    case 'equipment':
      return d.equipment.length > 0
    default:
      return true
  }
}

/** True when any readiness answer calls for a gentler start. */
export const needsGentleStart = (d: OnboardingDraft): boolean => Object.values(d.readiness).some((v) => v === 'yes')

export function toProfile(d: OnboardingDraft, mode: OnboardingMode, now = Date.now()): Profile {
  const days = [...new Set(d.trainingDays)].sort((a, b) => a - b).slice(0, 6)
  return {
    name: d.name.trim(),
    age: mode === 'full' ? d.age : undefined,
    sex: d.sex,
    heightCm: d.heightCm,
    startingWeightKg: parseWeight(d.weightInput, d.weightUnit) ?? undefined,
    fitnessLevel: d.fitnessLevel ?? 'new',
    liftsAlready: d.liftsAlready,
    doesCardioAlready: d.doesCardioAlready,
    primaryGoal: d.primaryGoal ?? 'feel-better',
    secondaryGoal: d.secondaryGoal && d.secondaryGoal !== d.primaryGoal ? d.secondaryGoal : undefined,
    daysPerWeek: days.length,
    trainingDays: days,
    sessionLengthMinutes: d.sessionLengthMinutes,
    equipment: d.equipment,
    trainingPreferences: d.trainingPreferences,
    exclusions: d.exclusions.trim() || undefined,
    injuries: d.injuriesNote.trim() || undefined,
    injuryAreas: d.injuryAreas.length ? d.injuryAreas : undefined,
    gentleStart: needsGentleStart(d) || undefined,
    weightUnit: d.weightUnit,
    appearance: 'system',
    onboardingCompleted: true,
    createdAt: now,
  }
}

// ---- "Why this plan" -------------------------------------------------------

const GOAL_WHY: Record<PrimaryGoal, string> = {
  'lift-heavier': 'Heavier sets of 3–6 reps on the main lifts, with longer rests, to build strength.',
  'build-muscle': 'Moderate loads for 6–10 reps on the main lifts and 10–15 on accessories, the sweet spot for building muscle.',
  'lean-out': 'Slightly higher reps with shorter rests to keep muscle while burning more, plus some conditioning.',
  'go-longer': 'Lighter, higher-rep work with short rests, plus regular conditioning, to build stamina.',
  'feel-better': 'A balanced mix of strength and movement at an easy-to-recover-from pace.',
}

export function explainPlan(d: OnboardingDraft): string[] {
  const days = WEEKDAYS.filter((w) => d.trainingDays.includes(w.value)).map((w) => w.long)
  const lines: string[] = []
  lines.push(`${days.length} day${days.length === 1 ? '' : 's'} a week (${days.join(', ')}), about ${d.sessionLengthMinutes} minutes each. Longer sessions get more exercises.`)
  if (d.primaryGoal) lines.push(`Your goal is “${GOALS.find((g) => g.value === d.primaryGoal)?.label.toLowerCase()}”. ${GOAL_WHY[d.primaryGoal]}`)
  if (d.fitnessLevel === 'new') lines.push('You’re starting out, so it uses simpler movements, at most three sets, and a steadier rep range. Barbell lifts come later.')
  if (d.fitnessLevel === 'experienced') lines.push('You’ve trained for a while, so the main lifts use heavier compound movements.')
  lines.push(`Exercises come only from the kit you have: ${d.equipment.map((e) => EQUIPMENT_OPTIONS.find((o) => o.value === e)?.short.toLowerCase()).join(', ')}.`)
  if (d.injuryAreas.length)
    lines.push(`Movements that commonly aggravate your ${d.injuryAreas.map((a) => INJURY_AREA_OPTIONS.find((o) => o.value === a)?.short.toLowerCase()).join(', ')} are left out.`)
  if (d.exclusions.trim()) lines.push(`Anything matching “${d.exclusions.trim()}” is left out too.`)
  if (needsGentleStart(d)) lines.push('Because of your answers, the plan starts gently: fewer sets, easier movements, no heavy barbell work.')
  lines.push('The first time you do a lift, you choose the weight. After that StepUp suggests your next weight from what you actually lifted.')
  return lines
}

// ---- Draft persistence (IndexedDB, so a refresh doesn't lose progress) -------

const DRAFT_KEY = 'onboardingDraft'

export interface SavedDraft {
  draft: OnboardingDraft
  step: number
  mode: OnboardingMode
}

export async function loadDraft(): Promise<SavedDraft | undefined> {
  const saved = await getSetting<SavedDraft>(DRAFT_KEY)
  if (!saved || !saved.draft || !(saved.mode in STEPS)) return undefined
  return { draft: { ...INITIAL_DRAFT, ...saved.draft }, step: Math.min(Math.max(0, saved.step), STEPS[saved.mode].length - 1), mode: saved.mode }
}

export async function saveDraft(saved: SavedDraft): Promise<void> {
  await setSetting(DRAFT_KEY, saved)
}

export async function clearDraft(): Promise<void> {
  await db.settings.delete(DRAFT_KEY)
}
