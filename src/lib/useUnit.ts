import { useLiveQuery } from 'dexie-react-hooks'
import { getActiveProfile } from '../db/schema'
import type { WeightUnit } from '../db/types'

/** The user's display unit (weights are always stored in kg). Defaults to kg while loading. */
export function useUnit(): WeightUnit {
  return useLiveQuery(async () => (await getActiveProfile())?.weightUnit, []) ?? 'kg'
}
