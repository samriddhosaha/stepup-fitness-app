import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import type { PersonalRecord, WeightUnit } from '../db/types'
import { getExerciseById } from '../db/exerciseLibrary'
import { formatDuration } from '../lib/format'
import { formatWeight } from '../lib/units'
import { useUnit } from '../lib/useUnit'
import { notificationsSupported, requestNotificationPermission } from '../lib/notifications'
import { requestPersistentStorage } from '../lib/storage'
import { Button, Card, PageSkeleton } from '../components/ui'

function prLabel(pr: PersonalRecord, unit: WeightUnit): string {
  if (pr.kind === 'reps') return `${pr.value} reps`
  if (pr.kind === 'time') return `${pr.value} s hold`
  if (pr.kind === 'weight') return `${formatWeight(pr.value, unit)} lifted`
  return `${formatWeight(pr.value, unit)} est.`
}

export default function WorkoutComplete() {
  const navigate = useNavigate()
  const location = useLocation()
  const sessionId = (location.state as { sessionId?: number } | null)?.sessionId

  const session = useLiveQuery(
    () => (sessionId ? db.workoutSessions.get(sessionId) : undefined),
    [sessionId],
  )
  const prs = useLiveQuery(
    (): Promise<PersonalRecord[]> =>
      sessionId
        ? db.personalRecords
            .where('sessionId')
            .equals(sessionId)
            .filter((r) => !r.baseline)
            .toArray()
        : Promise.resolve([]),
    [sessionId],
  )
  const completedCount = useLiveQuery(() =>
    db.workoutSessions.filter((s) => Boolean(s.completedAt)).count(),
  )
  const [notifDismissed, setNotifDismissed] = useState(false)
  const unit = useUnit()

  // After the very first finished workout there is something worth protecting from browser clean-up.
  useEffect(() => {
    if (completedCount === 1) void requestPersistentStorage()
  }, [completedCount])

  if (sessionId === undefined) return <Navigate to="/dashboard" replace />

  if (!session) return <PageSkeleton />

  const totalSets = session.exercises.reduce((sum, e) => sum + e.sets.length, 0)
  const showNotificationAsk =
    !notifDismissed &&
    completedCount === 1 &&
    notificationsSupported() &&
    Notification.permission === 'default'

  return (
    <div className="flex-1 flex flex-col justify-between py-10">
      <div>
        <h1 className="font-display font-semibold text-3xl md:text-4xl mb-2">Workout complete.</h1>
        <p className="text-faint">
          {session.finishedEarly ? 'Finished early — still counts.' : 'You showed up. That’s the whole job.'}
        </p>
      </div>

      <div className="space-y-3 my-6">
        <Card>
          <div className="flex justify-between text-sm">
            <span className="label-eyebrow text-faint">Duration</span>
            <span className="font-semibold">{formatDuration(session.durationSeconds ?? 0)}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="label-eyebrow text-faint">Sets logged</span>
            <span className="font-semibold">{totalSets}</span>
          </div>
        </Card>

        {prs && prs.length > 0 && (
          <Card className="bg-accent-soft">
            <p className="label-eyebrow text-faint mb-2">New personal best</p>
            {prs.map((pr) => (
              <p key={pr.id} className="text-sm font-semibold">
                {getExerciseById(pr.exerciseId)?.name} — {prLabel(pr, unit)}
              </p>
            ))}
          </Card>
        )}

        {showNotificationAsk && (
          <Card>
            <p className="text-sm font-semibold mb-1">Get reminded, gently</p>
            <p className="text-xs text-faint mb-3">
              A quiet nudge if a scheduled day passes without a workout.
              Nothing else.
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setNotifDismissed(true)}>
                Not now
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={async () => {
                  await requestNotificationPermission()
                  setNotifDismissed(true)
                }}
              >
                Turn on
              </Button>
            </div>
          </Card>
        )}
      </div>

      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <Button
          variant="ghost"
          className="w-full mb-3"
          onClick={() =>
            void navigator
              .share({ title: 'StepUp', text: `${session.planSessionName}: ${totalSets} sets${session.durationSeconds ? `, ${Math.max(1, Math.round(session.durationSeconds / 60))} min` : ''}.` })
              .catch(() => undefined)
          }
        >
          Share
        </Button>
      )}
      <Button className="w-full" onClick={() => navigate('/dashboard')}>
        Back to dashboard
      </Button>
    </div>
  )
}
