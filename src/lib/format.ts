import type { WeightUnit } from '../db/types'

const KG_PER_LB = 0.45359237

export function kgToDisplay(kg: number, unit: WeightUnit): number {
  const value = unit === 'lb' ? kg / KG_PER_LB : kg
  return Math.round(value * 10) / 10
}

export function displayToKg(value: number, unit: WeightUnit): number {
  const kg = unit === 'lb' ? value * KG_PER_LB : value
  return Math.round(kg * 100) / 100
}

export function unitLabel(unit: WeightUnit): string {
  return unit === 'lb' ? 'lb' : 'kg'
}

export function todayISODate(): string {
  return toISODate(new Date())
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daysAgoISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toISODate(d)
}

export function startOfWeekISO(): string {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // Monday-first
  return toISODate(d)
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function greetingForNow(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
