import { afterEach, describe, expect, it } from 'vitest'
import { StepUpDB } from '../db/schema'
import { getSeedFood } from '../db/foodLibrary'
import {
  createCustomFood,
  listFavourites,
  logFood,
  logQuickAdd,
  logSavedMeal,
  saveAsFavourite,
} from './nutritionStore'
import { foodFromCustom, dailyTotals } from './nutrition'

const opened: StepUpDB[] = []
let n = 0
afterEach(() => {
  while (opened.length) opened.pop()!.close()
})

async function freshDb(): Promise<StepUpDB> {
  const db = new StepUpDB(`nutrition-store-${n++}`)
  await db.open()
  opened.push(db)
  return db
}

const roti = getSeedFood('seed:roti')!

describe('logging food', () => {
  it('scales macros by servings and records what was eaten', async () => {
    const db = await freshDb()
    await logFood(roti, 2, db, '2026-10-31')
    const [row] = await db.mealLogs.toArray()
    expect(row).toMatchObject({
      date: '2026-10-31',
      name: 'Roti / chapati',
      servings: 2,
      foodRef: 'seed:roti',
      calories: 210,
      proteinG: 7,
      carbsG: 36,
      fatG: 4,
    })
  })

  it('keeps history intact when a custom food is later edited or deleted', async () => {
    const db = await freshDb()
    const custom = await createCustomFood(
      { name: 'My protein bar', servingLabel: '1 bar', calories: 200, proteinG: 20, carbsG: 15, fatG: 7 },
      db,
    )
    await logFood(foodFromCustom(custom), 1.5, db, '2026-10-31')
    await db.foods.update(custom.id!, { calories: 999, proteinG: 99 })
    await db.foods.delete(custom.id!)
    const [row] = await db.mealLogs.toArray()
    expect(row).toMatchObject({ foodRef: `custom:${custom.id}`, calories: 300, proteinG: 30 })
  })

  it('quick-add stores raw numbers with a default or trimmed name', async () => {
    const db = await freshDb()
    const macros = { calories: 450, proteinG: 30, carbsG: 40, fatG: 15 }
    await logQuickAdd(macros, '   ', db, '2026-10-31')
    await logQuickAdd(macros, '  Office lunch  ', db, '2026-10-31')
    const names = (await db.mealLogs.toArray()).map((m) => m.name)
    expect(names).toEqual(['Quick add', 'Office lunch'])
    expect(dailyTotals(await db.mealLogs.toArray(), '2026-10-31').calories).toBe(900)
  })
})

describe('favourites', () => {
  it('saves an entry as eaten, and logs it again in one step', async () => {
    const db = await freshDb()
    await logFood(roti, 2, db, '2026-10-30')
    const entry = (await db.mealLogs.toArray())[0]!
    await saveAsFavourite(entry, db)
    const fav = (await db.savedMeals.toArray())[0]!
    expect(fav).toMatchObject({ name: 'Roti / chapati × 2', calories: 210, proteinG: 7 })

    await logSavedMeal(fav, db, '2026-10-31')
    const today = (await db.mealLogs.toArray()).filter((m) => m.date === '2026-10-31')
    expect(today).toHaveLength(1)
    expect(today[0]).toMatchObject({ name: 'Roti / chapati × 2', calories: 210, servings: 1 })
  })

  it('lists favourites newest first', async () => {
    const db = await freshDb()
    await db.savedMeals.bulkAdd([
      { name: 'Old', calories: 1, proteinG: 1, carbsG: 1, fatG: 1, createdAt: 1 },
      { name: 'New', calories: 1, proteinG: 1, carbsG: 1, fatG: 1, createdAt: 3 },
      { name: 'Middle', calories: 1, proteinG: 1, carbsG: 1, fatG: 1, createdAt: 2 },
    ])
    expect((await listFavourites(db)).map((m) => m.name)).toEqual(['New', 'Middle', 'Old'])
    expect(await listFavourites(await freshDb())).toEqual([])
  })

  it('does not decorate a single-serving name', async () => {
    const db = await freshDb()
    await logFood(roti, 1, db, '2026-10-30')
    await saveAsFavourite((await db.mealLogs.toArray())[0]!, db)
    expect((await db.savedMeals.toArray())[0]?.name).toBe('Roti / chapati')
  })
})

describe('custom foods', () => {
  it('trims names and falls back to "1 serving"', async () => {
    const db = await freshDb()
    const food = await createCustomFood(
      { name: '  Homemade ladoo  ', servingLabel: '  ', calories: 150, proteinG: 3, carbsG: 20, fatG: 7 },
      db,
    )
    expect(food).toMatchObject({ name: 'Homemade ladoo', servingLabel: '1 serving' })
    expect(food.id).toBeDefined()
    expect(await db.foods.count()).toBe(1)
  })
})
