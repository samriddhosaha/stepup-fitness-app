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
    activeWeeksInARow: z.number().int().min(0).max(1000),
    bodyWeightTrendKg: z
      .object({ start: z.number().min(20).max(500), end: z.number().min(20).max(500) })
      .strict()
      .nullable(),
    /** What the person asked for. Absent means the usual weekly review. */
    focus: z.enum(['review', 'next-week']).optional(),
    /**
     * Opt-in, separately consented summary of the last 7 days of nutrition, recovery check-ins
     * and water. Averages only: no food names, no habit names, no free text. Omitted entirely
     * unless the person turned it on.
     */
    wellbeing: z
      .object({
        nutrition: z
          .object({
            daysLogged: z.number().int().min(1).max(7),
            avgProteinG: z.number().int().min(0).max(1000),
            avgCalories: z.number().int().min(0).max(20000),
            proteinTargetG: z.number().int().min(20).max(400).nullable(),
          })
          .strict()
          .nullable(),
        recovery: z
          .object({
            checkIns: z.number().int().min(1).max(7),
            avgSleepHours: z.number().min(0).max(24),
            avgSoreness: z.number().min(1).max(3),
            avgEnergy: z.number().min(1).max(3),
          })
          .strict()
          .nullable(),
        hydration: z
          .object({
            daysLogged: z.number().int().min(1).max(7),
            avgMl: z.number().int().min(0).max(20000),
          })
          .strict()
          .nullable(),
      })
      .strict()
      .optional(),
  })
  .strict()

export type WeeklyReviewPayload = z.infer<typeof weeklyReviewSchema>
