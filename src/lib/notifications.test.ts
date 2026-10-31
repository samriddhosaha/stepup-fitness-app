import { afterEach, describe, expect, it, vi } from 'vitest'
import { notificationsSupported, runReminderChecks } from './notifications'

afterEach(() => vi.unstubAllGlobals())

describe('without the Notification API (e.g. iOS Safari tab)', () => {
  it('reports unsupported and runReminderChecks does not throw', async () => {
    // jsdom has no Notification; make sure `'Notification' in window` is false
    delete (window as unknown as Record<string, unknown>).Notification
    expect(notificationsSupported()).toBe(false)
    await expect(
      runReminderChecks({ todayScheduledAndIncomplete: true, yesterdayScheduledAndMissed: true }),
    ).resolves.toBeUndefined()
  })
})

describe('water reminders', () => {
  const shown: string[] = []
  class FakeNotification {
    static permission = 'granted'
    constructor(title: string) {
      shown.push(title)
    }
  }
  const water = (over: Partial<NonNullable<Parameters<typeof runReminderChecks>[0]['water']>> = {}) => ({
    intervalHours: 2,
    intakeMl: 500,
    goalMl: 2400,
    onReminded: vi.fn(),
    ...over,
  })
  const base = { todayScheduledAndIncomplete: false, yesterdayScheduledAndMissed: false }

  afterEach(() => {
    shown.length = 0
    vi.useRealTimers()
  })

  function atHour(hour: number) {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 1, hour, 0, 0))
    vi.stubGlobal('Notification', FakeNotification)
  }

  it('nudges in the daytime and records that it did', async () => {
    atHour(14)
    const w = water()
    await runReminderChecks({ ...base, water: w })
    expect(shown).toEqual(['A glass of water?'])
    expect(w.onReminded).toHaveBeenCalledOnce()
  })

  it('stays quiet at night, once the goal is met, or without opt-in', async () => {
    atHour(23)
    await runReminderChecks({ ...base, water: water() })
    atHour(14)
    await runReminderChecks({ ...base, water: water({ intakeMl: 2400 }) })
    await runReminderChecks(base)
    expect(shown).toEqual([])
  })

  it('stays quiet when a drink was logged or a nudge sent recently', async () => {
    atHour(14)
    const now = Date.now()
    await runReminderChecks({ ...base, water: water({ lastLogAt: now - 3_600_000 }) })
    await runReminderChecks({ ...base, water: water({ lastRemindedAt: now - 3_600_000 }) })
    expect(shown).toEqual([])
  })
})
