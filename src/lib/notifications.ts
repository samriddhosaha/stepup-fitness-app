export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

async function notify(title: string, body: string): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  // Prefer the service worker registration so notifications still fire from
  // an installed/backgrounded PWA, not just an open tab.
  const registration = await navigator.serviceWorker?.getRegistration()
  if (registration) {
    await registration.showNotification(title, { body, icon: '/icons/icon-192.png' })
  } else {
    new Notification(title, { body, icon: '/icons/icon-192.png' })
  }
}

function alreadyNotifiedToday(key: string): boolean {
  const last = localStorage.getItem(key)
  return last === new Date().toDateString()
}

function markNotifiedToday(key: string): void {
  localStorage.setItem(key, new Date().toDateString())
}

/**
 * Local-only reminder checks, run periodically while the app is open. There
 * is no push server — this is a purely on-device, best-effort check. Real
 * background delivery (when the app isn't open) would need the Notification
 * Triggers or Periodic Background Sync APIs, which aren't supported broadly
 * enough yet to rely on; this in-app check is the documented fallback.
 */
export async function runReminderChecks(params: {
  todayScheduledAndIncomplete: boolean
  streak: number
  yesterdayScheduledAndMissed: boolean
}): Promise<void> {
  if (Notification.permission !== 'granted') return

  const hour = new Date().getHours()

  if (params.yesterdayScheduledAndMissed && !alreadyNotifiedToday('stepup-notified-missed')) {
    markNotifiedToday('stepup-notified-missed')
    await notify(
      'Yesterday’s session is still open',
      'No pressure — logging it late still counts, or just move on to today.',
    )
  }

  if (
    params.todayScheduledAndIncomplete &&
    params.streak > 0 &&
    hour >= 18 &&
    !alreadyNotifiedToday('stepup-notified-streak')
  ) {
    markNotifiedToday('stepup-notified-streak')
    await notify(
      'Still time today',
      `Your ${params.streak}-session streak is waiting on today's workout.`,
    )
  }
}
