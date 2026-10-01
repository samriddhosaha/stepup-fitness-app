import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/schema'
import { generatePlan } from './plan'
import { planToIcs } from './ics'
import { clearErrorLog, errorLogToText, readErrorLog, recordError, setErrorLogEnabled } from './errorLog'
import { deliverFile } from './files'
import { exportAllData } from './backup'
import { getSetting } from '../db/schema'
import type { Profile } from '../db/types'

const profile: Profile = {
  name: 'T',
  fitnessLevel: 'regular',
  liftsAlready: true,
  doesCardioAlready: false,
  primaryGoal: 'build-muscle',
  daysPerWeek: 3,
  trainingDays: [0, 2, 4],
  sessionLengthMinutes: 45,
  equipment: ['dumbbells'],
  trainingPreferences: [],
  weightUnit: 'kg',
  appearance: 'system',
  onboardingCompleted: true,
  createdAt: 1,
}

describe('calendar export (.ics)', () => {
  const thursday = new Date(2026, 9, 1, 9, 0, 0) // Thu 1 Oct 2026
  const ics = planToIcs(generatePlan(profile), { now: thursday })

  it('is a valid-looking calendar with one weekly event per training day and a reminder', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3)
    expect(ics.match(/RRULE:FREQ=WEEKLY;BYDAY=(MO|WE|FR)/g)).toHaveLength(3)
    expect(ics.match(/TRIGGER:-PT15M/g)).toHaveLength(3)
    expect(ics).toMatch(/SUMMARY:StepUp: Full Body A/)
    expect(ics).not.toContain('!')
  })

  it('starts each event on the next matching weekday, at 6 pm local by default', () => {
    // plan days Mon/Wed/Fri; from Thursday 1 Oct the next ones are Fri 2 Oct, Mon 5 Oct, Wed 7 Oct
    const starts = [...ics.matchAll(/DTSTART:(\d{8}T\d{6})/g)].map((m) => m[1])
    expect(starts).toEqual(['20261005T180000', '20261007T180000', '20261002T180000'])
  })

  it('uses CRLF line endings and never exceeds 75 characters a line', () => {
    expect(ics).not.toMatch(/[^\r]\n/)
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75)
  })

  it('escapes special characters in names', () => {
    const plan = generatePlan(profile)
    plan.sessions[0]!.name = 'Legs, core; "heavy"'
    expect(planToIcs(plan, { now: thursday })).toContain('SUMMARY:StepUp: Legs\\, core\\; "heavy"')
  })
})

describe('error log (opt-in, on device)', () => {
  beforeEach(async () => {
    await db.settings.clear()
  })

  it('records nothing until switched on', async () => {
    await recordError(new Error('quiet'))
    expect(await readErrorLog()).toEqual([])
    await setErrorLogEnabled(true)
    await recordError(new Error('loud'), 5)
    expect(await readErrorLog()).toMatchObject([{ at: 5, message: 'loud' }])
  })

  it('keeps the most recent 50, accepts non-Error values and can be cleared', async () => {
    await setErrorLogEnabled(true)
    for (let i = 0; i < 60; i += 1) await recordError(`problem ${i}`, i)
    const log = await readErrorLog()
    expect(log).toHaveLength(50)
    expect(log[0]?.message).toBe('problem 10')
    await clearErrorLog()
    expect(await readErrorLog()).toEqual([])
    expect(errorLogToText([])).toBe('No errors recorded.')
    expect(errorLogToText([{ at: 0, message: 'x', stack: 'at y' }])).toContain('1970-01-01T00:00:00.000Z  x\nat y')
  })
})

describe('deliverFile / exportAllData', () => {
  const blob = new Blob(['hello'], { type: 'text/plain' })
  afterEach(() => vi.unstubAllGlobals())

  it('downloads through a temporary anchor when sharing is unavailable', async () => {
    const click = vi.fn()
    const create = vi.spyOn(document, 'createElement')
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() })
    create.mockImplementation(((tag: string) => {
      const el = document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLAnchorElement
      if (tag === 'a') el.click = click
      return el
    }) as typeof document.createElement)
    expect(await deliverFile(blob, 'a.txt', true)).toBe('downloaded')
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download]')).toBeNull() // cleaned up afterwards
    create.mockRestore()
  })

  it('uses the share sheet when files can be shared, and falls back if sharing fails for another reason', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { canShare: () => true, share })
    expect(await deliverFile(blob, 'a.txt', true)).toBe('shared')
    expect(share).toHaveBeenCalledOnce()
    // preferShare=false never shares
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() })
    expect(await deliverFile(blob, 'a.txt', false)).toBe('downloaded')
  })

  it('lets a cancelled share sheet propagate so callers can stay quiet', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')) })
    await expect(deliverFile(blob, 'a.txt', true)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('exportAllData records when the backup was made', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn().mockResolvedValue(undefined) })
    expect(await exportAllData()).toBe('shared')
    expect(await getSetting<number>('lastBackupAt')).toBeGreaterThan(0)
  })
})
