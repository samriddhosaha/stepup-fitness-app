import type {
  ActivityLevel,
  CustomFood,
  Macros,
  MealLog,
  NutritionGoal,
  Profile,
  Sex,
} from '../db/types'
import { CATEGORY_LABELS, type FoodItem } from '../db/foodLibrary'
import { lastNDays } from './format'
import type { NumericRange } from './validation'

/**
 * Nutrition maths. All of it is an estimate to help set a starting point —
 * not medical or dietary advice. Pure and database-free.
 */

export const NUTRITION_DISCLAIMER =
  'These are estimates to give you a starting point, not medical or dietary advice. Bodies differ — adjust to how you feel and perform, and talk to a professional if you have a health condition or are pregnant.'

export const FOOD_APPROX_NOTE =
  'Built-in foods are approximate. Real portions and recipes vary, so use custom foods or quick-add when you know better.'

// ---- Targets ------------------------------------------------------------------

export const ACTIVITY_LEVELS: {
  value: ActivityLevel
  label: string
  hint: string
  multiplier: number
}[] = [
  { value: 'sedentary', label: 'Mostly seated', hint: 'Desk job, little exercise', multiplier: 1.2 },
  { value: 'light', label: 'Lightly active', hint: 'Exercise 1–3 days a week', multiplier: 1.375 },
  { value: 'moderate', label: 'Moderately active', hint: 'Exercise 3–5 days a week', multiplier: 1.55 },
  { value: 'active', label: 'Very active', hint: 'Hard exercise 6–7 days a week', multiplier: 1.725 },
  { value: 'very-active', label: 'Extremely active', hint: 'Physical job plus training', multiplier: 1.9 },
]

export const GOAL_OPTIONS: { value: NutritionGoal; label: string; hint: string }[] = [
  { value: 'lose', label: 'Lose fat', hint: 'About 20% below maintenance' },
  { value: 'maintain', label: 'Maintain', hint: 'Eat at maintenance' },
  { value: 'gain', label: 'Build muscle', hint: 'About 10% above maintenance' },
]

/** Calories change vs maintenance, as a multiplier. */
const GOAL_FACTOR: Record<NutritionGoal, number> = { lose: 0.8, maintain: 1, gain: 1.1 }
/** Protein in g per kg of bodyweight. Evidence-based range for lifters is roughly 1.6-2.2. */
const PROTEIN_PER_KG: Record<NutritionGoal, number> = { lose: 2.0, maintain: 1.6, gain: 1.8 }
/** Never suggest eating below this, however the maths falls out. */
export const CALORIE_FLOOR = 1200
const FAT_SHARE = 0.25

export interface TargetInputs {
  weightKg?: number
  heightCm?: number
  age?: number
  sex?: Sex
  activityLevel?: ActivityLevel
  goal?: NutritionGoal
}

/**
 * Mifflin-St Jeor resting energy: 10w + 6.25h - 5a + s, where s is +5 for men
 * and -161 for women. With "prefer not to say" we use the midpoint (-78)
 * rather than guessing.
 */
export function mifflinStJeor(p: {
  weightKg: number
  heightCm: number
  age: number
  sex: Sex | undefined
}): number {
  const offset = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + offset
}

export function activityMultiplier(level: ActivityLevel): number {
  return ACTIVITY_LEVELS.find((l) => l.value === level)?.multiplier ?? 1.2
}

export interface CalculatedTargets {
  bmr: number
  tdee: number
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
  /** The calorie floor raised the target above what the goal maths gave. */
  floored: boolean
}

export type TargetResult =
  | ({ ok: true } & CalculatedTargets)
  | { ok: false; missing: string[] }

const roundTo = (n: number, step: number) => Math.round(n / step) * step

export function calculateTargets(input: TargetInputs): TargetResult {
  const missing: string[] = []
  if (input.weightKg === undefined) missing.push('weight')
  if (input.heightCm === undefined) missing.push('height')
  if (input.age === undefined) missing.push('age')
  if (missing.length > 0) return { ok: false, missing }

  const bmr = mifflinStJeor({
    weightKg: input.weightKg!,
    heightCm: input.heightCm!,
    age: input.age!,
    sex: input.sex,
  })
  const maintenance = bmr * activityMultiplier(input.activityLevel ?? 'light')
  const goal = input.goal ?? 'maintain'

  const raw = roundTo(maintenance * GOAL_FACTOR[goal], 10)
  const calories = Math.max(CALORIE_FLOOR, raw)
  const proteinG = roundTo(input.weightKg! * PROTEIN_PER_KG[goal], 5)
  const fatG = Math.round((calories * FAT_SHARE) / 9)
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4))

  return {
    ok: true,
    bmr: Math.round(bmr),
    tdee: roundTo(maintenance, 10),
    calories,
    proteinG,
    fatG,
    carbsG,
    floored: calories > raw,
  }
}

export interface EffectiveTargets {
  calories?: number
  proteinG?: number
  /** Where the numbers came from; null if there are none yet. */
  source: 'custom' | 'calculated' | 'mixed' | null
}

/** The user's own numbers win; whatever they haven't set falls back to the calculation. */
export function effectiveTargets(
  overrides: { calorieTargetKcal?: number; proteinTargetG?: number },
  calculated: TargetResult,
): EffectiveTargets {
  const calc = calculated.ok ? calculated : undefined
  const calories = overrides.calorieTargetKcal ?? calc?.calories
  const proteinG = overrides.proteinTargetG ?? calc?.proteinG
  const customCount =
    (overrides.calorieTargetKcal !== undefined ? 1 : 0) + (overrides.proteinTargetG !== undefined ? 1 : 0)
  const calcUsed =
    (overrides.calorieTargetKcal === undefined && calc ? 1 : 0) +
    (overrides.proteinTargetG === undefined && calc ? 1 : 0)
  const source =
    calories === undefined && proteinG === undefined
      ? null
      : customCount > 0 && calcUsed > 0
        ? 'mixed'
        : customCount > 0
          ? 'custom'
          : 'calculated'
  return { calories, proteinG, source }
}

export interface ProfileTargets {
  calculated: TargetResult
  effective: EffectiveTargets
}

/** Targets for a profile at a given bodyweight: the calculation, and what actually applies. */
export function targetsForProfile(
  profile: Pick<
    Profile,
    'age' | 'sex' | 'heightCm' | 'activityLevel' | 'nutritionGoal' | 'calorieTargetKcal' | 'proteinTargetG'
  >,
  weightKg: number | undefined,
): ProfileTargets {
  const calculated = calculateTargets({
    weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
    sex: profile.sex,
    activityLevel: profile.activityLevel,
    goal: profile.nutritionGoal,
  })
  return {
    calculated,
    effective: effectiveTargets(
      { calorieTargetKcal: profile.calorieTargetKcal, proteinTargetG: profile.proteinTargetG },
      calculated,
    ),
  }
}

// ---- Macros ---------------------------------------------------------------------

export const CALORIES_RANGE: NumericRange = { min: 0, max: 5000 }
export const MACRO_G_RANGE: NumericRange = { min: 0, max: 500 }
export const SERVINGS_RANGE: NumericRange = { min: 0.25, max: 20 }
export const CALORIE_TARGET_RANGE: NumericRange = { min: 800, max: 6000 }
export const PROTEIN_TARGET_RANGE: NumericRange = { min: 20, max: 400 }

const round1 = (n: number) => Math.round(n * 10) / 10

/** Calories implied by the macros (4/4/9). */
export function macroCalories(m: Pick<Macros, 'proteinG' | 'carbsG' | 'fatG'>): number {
  return Math.round(m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9)
}

export function scaleMacros(m: Macros, servings: number): Macros {
  return {
    calories: Math.round(m.calories * servings),
    proteinG: round1(m.proteinG * servings),
    carbsG: round1(m.carbsG * servings),
    fatG: round1(m.fatG * servings),
  }
}

export function sumMacros(items: Macros[]): Macros {
  const total = items.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteinG: acc.proteinG + m.proteinG,
      carbsG: acc.carbsG + m.carbsG,
      fatG: acc.fatG + m.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )
  return {
    calories: Math.round(total.calories),
    proteinG: round1(total.proteinG),
    carbsG: round1(total.carbsG),
    fatG: round1(total.fatG),
  }
}

export type QuickAddResult = { ok: true; macros: Macros; caloriesEstimated: boolean } | { ok: false; error: string }

/**
 * Turns the quick-add fields (all optional text) into macros. Needs at least
 * one number; if calories are left blank but macros are given, calories are
 * worked out from them so a "protein-only" entry still counts.
 */
export function resolveQuickAdd(fields: {
  calories: string
  proteinG: string
  carbsG: string
  fatG: string
}): QuickAddResult {
  const parse = (raw: string, range: NumericRange, label: string): number | undefined | Error => {
    if (raw.trim() === '') return undefined
    const n = Number(raw)
    if (!Number.isFinite(n)) return new Error(`${label} must be a number.`)
    if (n < range.min || n > range.max) {
      return new Error(`${label} must be between ${range.min} and ${range.max}.`)
    }
    return n
  }
  const calories = parse(fields.calories, CALORIES_RANGE, 'Calories')
  const protein = parse(fields.proteinG, MACRO_G_RANGE, 'Protein')
  const carbs = parse(fields.carbsG, MACRO_G_RANGE, 'Carbs')
  const fat = parse(fields.fatG, MACRO_G_RANGE, 'Fat')
  for (const v of [calories, protein, carbs, fat]) if (v instanceof Error) return { ok: false, error: v.message }

  const [c, p, cb, f] = [calories, protein, carbs, fat] as (number | undefined)[]
  if (c === undefined && p === undefined && cb === undefined && f === undefined) {
    return { ok: false, error: 'Enter calories or at least one macro.' }
  }
  const macros = { proteinG: p ?? 0, carbsG: cb ?? 0, fatG: f ?? 0 }
  const caloriesEstimated = c === undefined
  return {
    ok: true,
    caloriesEstimated,
    macros: { calories: c ?? macroCalories(macros), ...macros },
  }
}

// ---- Foods ----------------------------------------------------------------------

export function foodFromCustom(c: CustomFood): FoodItem {
  return {
    id: `custom:${c.id}`,
    name: c.name,
    serving: c.servingLabel,
    category: 'staple',
    calories: c.calories,
    proteinG: c.proteinG,
    carbsG: c.carbsG,
    fatG: c.fatG,
  }
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/**
 * Case/accent-insensitive search over names, servings and category labels.
 * Every word typed must appear somewhere; names that start with the query
 * rank first, then names where a word starts with it, then everything else.
 * An empty query returns the list unchanged (alphabetical).
 */
export function searchFoods(query: string, foods: FoodItem[], limit = 40): FoodItem[] {
  const q = normalize(query).trim()
  const byName = (a: FoodItem, b: FoodItem) => a.name.localeCompare(b.name)
  if (q === '') return [...foods].sort(byName).slice(0, limit)

  const tokens = q.split(/\s+/)
  const scored: { food: FoodItem; score: number }[] = []
  for (const food of foods) {
    const name = normalize(food.name)
    const haystack = `${name} ${normalize(food.serving)} ${normalize(CATEGORY_LABELS[food.category])}`
    if (!tokens.every((t) => haystack.includes(t))) continue
    const score = name.startsWith(q) ? 0 : name.split(/[\s/(,]+/).some((w) => w.startsWith(tokens[0] ?? q)) ? 1 : 2
    scored.push({ food, score })
  }
  return scored
    .sort((a, b) => a.score - b.score || byName(a.food, b.food))
    .slice(0, limit)
    .map((s) => s.food)
}

// ---- Daily and weekly totals ------------------------------------------------------

export function dailyTotals(logs: MealLog[], date: string): Macros {
  return sumMacros(logs.filter((l) => l.date === date))
}

/** 0..1 towards a target; 0 when there isn't one. */
export function progressTowards(value: number, target: number | undefined): number {
  if (!target || target <= 0) return 0
  return Math.min(1, Math.max(0, value / target))
}

export interface WeeklyNutrition {
  /** How many of the last `days` days have anything logged. */
  daysLogged: number
  /** Averages over the days that were logged (a day you didn't log isn't a day you ate nothing). */
  avgCalories: number
  avgProteinG: number
  avgCarbsG: number
  avgFatG: number
  /** Oldest first; null = nothing logged that day. */
  days: { date: string; totals: Macros | null }[]
}

export function weeklyNutrition(logs: MealLog[], today: string, days = 7): WeeklyNutrition {
  const perDay = lastNDays(today, days)
    .reverse()
    .map((date) => {
      const entries = logs.filter((l) => l.date === date)
      return { date, totals: entries.length > 0 ? sumMacros(entries) : null }
    })
  const logged = perDay.filter((d): d is { date: string; totals: Macros } => d.totals !== null)
  const avg = (pick: (m: Macros) => number) =>
    logged.length === 0 ? 0 : logged.reduce((s, d) => s + pick(d.totals), 0) / logged.length
  return {
    daysLogged: logged.length,
    avgCalories: Math.round(avg((m) => m.calories)),
    avgProteinG: Math.round(avg((m) => m.proteinG)),
    avgCarbsG: Math.round(avg((m) => m.carbsG)),
    avgFatG: Math.round(avg((m) => m.fatG)),
    days: perDay,
  }
}
