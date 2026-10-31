import type { PersonalRecord, WeightUnit, WorkoutSession } from '../db/types'
import { formatDuration, parseISODateLocal } from './format'
import { prLabel } from './prLabel'
import { formatWeight } from './units'

/**
 * The shareable workout card, drawn on a canvas in the browser. Nothing is uploaded: the image is
 * built locally and only leaves the device if the person picks "Share or save". It never contains
 * their name.
 */

export interface SummaryCardData {
  title: string
  dateLabel: string
  stats: { label: string; value: string }[]
  lifts: { name: string; detail: string }[]
  records: string[]
  streakLine: string | null
}

const MAX_LIFTS = 5
const MAX_RECORDS = 3

export function buildSummaryCardData(args: {
  session: WorkoutSession
  records: Pick<PersonalRecord, 'exerciseId' | 'kind' | 'value'>[]
  exerciseName: (id: string) => string
  unit: WeightUnit
  streakLine?: string | null
}): SummaryCardData {
  const { session, unit, exerciseName } = args

  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0)
  const volumeKg = session.exercises.reduce(
    (sum, e) => sum + e.sets.reduce((a, s) => a + (s.weightKg ?? 0) * (s.reps ?? 0), 0),
    0,
  )

  const stats = [
    { label: 'Time', value: formatDuration(session.durationSeconds ?? 0) },
    { label: 'Sets', value: String(totalSets) },
  ]
  if (volumeKg > 0) stats.push({ label: 'Lifted', value: formatWeight(volumeKg, unit) })

  const lifts = session.exercises
    .filter((e) => e.sets.length > 0)
    .slice(0, MAX_LIFTS)
    .map((e) => {
      const top = e.sets.reduce((best, s) => {
        const bw = best.weightKg ?? 0
        const w = s.weightKg ?? 0
        return w > bw || (w === bw && (s.reps ?? 0) > (best.reps ?? 0)) ? s : best
      })
      const setsText = `${e.sets.length} set${e.sets.length === 1 ? '' : 's'}`
      const detail =
        top.weightKg !== undefined && top.weightKg > 0 && top.reps !== undefined
          ? `${formatWeight(top.weightKg, unit)} × ${top.reps} · ${setsText}`
          : top.reps !== undefined
            ? `best ${top.reps} reps · ${setsText}`
            : setsText
      return { name: exerciseName(e.exerciseId), detail }
    })

  const records = args.records.slice(0, MAX_RECORDS).map((r) => `${exerciseName(r.exerciseId)}: ${prLabel(r, unit)}`)

  return {
    title: session.planSessionName,
    dateLabel: parseISODateLocal(session.date).toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
    stats,
    lifts,
    records,
    streakLine: args.streakLine ?? null,
  }
}

/**
 * Greedy word wrap with an injected `measure`, so it can be tested without a canvas. Overlong text
 * is cut with an ellipsis on the last allowed line.
 */
export function wrapText(measure: (text: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (measure(candidate) <= maxWidth || line === '') {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines

  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1] ?? ''
  while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1)
  kept[maxLines - 1] = `${last.trimEnd()}…`
  return kept
}

// ---- Drawing (browser only) ---------------------------------------------------------

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

// A fixed light, monochrome palette (matching the app's), so a shared card looks the same whatever theme is on.
const COLORS = { canvas: '#f3f3f3', ink: '#0a0a0a', faint: '#5a5a5a', onInk: '#ffffff' }
const FONT = '"Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

export async function renderSummaryCard(data: SummaryCardData): Promise<Blob> {
  // Make sure the app font is ready, or the first card falls back to the system font.
  try {
    await document.fonts.load(`700 64px ${FONT}`)
  } catch {
    // The fallback font is fine.
  }

  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  const measure = (text: string) => ctx.measureText(text).width

  const PAD = 72
  const INNER = CARD_WIDTH - PAD * 2

  ctx.fillStyle = COLORS.canvas
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  ctx.strokeStyle = COLORS.ink
  ctx.lineWidth = 6
  ctx.strokeRect(3, 3, CARD_WIDTH - 6, CARD_HEIGHT - 6)

  ctx.textBaseline = 'alphabetic'
  let y = PAD + 40

  // Brand + date
  ctx.fillStyle = COLORS.ink
  ctx.font = `700 44px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('StepUp', PAD, y)
  ctx.fillStyle = COLORS.faint
  ctx.font = `600 30px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(data.dateLabel, CARD_WIDTH - PAD, y)
  ctx.textAlign = 'left'

  // Title
  y += 110
  ctx.fillStyle = COLORS.ink
  ctx.font = `700 96px ${FONT}`
  const titleLines = wrapText(measure, data.title, INNER, 2)
  for (const line of titleLines) {
    ctx.fillText(line, PAD, y)
    y += 106
  }
  ctx.font = `600 34px ${FONT}`
  ctx.fillStyle = COLORS.faint
  ctx.fillText('Workout complete', PAD, y - 36)
  y += 20

  // Stats
  const colWidth = INNER / Math.max(1, data.stats.length)
  data.stats.forEach((stat, i) => {
    const x = PAD + i * colWidth
    ctx.fillStyle = COLORS.ink
    ctx.font = `700 ${stat.value.length > 7 ? 58 : 76}px ${FONT}`
    ctx.fillText(stat.value, x, y + 70)
    ctx.fillStyle = COLORS.faint
    ctx.font = `700 26px ${FONT}`
    ctx.fillText(stat.label.toUpperCase(), x, y + 116)
  })
  y += 170

  ctx.fillStyle = COLORS.ink
  ctx.fillRect(PAD, y, INNER, 4)
  y += 56

  // Lifts: as many as fit above the records block and the footer, then "+N more".
  const LIFT_ROW = 62
  const recordsHeight = data.records.length > 0 ? 20 + 90 + data.records.length * 50 : 0
  const footerTop = CARD_HEIGHT - PAD - 100
  const maxRows = Math.max(1, Math.floor((footerTop - recordsHeight - y) / LIFT_ROW))
  const truncated = data.lifts.length > maxRows
  const visibleLifts = truncated ? data.lifts.slice(0, Math.max(0, maxRows - 1)) : data.lifts
  for (const lift of visibleLifts) {
    ctx.fillStyle = COLORS.ink
    ctx.font = `700 38px ${FONT}`
    ctx.textAlign = 'left'
    const name = wrapText(measure, lift.name, INNER * 0.55, 1)[0] ?? ''
    ctx.fillText(name, PAD, y)
    ctx.fillStyle = COLORS.faint
    ctx.font = `600 32px ${FONT}`
    ctx.textAlign = 'right'
    ctx.fillText(lift.detail, CARD_WIDTH - PAD, y)
    ctx.textAlign = 'left'
    y += LIFT_ROW
  }
  if (truncated) {
    ctx.fillStyle = COLORS.faint
    ctx.font = `600 32px ${FONT}`
    ctx.fillText(`+${data.lifts.length - visibleLifts.length} more`, PAD, y)
    y += LIFT_ROW
  }

  // Records
  if (data.records.length > 0) {
    y += 20
    const blockHeight = 90 + data.records.length * 50
    ctx.fillStyle = COLORS.ink
    ctx.fillRect(PAD, y, INNER, blockHeight)
    ctx.fillStyle = COLORS.onInk
    ctx.font = `700 28px ${FONT}`
    ctx.fillText(data.records.length === 1 ? 'NEW PERSONAL BEST' : 'NEW PERSONAL BESTS', PAD + 32, y + 52)
    ctx.font = `600 32px ${FONT}`
    data.records.forEach((line, i) => {
      const fitted = wrapText(measure, line, INNER - 64, 1)[0] ?? ''
      ctx.fillText(fitted, PAD + 32, y + 100 + i * 50)
    })
  }

  // Footer
  ctx.fillStyle = COLORS.faint
  ctx.font = `600 30px ${FONT}`
  if (data.streakLine) ctx.fillText(data.streakLine, PAD, CARD_HEIGHT - PAD - 44)
  ctx.font = `500 26px ${FONT}`
  ctx.fillText('Tracked on this device with StepUp', PAD, CARD_HEIGHT - PAD)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))), 'image/png')
  })
}
