import { useRegisterSW } from 'virtual:pwa-register/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getInProgressSession } from '../lib/workout'
import { Button } from './ui'

/**
 * A new version is downloaded in the background but only applied when the user says so —
 * and never while a workout is in progress, because a reload there would break their flow.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const workoutOpen = useLiveQuery(async () => Boolean(await getInProgressSession()), [])

  if (!needRefresh || workoutOpen) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-24 md:bottom-6 z-40 mx-auto max-w-sm px-4"
    >
      <div className="rounded-lg border border-line bg-elevated shadow-soft-sm p-4">
        <p className="font-semibold text-sm mb-1">An update is ready.</p>
        <p className="text-xs text-faint mb-3">It takes a second. Your data stays exactly as it is.</p>
        <div className="flex gap-3">
          <Button className="flex-1 min-h-11" onClick={() => updateServiceWorker(true)}>
            Update now
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
        </div>
      </div>
    </div>
  )
}
