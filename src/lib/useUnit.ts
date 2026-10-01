import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import type { WeightUnit } from '../db/types'

/** The user's display unit (weights are always stored in kg). Defaults to kg while loading. */
export function useUnit(): WeightUnit {
  return useLiveQuery(async () => (await db.profile.orderBy('createdAt').last())?.weightUnit, []) ?? 'kg'
}
