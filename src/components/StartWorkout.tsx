import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { discardAndStart, startSession } from '../lib/workout'
import { track } from '../lib/analytics'
import { Button, Card } from './ui'
import type { PlanSession, WorkoutSession } from '../db/types'

/**
 * Starts (or resumes) a workout. If a different or stale unfinished session exists,
 * `dialog` renders a resume / discard choice instead of silently picking one.
 */
export function useStartWorkout(): { begin: (s: PlanSession) => Promise<void>; dialog: ReactNode } {
  const navigate = useNavigate()
  const [conflict, setConflict] = useState<{ existing: WorkoutSession; wanted: PlanSession } | null>(null)

  async function begin(planSession: PlanSession) {
    const result = await startSession(planSession)
    if (result.status === 'conflict') {
      setConflict({ existing: result.existing, wanted: planSession })
      return
    }
    if (result.status === 'started') await track('workout_started', { session: planSession.name })
    navigate('/workout/active')
  }

  async function discardAndBegin() {
    if (!conflict) return
    await discardAndStart(conflict.wanted)
    await track('workout_started', { session: conflict.wanted.name })
    setConflict(null)
    navigate('/workout/active')
  }

  const dialog = conflict && (
    <Card className="mb-6">
      <p className="font-semibold mb-1">You have a workout in progress</p>
      <p className="text-sm text-faint mb-4">
        {conflict.existing.planSessionName}, started{' '}
        {new Date(conflict.existing.startedAt).toLocaleString(undefined, {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
        })}
        . Resume it, or discard it and start {conflict.wanted.name}.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button className="flex-1" onClick={() => navigate('/workout/active')}>
          Resume {conflict.existing.planSessionName}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={discardAndBegin}>
          Discard and start {conflict.wanted.name}
        </Button>
        <Button variant="ghost" onClick={() => setConflict(null)}>
          Cancel
        </Button>
      </div>
    </Card>
  )

  return { begin, dialog }
}
