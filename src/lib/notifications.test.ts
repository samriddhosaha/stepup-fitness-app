import { afterEach, describe, expect, it, vi } from 'vitest'
import { notificationsSupported, runReminderChecks } from './notifications'

afterEach(() => vi.unstubAllGlobals())

describe('without the Notification API (e.g. iOS Safari tab)', () => {
  it('reports unsupported and runReminderChecks does not throw', async () => {
    // jsdom has no Notification; make sure `'Notification' in window` is false
    delete (window as unknown as Record<string, unknown>).Notification
    expect(notificationsSupported()).toBe(false)
    await expect(
      runReminderChecks({ todayScheduledAndIncomplete: true, streak: 3, yesterdayScheduledAndMissed: true }),
    ).resolves.toBeUndefined()
  })
})
