import { describe, expect, it } from 'vitest'
import {
  CALORIE_FLOOR,
  calculateTargets,
  dailyTotals,
  effectiveTargets,
  foodFromCustom,
  macroCalories,
  mifflinStJeor,
  progressTowards,
  resolveQuickAdd,
  scaleMacros,
  searchFoods,
  sumMacros,
  targetsForProfile,
  weeklyNutrition,
} from './nutrition'
import { FOOD_LIBRARY, getSeedFood } from '../db/foodLibrary'
import type { CustomFood, MealLog } from '../db/types'

describe('Mifflin-St Jeor', () => {
  const body = { weightKg: 80, heightCm: 178, age: 30 }
  it('uses +5 for men and -161 for women', () => {
    expect(mifflinStJeor({ ...body, sex: 'male' })).toBe(1767.5)
    expect(mifflinStJeor({ ...body, sex: 'female' })).toBe(1601.5)
  })
  it('uses the midpoint rather than guessing when sex is unspecified or unknown', () => {
    expect(mifflinStJeor({ ...body, sex: 'unspecified' })).toBe(1684.5)
    expect(mifflinStJeor({ ...body, sex: undefined })).toBe(1684.5)
  })
})

describe('calculateTargets', () => {
  const base = { weightKg: 80, heightCm: 178, age: 30, sex: 'male' as const, activityLevel: 'moderate' as const }

  it('maintenance: TDEE, protein 1.6 g/kg, 25% fat, the rest carbs', () => {
    const t = calculateTargets({ ...base, goal: 'maintain' })
    expect(t).toMatchObject({
      ok: true,
      bmr: 1768,
      tdee: 2740,
      calories: 2740,
      proteinG: 130,
      fatG: 76,
      carbsG: 384,
      floored: false,
    })
  })

  it('losing fat: about 20% below maintenance with more protein', () => {
    const t = calculateTargets({ ...base, goal: 'lose' })
    expect(t).toMatchObject({ ok: true, calories: 2190, proteinG: 160, fatG: 61, carbsG: 250 })
  })

  it('building muscle: about 10% above maintenance', () => {
    const t = calculateTargets({ ...base, goal: 'gain' })
    expect(t).toMatchObject({ ok: true, calories: 3010, proteinG: 145, fatG: 84, carbsG: 419 })
  })

  it('macros add back up to roughly the calorie target', () => {
    for (const goal of ['lose', 'maintain', 'gain'] as const) {
      const t = calculateTargets({ ...base, goal })
      if (!t.ok) throw new Error('expected targets')
      expect(Math.abs(macroCalories({ proteinG: t.proteinG, carbsG: t.carbsG, fatG: t.fatG }) - t.calories)).toBeLessThan(20)
    }
  })

  it('higher activity raises the target', () => {
    const low = calculateTargets({ ...base, activityLevel: 'sedentary' })
    const high = calculateTargets({ ...base, activityLevel: 'very-active' })
    if (!low.ok || !high.ok) throw new Error('expected targets')
    expect(high.calories).toBeGreaterThan(low.calories)
  })

  it('never suggests eating below the calorie floor, and says so', () => {
    const t = calculateTargets({
      weightKg: 45,
      heightCm: 150,
      age: 50,
      sex: 'female',
      activityLevel: 'sedentary',
      goal: 'lose',
    })
    expect(t).toMatchObject({ ok: true, calories: CALORIE_FLOOR, floored: true })
  })

  it('defaults to light activity and maintenance when unspecified', () => {
    const t = calculateTargets({ weightKg: 70, heightCm: 170, age: 30, sex: 'male' })
    if (!t.ok) throw new Error('expected targets')
    const explicit = calculateTargets({
      weightKg: 70, heightCm: 170, age: 30, sex: 'male', activityLevel: 'light', goal: 'maintain',
    })
    expect(t).toEqual(explicit)
  })

  it('lists exactly what is missing instead of guessing', () => {
    expect(calculateTargets({})).toEqual({ ok: false, missing: ['weight', 'height', 'age'] })
    expect(calculateTargets({ weightKg: 70 })).toEqual({ ok: false, missing: ['height', 'age'] })
    expect(calculateTargets({ weightKg: 70, heightCm: 170, age: 30 }).ok).toBe(true)
  })
})

describe('effectiveTargets', () => {
  const calc = calculateTargets({ weightKg: 80, heightCm: 178, age: 30, sex: 'male', activityLevel: 'moderate' })

  it('uses the calculation when the user has set nothing', () => {
    expect(effectiveTargets({}, calc)).toMatchObject({ calories: 2740, proteinG: 130, source: 'calculated' })
  })
  it('lets the user override either number, and says when it is a mix', () => {
    expect(effectiveTargets({ calorieTargetKcal: 2500 }, calc)).toMatchObject({
      calories: 2500, proteinG: 130, source: 'mixed',
    })
  })
  it('is fully custom when both are overridden', () => {
    expect(effectiveTargets({ calorieTargetKcal: 2500, proteinTargetG: 150 }, calc)).toMatchObject({
      calories: 2500, proteinG: 150, source: 'custom',
    })
  })
  it('still works from custom numbers when the profile is incomplete', () => {
    const incomplete = calculateTargets({})
    expect(effectiveTargets({ calorieTargetKcal: 2200 }, incomplete)).toEqual({
      calories: 2200, proteinG: undefined, source: 'custom',
    })
    expect(effectiveTargets({}, incomplete)).toEqual({ calories: undefined, proteinG: undefined, source: null })
  })
})

describe('macros', () => {
  it('derives calories from macros (4/4/9)', () => {
    expect(macroCalories({ proteinG: 30, carbsG: 10, fatG: 5 })).toBe(205)
  })
  it('scales by servings with sensible rounding', () => {
    const roti = { calories: 105, proteinG: 3.5, carbsG: 18, fatG: 2 }
    expect(scaleMacros(roti, 2)).toEqual({ calories: 210, proteinG: 7, carbsG: 36, fatG: 4 })
    expect(scaleMacros(roti, 0.5)).toEqual({ calories: 53, proteinG: 1.8, carbsG: 9, fatG: 1 })
  })
  it('sums entries', () => {
    expect(
      sumMacros([
        { calories: 105, proteinG: 3.5, carbsG: 18, fatG: 2 },
        { calories: 150, proteinG: 8, carbsG: 20.2, fatG: 4 },
      ]),
    ).toEqual({ calories: 255, proteinG: 11.5, carbsG: 38.2, fatG: 6 })
    expect(sumMacros([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 })
  })
  it('measures progress towards a target', () => {
    expect(progressTowards(500, 2000)).toBe(0.25)
    expect(progressTowards(3000, 2000)).toBe(1)
    expect(progressTowards(100, undefined)).toBe(0)
    expect(progressTowards(100, 0)).toBe(0)
  })
})

describe('resolveQuickAdd', () => {
  const blank = { calories: '', proteinG: '', carbsG: '', fatG: '' }

  it('needs at least one number', () => {
    expect(resolveQuickAdd(blank)).toEqual({ ok: false, error: 'Enter calories or at least one macro.' })
  })
  it('accepts calories alone', () => {
    expect(resolveQuickAdd({ ...blank, calories: '450' })).toEqual({
      ok: true,
      caloriesEstimated: false,
      macros: { calories: 450, proteinG: 0, carbsG: 0, fatG: 0 },
    })
  })
  it('works out calories from macros when they are left blank', () => {
    const r = resolveQuickAdd({ ...blank, proteinG: '30' })
    expect(r).toMatchObject({ ok: true, caloriesEstimated: true })
    if (r.ok) expect(r.macros.calories).toBe(120)
    const mixed = resolveQuickAdd({ ...blank, proteinG: '20', carbsG: '30', fatG: '10' })
    if (mixed.ok) expect(mixed.macros.calories).toBe(290)
  })
  it('keeps calories the user typed even if they disagree with the macros', () => {
    const r = resolveQuickAdd({ calories: '500', proteinG: '10', carbsG: '10', fatG: '10' })
    if (r.ok) expect(r.macros.calories).toBe(500)
  })
  it('rejects out-of-range and non-numeric values with a clear message', () => {
    expect(resolveQuickAdd({ ...blank, calories: '9000' })).toMatchObject({ ok: false })
    expect(resolveQuickAdd({ ...blank, proteinG: '-5' })).toMatchObject({ ok: false, error: 'Protein must be between 0 and 500.' })
    expect(resolveQuickAdd({ ...blank, fatG: 'lots' })).toEqual({ ok: false, error: 'Fat must be a number.' })
  })
})

describe('built-in food list', () => {
  it('has unique ids and the Indian staples we promised', () => {
    const ids = FOOD_LIBRARY.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id.startsWith('seed:'))).toBe(true)
    for (const slug of ['roti', 'rice-cooked', 'dal', 'paneer', 'idli', 'dosa', 'chicken-curry', 'egg-boiled']) {
      expect(getSeedFood(`seed:${slug}`)).toBeDefined()
    }
  })
  it('has sane, internally consistent numbers (catches typos)', () => {
    for (const f of FOOD_LIBRARY) {
      expect(f.name.length, f.id).toBeGreaterThan(0)
      expect(f.serving.length, f.id).toBeGreaterThan(0)
      for (const n of [f.calories, f.proteinG, f.carbsG, f.fatG]) expect(n, f.id).toBeGreaterThanOrEqual(0)
      const implied = macroCalories(f)
      // Fibre, rounding and alcohol-free simplifications: allow 15% or 15 kcal.
      expect(Math.abs(implied - f.calories), `${f.id}: ${f.calories} vs ${implied}`).toBeLessThanOrEqual(
        Math.max(15, f.calories * 0.15),
      )
    }
  })
})

describe('searchFoods', () => {
  const names = (q: string, foods = FOOD_LIBRARY) => searchFoods(q, foods).map((f) => f.name)

  it('finds foods by name, ignoring case', () => {
    expect(names('ROTI')[0]).toBe('Roti / chapati')
    expect(names('paneer')).toEqual(expect.arrayContaining(['Paneer', 'Paneer bhurji', 'Palak paneer']))
  })
  it('ranks names that start with the query above ones that merely contain it', () => {
    const result = names('chicken')
    expect(result.slice(0, 3).every((n) => n.toLowerCase().startsWith('chicken'))).toBe(true)
  })
  it('requires every word to match', () => {
    expect(names('chicken curry')).toEqual(['Chicken curry'])
    expect(names('dal toor')).toEqual(['Dal (toor / moong), cooked'])
  })
  it('searches category labels, so "indian" lists them', () => {
    const indian = searchFoods('indian', FOOD_LIBRARY, 100)
    expect(indian.length).toBeGreaterThan(15)
    expect(indian.every((f) => f.category === 'indian')).toBe(true)
  })
  it('is accent-insensitive', () => {
    const custom: CustomFood = { id: 1, name: 'Crème fraîche', servingLabel: '1 tbsp', calories: 50, proteinG: 0.5, carbsG: 0.5, fatG: 5, createdAt: 1 }
    expect(names('creme', [foodFromCustom(custom)])).toEqual(['Crème fraîche'])
  })
  it('returns nothing for a miss and the alphabetical list for an empty query', () => {
    expect(names('xyzzy')).toEqual([])
    const all = searchFoods('', FOOD_LIBRARY, 5)
    expect(all).toHaveLength(5)
    expect([...all].map((f) => f.name)).toEqual([...all].map((f) => f.name).sort((a, b) => a.localeCompare(b)))
  })
  it('turns custom foods into searchable items with their own id', () => {
    const custom: CustomFood = { id: 7, name: 'My protein bar', servingLabel: '1 bar', calories: 200, proteinG: 20, carbsG: 15, fatG: 7, createdAt: 1 }
    const item = foodFromCustom(custom)
    expect(item.id).toBe('custom:7')
    expect(item.serving).toBe('1 bar')
    expect(names('bar', [item, ...FOOD_LIBRARY])[0]).toBe('My protein bar')
  })
})

describe('daily and weekly totals', () => {
  const log = (date: string, calories: number, proteinG: number, id: number): MealLog => ({
    id, date, name: 'x', servings: 1, loggedAt: id, calories, proteinG, carbsG: 0, fatG: 0,
  })
  const logs = [
    log('2026-10-31', 500, 40, 1),
    log('2026-10-31', 700, 50, 2),
    log('2026-10-30', 2000, 120, 3),
    log('2026-10-27', 1800, 140, 4),
    log('2026-10-01', 9999, 999, 5), // outside the window
  ]

  it('totals one day', () => {
    expect(dailyTotals(logs, '2026-10-31')).toMatchObject({ calories: 1200, proteinG: 90 })
    expect(dailyTotals(logs, '2026-10-29')).toMatchObject({ calories: 0, proteinG: 0 })
  })

  it('averages only over the days that were logged', () => {
    const week = weeklyNutrition(logs, '2026-10-31')
    expect(week.daysLogged).toBe(3)
    expect(week.avgCalories).toBe(Math.round((1200 + 2000 + 1800) / 3))
    expect(week.avgProteinG).toBe(Math.round((90 + 120 + 140) / 3))
    expect(week.days).toHaveLength(7)
    expect(week.days[0]?.date).toBe('2026-10-25')
    expect(week.days.at(-1)?.totals?.calories).toBe(1200)
    expect(week.days.find((d) => d.date === '2026-10-29')?.totals).toBeNull()
  })

  it('handles a week with nothing logged', () => {
    expect(weeklyNutrition([], '2026-10-31')).toMatchObject({ daysLogged: 0, avgCalories: 0, avgProteinG: 0 })
  })
})

describe('targetsForProfile', () => {
  const profile = { age: 30, sex: 'male' as const, heightCm: 178, activityLevel: 'moderate' as const, nutritionGoal: 'lose' as const }

  it('calculates from the profile and bodyweight', () => {
    const t = targetsForProfile(profile, 80)
    expect(t.calculated).toMatchObject({ ok: true, calories: 2190, proteinG: 160 })
    expect(t.effective).toMatchObject({ calories: 2190, proteinG: 160, source: 'calculated' })
  })
  it('applies the user overrides on top', () => {
    const t = targetsForProfile({ ...profile, calorieTargetKcal: 2300, proteinTargetG: 170 }, 80)
    expect(t.effective).toMatchObject({ calories: 2300, proteinG: 170, source: 'custom' })
    expect(t.calculated).toMatchObject({ ok: true, calories: 2190 })
  })
  it('reports what is missing when there is no bodyweight yet', () => {
    expect(targetsForProfile(profile, undefined).calculated).toEqual({ ok: false, missing: ['weight'] })
  })
  it('scales protein with bodyweight', () => {
    const light = targetsForProfile({ ...profile, nutritionGoal: 'maintain' }, 60)
    expect(light.effective.proteinG).toBe(95) // 60 x 1.6 = 96 -> 95
  })
})
