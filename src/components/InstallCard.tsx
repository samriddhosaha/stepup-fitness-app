import { useEffect, useState } from 'react'
import { Button, Card } from './ui'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/**
 * Installing matters here: an installed app keeps its local data safer and, on iPhone,
 * is what makes notifications possible. Android gets a button; iOS gets the two taps.
 */
export function InstallCard() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandalone())

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null
  if (!event && !isIOS()) return null

  return (
    <Card className="md:col-span-2">
      <p className="label-eyebrow text-faint mb-2">Install StepUp</p>
      {event ? (
        <>
          <p className="text-sm text-faint mb-3">Add StepUp to your home screen. It opens like an app, works offline, and your data is better protected.</p>
          <Button
            variant="secondary"
            onClick={async () => {
              await event.prompt()
              await event.userChoice
              setEvent(null)
            }}
          >
            Install
          </Button>
        </>
      ) : (
        <p className="text-sm text-faint">
          On iPhone or iPad: tap the Share button in Safari, then “Add to Home Screen”. Installed, StepUp opens like an app, works offline and can send reminders.
        </p>
      )}
    </Card>
  )
}
