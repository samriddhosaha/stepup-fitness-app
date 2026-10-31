import type {
  BodyMeasurement,
  CheckIn,
  MeasurementType,
  WaterLog,
  WeightUnit,
} from '../db/types'
import { lastNDays } from './format'
import type { NumericRange } from './validation'

/**
 * Pure maths for the daily-health features. Everything here is a rough,
 * everyday guide — not medical advice.
 */

// ---- Water ------------------------------------------------------------------

export const WATER_QUICK_ML = [150, 250, 500]
export const WATER_ML_PER_KG = 35
export const WATER_GOAL_MIN_ML = 1500
export const WATER_GOAL_MAX_ML = 4500
export const WATER_GOAL_DEFAULT_ML = 2000
export const WATER_GOAL_STEP_ML = 250
export const WATER_CUSTOM_RANGE: NumericRange = { min: 10, max: 2000 }

/** ~35 ml per kg of bodyweight, rounded to 50 ml and kept in a sensible range. */
export function defaultWaterGoalMl(bodyWeightKg: number | undefined): number {
  if (bodyWeightKg === undefined || !Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0) {
    return WATER_GOAL_DEFAULT_ML
  }
  const raw = Math.round((bodyWeightKg * WATER_ML_PER_KG) / 50) * 50
  return Math.min(WATER_GOAL_MAX_ML, Math.max(WATER_GOAL_MIN_ML, raw))
}

/** The user's own goal if they set one, else the bodyweight-based default. */
export function waterGoalFor(userGoalMl: number | undefined, bodyWeightKg: number | undefined): number {
  if (userGoalMl !== undefined && userGoalMl > 0) return userGoalMl
  return defaultWaterGoalMl(bodyWeightKg)
}

export function waterTotalFor(logs: WaterLog[], date: string): number {
  return logs.filter((l) => l.date === date).reduce((sum, l) => sum + l.ml, 0)
}

/** 0..1 for the progress ring (it stops at full; the number can go past the goal). */
export function waterFraction(totalMl: number, goalMl: number): number {
  if (goalMl <= 0) return 0
  return Math.min(1, Math.max(0, totalMl / goalMl))
}

/** The most recent entry for a date — what "Undo last" removes. */
export function lastWaterLog(logs: WaterLog[], date: string): WaterLog | undefined {
  return logs
    .filter((l) => l.date === date)
    .sort((a, b) => a.loggedAt - b.loggedAt || (a.id ?? 0) - (b.id ?? 0))
    .at(-1)
}

/** Daily totals for the last `days` days, oldest first (days with no entries are 0). */
export function waterByDay(logs: WaterLog[], today: string, days: number): { date: string; value: number }[] {
  const totals = new Map<string, number>()
  for (const l of logs) totals.set(l.date, (totals.get(l.date) ?? 0) + l.ml)
  return lastNDays(today, days)
    .reverse()
    .map((date) => ({ date, value: totals.get(date) ?? 0 }))
}

export const WATER_REMINDER_START_HOUR = 9
export const WATER_REMINDER_END_HOUR = 21

/**
 * A water nudge is due when reminders are on, it's daytime, the goal isn't
 * met, and it has been at least `intervalHours` since both the last drink
 * logged and the last nudge — so logging water quietens the reminders.
 */
export function shouldRemindWater(p: {
  now: number
  hour: number
  intervalHours: number | undefined
  intakeMl: number
  goalMl: number
  lastLogAt?: number
  lastRemindedAt?: number
}): boolean {
  if (!p.intervalHours || p.intervalHours <= 0) return false
  if (p.hour < WATER_REMINDER_START_HOUR || p.hour >= WATER_REMINDER_END_HOUR) return false
  if (p.intakeMl >= p.goalMl) return false
  const gap = p.intervalHours * 60 * 60 * 1000
  if (p.lastLogAt !== undefined && p.now - p.lastLogAt < gap) return false
  if (p.lastRemindedAt !== undefined && p.now - p.lastRemindedAt < gap) return false
  return true
}

// ---- Measurements ---------------------------------------------------------------

export const MEASUREMENT_TYPES: { value: MeasurementType; label: string }[] = [
  { value: 'waist', label: 'Waist' },
  { value: 'chest', label: 'Chest' },
  { value: 'hips', label: 'Hips' },
  { value: 'arm', label: 'Arm' },
  { value: 'thigh', label: 'Thigh' },
  { value: 'neck', label: 'Neck' },
]

const CM_PER_INCH = 2.54

/** Lengths follow the weight unit: lb users see inches, kg users see cm. */
export function lengthUnitLabel(unit: WeightUnit): string {
  return unit === 'lb' ? 'in' : 'cm'
}

export function cmToDisplay(cm: number, unit: WeightUnit): number {
  return unit === 'lb' ? Math.round((cm / CM_PER_INCH) * 10) / 10 : Math.round(cm * 10) / 10
}

export function displayToCm(value: number, unit: WeightUnit): number {
  const cm = unit === 'lb' ? value * CM_PER_INCH : value
  return Math.round(cm * 10) / 10
}

export const MEASUREMENT_CM_RANGE: NumericRange = { min: 10, max: 300 }

export function measurementRangeForUnit(unit: WeightUnit): NumericRange {
  return unit === 'lb'
    ? {
        min: Math.ceil(MEASUREMENT_CM_RANGE.min / CM_PER_INCH),
        max: Math.floor(MEASUREMENT_CM_RANGE.max / CM_PER_INCH),
      }
    : MEASUREMENT_CM_RANGE
}

export interface MeasurementSummary {
  type: MeasurementType
  latest: BodyMeasurement
  /** Change in cm since the entry before this one. */
  changeCm?: number
}

/** The newest reading of each type, with how much it moved since the one before. */
export function measurementSummaries(entries: BodyMeasurement[]): MeasurementSummary[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
  const out: MeasurementSummary[] = []
  for (const { value } of MEASUREMENT_TYPES) {
    const of = sorted.filter((e) => e.type === value)
    const latest = of.at(-1)
    if (!latest) continue
    const previous = of.at(-2)
    out.push({
      type: value,
      latest,
      changeCm: previous ? Math.round((latest.valueCm - previous.valueCm) * 10) / 10 : undefined,
    })
  }
  return out
}

// ---- Recovery check-in -----------------------------------------------------------

export const SLEEP_CHOICES = [
  { hours: 5, label: '≤5h' },
  { hours: 6, label: '6h' },
  { hours: 7, label: '7h' },
  { hours: 8, label: '8h' },
  { hours: 9, label: '9h+' },
]

export type ReadinessLevel = 'push' | 'normal' | 'easy'

export interface Readiness {
  level: ReadinessLevel
  /** 0 (rough) to 6 (great). */
  score: number
  headline: string
  detail: string
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

/**
 * A simple, transparent readiness hint from the three check-in answers: each
 * scores 0-2, the total decides the message. A nudge, not a prescription.
 */
export function readinessFor(c: Pick<CheckIn, 'sleepHours' | 'soreness' | 'energy'>): Readiness {
  const sleep = c.sleepHours >= 7 ? 2 : c.sleepHours >= 6 ? 1 : 0
  const body = c.soreness === 1 ? 2 : c.soreness === 2 ? 1 : 0
  const energy = c.energy === 3 ? 2 : c.energy === 2 ? 1 : 0
  const score = sleep + body + energy

  const limiting: string[] = []
  if (sleep === 0) limiting.push('short on sleep')
  if (body === 0) limiting.push('very sore')
  if (energy === 0) limiting.push('low on energy')

  if (score >= 5) {
    return {
      level: 'push',
      score,
      headline: 'Ready to push',
      detail: 'You’re rested and fresh. A good day to chase a heavier set.',
    }
  }
  if (score >= 3) {
    return {
      level: 'normal',
      score,
      headline: 'A normal day',
      detail: 'Train as planned and let the weights tell you how it goes.',
    }
  }
  return {
    level: 'easy',
    score,
    headline: 'Take it easy',
    detail: `You’re ${joinList(limiting) || 'a bit run down'}. Keep the weights light or shorten the session — showing up still counts.`,
  }
}

// ---- Habits -----------------------------------------------------------------------

export const DEFAULT_HABITS = ['Creatine', 'Supplements', 'Mobility']

/**
 * Consecutive days a habit was done, ending today. If today isn't done yet the
 * streak is counted back from yesterday, so it only breaks once a whole day
 * has actually been missed.
 */
export function habitStreak(doneDates: Iterable<string>, today: string): number {
  const done = new Set(doneDates)
  const days = lastNDays(today, 400) // newest first
  let i = done.has(today) ? 0 : 1
  let streak = 0
  while (i < days.length && done.has(days[i]!)) {
    streak += 1
    i += 1
  }
  return streak
}

/** The last `count` days oldest -> newest, flagged done or not. */
export function recentHabitDays(
  doneDates: Iterable<string>,
  today: string,
  count = 7,
): { date: string; done: boolean }[] {
  const done = new Set(doneDates)
  return lastNDays(today, count)
    .reverse()
    .map((date) => ({ date, done: done.has(date) }))
}
