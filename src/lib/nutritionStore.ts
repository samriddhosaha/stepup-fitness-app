import { db, type StepUpDB } from '../db/schema'
import type { CustomFood, Macros, MealLog, SavedMeal } from '../db/types'
import type { FoodItem } from '../db/foodLibrary'
import { todayISODate } from './format'
import { scaleMacros } from './nutrition'

// Thin database operations for nutrition. The maths lives in nutrition.ts.

/** Logs a food (macros are scaled by servings and stored as a snapshot). */
export async function logFood(
  food: FoodItem,
  servings: number,
  database: StepUpDB = db,
  date: string = todayISODate(),
): Promise<number> {
  const macros = scaleMacros(food, servings)
  return (await database.mealLogs.add({
    date,
    name: food.name,
    servings,
    foodRef: food.id,
    loggedAt: Date.now(),
    ...macros,
  })) as number
}

/** Logs raw numbers with no food behind them. */
export async function logQuickAdd(
  macros: Macros,
  name: string,
  database: StepUpDB = db,
  date: string = todayISODate(),
): Promise<number> {
  return (await database.mealLogs.add({
    date,
    name: name.trim().slice(0, 60) || 'Quick add',
    servings: 1,
    loggedAt: Date.now(),
    ...macros,
  })) as number
}

export async function logSavedMeal(
  meal: SavedMeal,
  database: StepUpDB = db,
  date: string = todayISODate(),
): Promise<number> {
  return (await database.mealLogs.add({
    date,
    name: meal.name,
    servings: 1,
    loggedAt: Date.now(),
    calories: meal.calories,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG,
  })) as number
}

/** Saves a logged entry as a favourite (its macros as eaten, i.e. already scaled). */
export async function saveAsFavourite(entry: MealLog, database: StepUpDB = db): Promise<number> {
  return (await database.savedMeals.add({
    name: entry.servings !== 1 ? `${entry.name} × ${entry.servings}` : entry.name,
    calories: entry.calories,
    proteinG: entry.proteinG,
    carbsG: entry.carbsG,
    fatG: entry.fatG,
    createdAt: Date.now(),
  })) as number
}

export async function createCustomFood(
  food: Omit<CustomFood, 'id' | 'createdAt'>,
  database: StepUpDB = db,
): Promise<CustomFood> {
  const row: CustomFood = {
    ...food,
    name: food.name.trim().slice(0, 60),
    servingLabel: food.servingLabel.trim().slice(0, 40) || '1 serving',
    createdAt: Date.now(),
  }
  const id = (await database.foods.add(row)) as number
  return { ...row, id }
}

/** Favourites, newest first. (Sorted in memory: `createdAt` isn't an indexed field.) */
export async function listFavourites(database: StepUpDB = db): Promise<SavedMeal[]> {
  const meals = await database.savedMeals.toArray()
  return meals.sort((a, b) => b.createdAt - a.createdAt || (b.id ?? 0) - (a.id ?? 0))
}
