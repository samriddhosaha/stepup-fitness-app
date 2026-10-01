import { z } from 'zod'
import { SKIP_REASONS } from './skipReasons.js'



/** Exercise IDs only — names are resolved server-side from the library. */
const exerciseId = z.string().min(1).max(64).regex(/^[a-z0-9-]+$/)

/**
 * Single source of truth for what the opt-in AI weekly coach sends off-device.
 * Imported by both the client (type + preview) and the API handler (validation).
 */
export const weeklyReviewSchema = z
  .object({
    sessionsCompleted: z.number().int().min(0).max(14),
    sessionsPlanned: z.number().int().min(0).max(14),
    exercises: z
      .array(
        z
          .object({
            exerciseId,
            totalSets: z.number().int().min(0).max(200),
            avgRpe: z.number().min(1).max(5).nullable(),
            metTargetRange: z.boolean(),
          })
          .strict(),
      )
      .max(40),
    skips: z
      .array(
        z
          .object({
            exerciseId,
            reason: z.enum(SKIP_REASONS),
            count: z.number().int().min(1).max(50),
          })
          .strict(),
      )
      .max(40),
    prs: z
      .array(z.object({ exerciseId, value: z.number().min(0).max(2000) }).strict())
      .max(40),
    streak: z.number().int().min(0).max(1000),
    bodyWeightTrendKg: z
      .object({ start: z.number().min(20).max(500), end: z.number().min(20).max(500) })
      .strict()
      .nullable(),
  })
  .strict()

export type WeeklyReviewPayload = z.infer<typeof weeklyReviewSchema>
