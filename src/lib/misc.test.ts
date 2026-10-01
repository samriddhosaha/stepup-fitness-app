import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { db, getInstallToken, getSetting, setSetting, wipeAllData } from '../db/schema'
import { bodyWeightSeries, liftProgressionSeries } from './progress'
import { isStoragePersisted, requestPersistentStorage, shouldNudgeBackup, workoutsSinceBackup } from './storage'
import { daysAgoISO, formatDuration, greetingForNow, kgToDisplay, displayToKg, startOfWeekISO, todayISODate, unitLabel } from './format'
import { runReminderChecks } from './notifications'
import { track } from './analytics'
import { ThemeProvider } from './theme'
import { useTheme } from './useTheme'
import { useWakeLock } from './useWakeLock'
import { requestAIWeeklyReview } from './aiCoach'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  localStorage.clear()
})

describe('progress series', () => {
  beforeEach(async () => {
    await db.progressSnapshots.clear()
    await db.workoutSessions.clear()
  })

  it('returns body weight in date order', async () => {
    await db.progressSnapshots.bulkAdd([
      { date: '2026-02-02', bodyWeightKg: 79 },
      { date: '2026-01-01', bodyWeightKg: 80 },
    ])
    expect(await bodyWeightSeries()).toEqual([
      { date: '2026-01-01', value: 80 },
      { date: '2026-02-02', value: 79 },
    ])
  })

  it('charts the best estimated 1RM per session and ignores 13+ rep sets and unloaded sets', async () => {
    const mk = (date: string, sets: { weightKg?: number; reps?: number }[]) => ({
      date,
      planSessionName: 'A',
      exercises: [{ exerciseId: 'back-squat', sets: sets.map((s, i) => ({ setIndex: i, ...s })) }],
      skips: [],
      startedAt: 1,
      completedAt: 2,
    })
    await db.workoutSessions.bulkAdd([
      mk('2026-01-08', [{ weightKg: 60, reps: 5 }, { weightKg: 40, reps: 20 }]),
      mk('2026-01-01', [{ weightKg: 50, reps: 10 }, { reps: 12 }]),
      mk('2026-01-15', [{ weightKg: 40, reps: 20 }]), // only a high-rep set: no estimate, no point
    ])
    expect(await liftProgressionSeries('back-squat')).toEqual([
      { date: '2026-01-01', value: 66.7 },
      { date: '2026-01-08', value: 70 },
    ])
    expect(await liftProgressionSeries('deadlift')).toEqual([])
  })
})

describe('storage helpers', () => {
  beforeEach(async () => {
    await db.settings.clear()
    await db.workoutSessions.clear()
  })

  it('requests persistent storage and records the answer', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist: async () => true } })
    expect(await requestPersistentStorage()).toBe(true)
    expect(await getSetting('storagePersisted')).toBe(true)
    expect(await isStoragePersisted()).toBe(false)
  })

  it('degrades quietly when the API is missing or throws', async () => {
    vi.stubGlobal('navigator', {})
    expect(await requestPersistentStorage()).toBe(false)
    expect(await isStoragePersisted()).toBeUndefined()
    vi.stubGlobal('navigator', { storage: { persist: async () => { throw new Error('x') }, persisted: async () => { throw new Error('x') } } })
    expect(await requestPersistentStorage()).toBe(false)
    expect(await isStoragePersisted()).toBeUndefined()
  })

  it('counts workouts since the last backup and nudges at 10', async () => {
    const mk = (completedAt: number) => ({ date: '2026-01-01', planSessionName: 'A', exercises: [], skips: [], startedAt: 1, completedAt })
    await db.workoutSessions.bulkAdd(Array.from({ length: 12 }, (_, i) => mk(100 + i)))
    expect(await workoutsSinceBackup()).toEqual({ count: 12, lastBackupAt: undefined })
    await setSetting('lastBackupAt', 105)
    const { count } = await workoutsSinceBackup()
    expect(count).toBe(6)
    expect(shouldNudgeBackup(9)).toBe(false)
    expect(shouldNudgeBackup(10)).toBe(true)
  })

  it('creates one install token and reuses it', async () => {
    const a = await getInstallToken()
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
    expect(await getInstallToken()).toBe(a)
  })
})

describe('format helpers', () => {
  it('formats durations and unit labels', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(0)).toBe('0:00')
    expect(unitLabel('lb')).toBe('lb')
    expect(unitLabel('kg')).toBe('kg')
  })

  it('converts between display units', () => {
    expect(kgToDisplay(45.36, 'lb')).toBe(100)
    expect(kgToDisplay(45.36, 'kg')).toBe(45.4)
    expect(displayToKg(100, 'lb')).toBe(45.36)
  })

  it('computes relative dates in local time', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 1, 12)) // Thu 1 Oct 2026
    expect(todayISODate()).toBe('2026-10-01')
    expect(daysAgoISO(1)).toBe('2026-09-30')
    expect(daysAgoISO(7)).toBe('2026-09-24')
    expect(startOfWeekISO()).toBe('2026-09-28')
  })

  it('greets by time of day', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    for (const [hour, word] of [[8, 'morning'], [13, 'afternoon'], [20, 'evening']] as const) {
      vi.setSystemTime(new Date(2026, 9, 1, hour))
      expect(greetingForNow()).toContain(word)
    }
  })
})

describe('reminders with permission granted', () => {
  it('sends one calm reminder per day, only in the evening', async () => {
    const shown: string[] = []
    class FakeNotification {
      static permission = 'granted'
      constructor(title: string) {
        shown.push(title)
      }
    }
    vi.stubGlobal('Notification', FakeNotification)
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: async () => undefined } })
    Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true })
    vi.useFakeTimers({ toFake: ['Date'] })

    vi.setSystemTime(new Date(2026, 9, 1, 10))
    await runReminderChecks({ todayScheduledAndIncomplete: true, yesterdayScheduledAndMissed: false })
    expect(shown).toEqual([]) // too early in the day

    vi.setSystemTime(new Date(2026, 9, 1, 19))
    await runReminderChecks({ todayScheduledAndIncomplete: true, yesterdayScheduledAndMissed: true })
    await runReminderChecks({ todayScheduledAndIncomplete: true, yesterdayScheduledAndMissed: true })
    expect(shown).toHaveLength(2) // one "yesterday", one "today" — and nothing repeated
    expect(shown.join(' ')).not.toMatch(/streak|!/i)
  })
})

describe('analytics + AI request', () => {
  it('track() stores a local event', async () => {
    await db.appEvents.clear()
    await track('workout_started', { session: 'A' })
    const [e] = await db.appEvents.toArray()
    expect(e).toMatchObject({ name: 'workout_started', propsJson: '{"session":"A"}' })
  })

  it('requestAIWeeklyReview sends the install token and rejects empty or failed replies', async () => {
    const payload = { sessionsCompleted: 0, sessionsPlanned: 0, exercises: [], skips: [], prs: [], activeWeeksInARow: 0, bodyWeightTrendKg: null }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ review: 'Quiet week.' }) })
    vi.stubGlobal('fetch', fetchMock)
    expect(await requestAIWeeklyReview(payload)).toBe('Quiet week.')
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>)['x-stepup-install']).toMatch(/^[0-9a-f-]{36}$/)

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ review: '  ' }) })
    await expect(requestAIWeeklyReview(payload)).rejects.toThrow()
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) })
    await expect(requestAIWeeklyReview(payload)).rejects.toThrow(/429/)
  })
})

describe('theme', () => {
  it('applies and caches the chosen appearance', () => {
    function Probe() {
      const { appearance, setAppearance } = useTheme()
      return createElement('button', { onClick: () => setAppearance('dark') }, `mode:${appearance}`)
    }
    render(createElement(ThemeProvider, null, createElement(Probe)))
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    act(() => screen.getByText('mode:system').click())
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('stepup-appearance')).toBe('dark')
  })

  it('reads a cached preference on load and throws outside the provider', () => {
    localStorage.setItem('stepup-appearance', 'light')
    function Probe() {
      return createElement('span', null, useTheme().appearance)
    }
    render(createElement(ThemeProvider, null, createElement(Probe)))
    expect(screen.getByText('light')).toBeInTheDocument()
    expect(() => renderHook(() => useTheme())).toThrow()
  })
})

describe('useWakeLock', () => {
  it('acquires a screen wake lock while active and releases it afterwards', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({ release })
    vi.stubGlobal('navigator', { wakeLock: { request } })
    const { rerender, unmount } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } })
    await act(async () => {})
    expect(request).toHaveBeenCalledWith('screen')
    rerender({ on: false })
    await act(async () => {})
    expect(release).toHaveBeenCalled()
    unmount()
  })

  it('does nothing where the API is unavailable', () => {
    vi.stubGlobal('navigator', {})
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow()
  })
})

describe('wipeAllData', () => {
  it('deletes the database and every stepup-* key, then reopens empty', async () => {
    await db.profile.add({
      name: 'X',
      fitnessLevel: 'new',
      liftsAlready: false,
      doesCardioAlready: false,
      primaryGoal: 'feel-better',
      daysPerWeek: 3,
      sessionLengthMinutes: 30,
      equipment: [],
      trainingPreferences: [],
      weightUnit: 'kg',
      appearance: 'system',
      onboardingCompleted: true,
      createdAt: 1,
    })
    await setSetting('lastBackupAt', 1)
    localStorage.setItem('stepup-appearance', 'dark')
    localStorage.setItem('other-app', 'keep')
    await wipeAllData()
    expect(await db.profile.count()).toBe(0)
    expect(await db.settings.count()).toBe(0)
    expect(localStorage.getItem('stepup-appearance')).toBeNull()
    expect(localStorage.getItem('other-app')).toBe('keep')
    expect(db.isOpen()).toBe(true)
  })
})

describe('analytics pruning', () => {
  it('keeps only the most recent 500 events', async () => {
    await db.appEvents.clear()
    await db.appEvents.bulkAdd(Array.from({ length: 505 }, (_, i) => ({ name: 'workout_started', occurredAt: i })))
    await track('workout_completed')
    expect(await db.appEvents.count()).toBe(500)
    const oldest = await db.appEvents.orderBy('occurredAt').first()
    expect(oldest?.occurredAt).toBe(6) // the first six were dropped
  })
})
