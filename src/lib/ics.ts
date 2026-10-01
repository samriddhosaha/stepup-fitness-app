import type { Plan } from '../db/types'
import { estimateSessionMinutes } from './plan'

const DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
const pad = (n: number) => String(n).padStart(2, '0')
const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
const local = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

/** RFC 5545 asks for lines of at most 75 octets; fold longer ones. */
function fold(line: string): string {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) {
    out.push(rest.slice(0, 74))
    rest = ` ${rest.slice(74)}`
  }
  out.push(rest)
  return out.join('\r\n')
}

/**
 * A weekly repeating event per training day, in the person's own time (a "floating" time with no
 * zone, so it stays 6 pm wherever they are), with a reminder 15 minutes before. Works in any
 * calendar app, which makes it the most dependable reminder on every platform.
 */
export function planToIcs(plan: Plan, opts: { hour?: number; now?: Date } = {}): string {
  const now = opts.now ?? new Date()
  const hour = opts.hour ?? 18
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//StepUp//Workout plan//EN', 'CALSCALE:GREGORIAN']
  for (const session of plan.sessions) {
    // the next date (today included) that falls on the session's weekday
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0)
    start.setDate(start.getDate() + ((session.dayIndex - ((start.getDay() + 6) % 7) + 7) % 7))
    lines.push(
      'BEGIN:VEVENT',
      `UID:stepup-${plan.createdAt}-${session.dayIndex}-${session.type}@stepup.local`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${local(start)}`,
      `DURATION:PT${estimateSessionMinutes(session)}M`,
      `RRULE:FREQ=WEEKLY;BYDAY=${DAY_CODES[session.dayIndex]}`,
      `SUMMARY:${escapeText(`StepUp: ${session.name}`)}`,
      `DESCRIPTION:${escapeText(`${session.exercises.length} exercises. Nothing to prove today. Just begin.`)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Workout in 15 minutes',
      'TRIGGER:-PT15M',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
