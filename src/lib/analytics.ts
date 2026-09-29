import { db } from '../db/schema'

/**
 * Local-only analytics. Never leaves the device — writes straight to the
 * AppEvent Dexie table. No vendor, no network call, ever.
 */

export type TrackEventName =
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'workout_started'
  | 'workout_completed'
  | 'workout_abandoned'
  | 'exercise_skipped'
  | 'pr_achieved'
  | 'streak_broken'
  | 'data_exported'
  | 'data_imported'
  | 'delete_all_data_invoked'

export async function track(
  eventName: TrackEventName,
  props?: Record<string, unknown>,
): Promise<void> {
  await db.appEvents.add({
    name: eventName,
    propsJson: props ? JSON.stringify(props) : undefined,
    occurredAt: Date.now(),
  })
}
