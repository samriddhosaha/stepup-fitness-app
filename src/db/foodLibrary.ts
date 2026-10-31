import type { Macros } from './types'

/**
 * A small starter list of everyday foods, with per-serving macros.
 *
 * EVERY VALUE HERE IS APPROXIMATE. Real foods vary a lot with recipe, oil,
 * brand and portion size (a "katori" of dal at home is not the same as one
 * from a restaurant). Treat these as a starting point and use custom foods or
 * quick-add when you know better. They live in code, not the database, so the
 * list can be improved in an update without migrating anyone's data.
 */

export type FoodCategory = 'indian' | 'protein' | 'staple' | 'dairy' | 'fruit-snack'

export interface FoodItem extends Macros {
  /** Stable id, 'seed:<slug>'. Custom foods use 'custom:<id>'. */
  id: string
  name: string
  /** What one serving is. Macros below are for exactly this. */
  serving: string
  category: FoodCategory
}

export const CATEGORY_LABELS: Record<FoodCategory, string> = {
  indian: 'Indian',
  protein: 'Protein',
  staple: 'Staples',
  dairy: 'Dairy',
  'fruit-snack': 'Fruit & snacks',
}

function food(
  slug: string,
  name: string,
  serving: string,
  category: FoodCategory,
  calories: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
): FoodItem {
  return { id: `seed:${slug}`, name, serving, category, calories, proteinG, carbsG, fatG }
}

export const FOOD_LIBRARY: FoodItem[] = [
  // ---- Indian staples & meals -------------------------------------------------
  food('roti', 'Roti / chapati', '1 medium (40 g)', 'indian', 105, 3.5, 18, 2),
  food('paratha', 'Paratha, plain', '1 (80 g)', 'indian', 260, 5, 36, 10),
  food('rice-cooked', 'Rice, cooked', '1 cup (160 g)', 'indian', 205, 4, 45, 0.5),
  food('dal', 'Dal (toor / moong), cooked', '1 katori (150 g)', 'indian', 150, 8, 20, 4),
  food('rajma', 'Rajma curry', '1 katori (150 g)', 'indian', 190, 9, 25, 5),
  food('chana-masala', 'Chana masala', '1 katori (150 g)', 'indian', 210, 9, 28, 7),
  food('sambar', 'Sambar', '1 katori (150 g)', 'indian', 90, 4, 13, 2.5),
  food('khichdi', 'Dal khichdi', '1 katori (200 g)', 'indian', 220, 8, 36, 4),
  food('idli', 'Idli', '1 piece (40 g)', 'indian', 58, 2, 12, 0.4),
  food('dosa', 'Dosa, plain', '1 medium', 'indian', 135, 3, 24, 3),
  food('masala-dosa', 'Masala dosa', '1 medium', 'indian', 250, 6, 38, 9),
  food('upma', 'Upma', '1 katori (150 g)', 'indian', 190, 4, 30, 6),
  food('poha', 'Poha', '1 plate (150 g)', 'indian', 250, 5, 40, 7),
  food('paneer', 'Paneer', '100 g', 'indian', 265, 18, 1.5, 21),
  food('paneer-bhurji', 'Paneer bhurji', '1 katori (150 g)', 'indian', 300, 17, 7, 22),
  food('palak-paneer', 'Palak paneer', '1 katori (150 g)', 'indian', 260, 12, 8, 20),
  food('chicken-curry', 'Chicken curry', '1 katori (200 g, with gravy)', 'indian', 280, 24, 8, 17),
  food('tandoori-chicken', 'Tandoori chicken', '2 pieces (150 g)', 'indian', 260, 32, 4, 12),
  food('fish-curry', 'Fish curry', '1 katori (200 g)', 'indian', 210, 20, 6, 12),
  food('veg-curry', 'Mixed vegetable curry', '1 katori (150 g)', 'indian', 120, 3, 12, 7),
  food('chicken-biryani', 'Chicken biryani', '1 plate (300 g)', 'indian', 480, 25, 58, 16),
  food('samosa', 'Samosa', '1 piece (60 g)', 'indian', 260, 4, 24, 17),
  food('curd', 'Curd / dahi', '1 katori (150 g)', 'indian', 95, 5, 7, 5),

  // ---- Protein ---------------------------------------------------------------
  food('egg-boiled', 'Egg, boiled', '1 large', 'protein', 78, 6.3, 0.6, 5.3),
  food('omelette', 'Omelette (2 eggs, with oil)', '1', 'protein', 190, 13, 1.5, 15),
  food('chicken-breast', 'Chicken breast, grilled', '100 g', 'protein', 165, 31, 0, 3.6),
  food('salmon', 'Salmon, cooked', '100 g', 'protein', 206, 22, 0, 12),
  food('tuna', 'Tuna, canned in water', '1 can (110 g drained)', 'protein', 120, 26, 0, 1),
  food('tofu', 'Tofu, firm', '100 g', 'protein', 144, 17, 3, 9),
  food('whey', 'Whey protein', '1 scoop (30 g)', 'protein', 120, 24, 3, 1.5),
  food('lentils', 'Lentils, cooked', '1 cup (200 g)', 'protein', 230, 18, 40, 0.8),
  food('chickpeas', 'Chickpeas, cooked', '1 cup (165 g)', 'protein', 270, 15, 45, 4),

  // ---- Dairy ------------------------------------------------------------------
  food('milk', 'Milk, whole', '1 glass (250 ml)', 'dairy', 150, 8, 12, 8),
  food('greek-yogurt', 'Greek yogurt, low fat', '1 tub (170 g)', 'dairy', 100, 17, 6, 1),

  // ---- Other staples ------------------------------------------------------------
  food('oats', 'Oats, dry', '40 g', 'staple', 150, 5, 27, 3),
  food('bread-wholewheat', 'Bread, whole wheat', '1 slice', 'staple', 80, 4, 14, 1),
  food('bread-white', 'Bread, white', '1 slice', 'staple', 75, 2.5, 14, 1),
  food('potato', 'Potato, boiled', '1 medium (170 g)', 'staple', 130, 3, 30, 0.2),
  food('sweet-potato', 'Sweet potato', '1 medium (130 g)', 'staple', 112, 2, 26, 0.1),
  food('pizza', 'Pizza', '1 slice', 'staple', 285, 12, 36, 10),

  // ---- Fruit & snacks -----------------------------------------------------------
  food('banana', 'Banana', '1 medium', 'fruit-snack', 105, 1.3, 27, 0.4),
  food('apple', 'Apple', '1 medium', 'fruit-snack', 95, 0.5, 25, 0.3),
  food('almonds', 'Almonds', '1 handful (28 g)', 'fruit-snack', 165, 6, 6, 14),
  food('peanut-butter', 'Peanut butter', '1 tbsp (16 g)', 'fruit-snack', 95, 4, 3, 8),
  food('roasted-chana', 'Roasted chana', '30 g', 'fruit-snack', 110, 6, 17, 2),
]

export function getSeedFood(id: string): FoodItem | undefined {
  return FOOD_LIBRARY.find((f) => f.id === id)
}
