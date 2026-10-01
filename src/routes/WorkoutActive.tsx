import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { getExerciseById, getSubstitutes } from '../db/exerciseLibrary'
import {
  discardSession,
  finishSession,
  getInProgressSession,
  logSet,
  recordSkip,
  setCurrentIndex,
  setRestEndsAt,
  swapExercise,
} from '../lib/workout'
import { suggestNextLoad, warmupSets } from '../lib/overload'
import { estimateStartingLoadKg } from '../lib/plan'
import { track } from '../lib/analytics'
import { REPS_RANGE, rangeErrorMessage } from '../lib/validation'
import { formatWeight, parseWeight, workoutLoadRangeForUnit } from '../lib/units'
import { useUnit } from '../lib/useUnit'
import { useWakeLock } from '../lib/useWakeLock'
import { Button, Card } from '../components/ui'
import { RestTimer } from '../components/RestTimer'
import type { PlanExercise, Profile, SkipReason, WorkoutSession } from '../db/types'

const SKIP_REASONS: { value: SkipReason; label: string }[] = [
  { value: 'too-difficult', label: 'Too difficult today' },
  { value: 'equipment-not-free', label: 'Equipment not free' },
  { value: 'discomfort-or-pain', label: 'Discomfort or pain' },
  { value: 'running-out-of-time', label: 'Running out of time' },
  { value: 'another-reason', label: 'Another reason' },
]

const DEFAULT_REST_SECONDS = 90

/** The planned slot for the exercise at the current position; swapped-in exercises get their own load estimate. */
function plannedFor(
  session: WorkoutSession,
  exerciseId: string,
  profile: Profile | undefined,
): PlanExercise | undefined {
  const originalId = session.swapMap?.[exerciseId] ?? exerciseId
  const original = session.plannedSnapshot?.find((p) => p.exerciseId === originalId)
  if (!original || originalId === exerciseId) return original
  return {
    ...original,
    exerciseId,
    startingLoadKg: profile ? estimateStartingLoadKg(exerciseId, profile) : undefined,
  }
}

export default function WorkoutActive() {
  const navigate = useNavigate()
  // null = no open session, undefined = still loading
  const session = useLiveQuery(async () => (await getInProgressSession()) ?? null)
  const profile = useLiveQuery(() => db.profile.orderBy('createdAt').last())
  const restSound = useLiveQuery(async () => Boolean((await db.settings.get('restSound'))?.value), [])
  const unit = useUnit()

  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState<number | null>(null)
  const [panel, setPanel] = useState<null | 'swap' | 'skip' | 'leave' | 'finish' | 'empty'>(null)
  const [suggestionMessage, setSuggestionMessage] = useState<string | undefined>()
  const [repTarget, setRepTarget] = useState<number | undefined>()
  const logging = useRef(false)
  // Set while finishing: once the session closes the live query goes null, and we must head to the summary, not the dashboard.
  const [finishingId, setFinishingId] = useState<number | null>(null)

  useWakeLock(Boolean(session))

  const order = session?.exerciseOrder
  const index = session ? Math.min(session.currentIndex ?? 0, (order?.length ?? 1) - 1) : 0
  const currentExerciseId = order?.[index]
  const currentExercise = currentExerciseId ? getExerciseById(currentExerciseId) : undefined
  const plannedExercise =
    session && currentExerciseId ? plannedFor(session, currentExerciseId, profile ?? undefined) : undefined
  const sessionId = session?.id

  // Prefill from what the lifter actually did last time (exerciseState), not the plan.
  useEffect(() => {
    setWeight('')
    setReps('')
    setRpe(null)
    setSuggestionMessage(undefined)
    setRepTarget(undefined)
    if (!currentExerciseId || !plannedExercise) return
    let cancelled = false
    db.exerciseState.get(currentExerciseId).then((state) => {
      if (cancelled) return
      const s = suggestNextLoad(plannedExercise, [], state, { unit })
      if (state) setSuggestionMessage(s.message)
      if (s.suggestedWeightKg) setWeight(formatWeight(s.suggestedWeightKg, unit, false))
      else if (plannedExercise.startingLoadKg) setWeight(formatWeight(plannedExercise.startingLoadKg, unit, false))
      setRepTarget(s.suggestedReps)
    })
    return () => {
      cancelled = true
    }
    // Re-prefill only when the exercise (or unit) changes, not on every live-query emission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExerciseId, sessionId, unit])

  if (session === undefined) return <p className="text-sm text-faint py-10">Loading your workout…</p>
  if (session === null) {
    return finishingId !== null ? (
      <Navigate to="/workout/complete" state={{ sessionId: finishingId }} replace />
    ) : (
      <Navigate to="/dashboard" replace />
    )
  }

  const activeSession = session
  const sid = activeSession.id!

  if (!order || !currentExerciseId || !currentExercise) {
    return (
      <div className="flex-1 py-10">
        <p className="font-display font-semibold text-2xl mb-2">This workout can’t be resumed.</p>
        <p className="text-faint mb-6">
          It was started in an older version of StepUp. Nothing else is lost; you can start fresh.
        </p>
        <Button
          onClick={async () => {
            await discardSession(sid)
            navigate('/dashboard')
          }}
        >
          Back to dashboard
        </Button>
      </div>
    )
  }

  const loggedForCurrent = activeSession.exercises.find((e) => e.exerciseId === currentExerciseId)
  const setsLogged = loggedForCurrent?.sets.length ?? 0
  const totalLogged = activeSession.exercises.reduce((n, e) => n + e.sets.length, 0)
  const targetSets = plannedExercise?.targetSets ?? 3
  const isLastExercise = index === order.length - 1
  const allSetsDone = setsLogged >= targetSets

  const loadRange = workoutLoadRangeForUnit(unit)
  const weightError = rangeErrorMessage(weight, loadRange, unit)
  const repsError = rangeErrorMessage(reps, REPS_RANGE, 'reps')
  const repsMissing = reps.trim() === ''
  const canLog = !weightError && !repsError && !repsMissing

  async function handleLogSet() {
    if (!canLog || logging.current) return
    logging.current = true
    try {
      const result = await logSet(
        sid,
        currentExerciseId!,
        {
          setIndex: setsLogged,
          weightKg: parseWeight(weight, unit) ?? undefined,
          reps: Number(reps),
          rpe: rpe ?? undefined,
        },
        activeSession.swapMap?.[currentExerciseId!],
      )
      if (result.ok) {
        await setRestEndsAt(sid, Date.now() + DEFAULT_REST_SECONDS * 1000)
        setReps('')
        setRpe(null)
      }
    } finally {
      logging.current = false
    }
  }

  async function goToExercise(next: number) {
    await setRestEndsAt(sid, undefined)
    await setCurrentIndex(sid, next)
  }

  async function handleFinish(early: boolean) {
    setFinishingId(sid)
    const result = await finishSession(sid, early)
    if (result.status === 'empty') {
      setFinishingId(null)
      setPanel('empty')
      return
    }
    if (result.status === 'completed') await track('workout_completed', { sessionId: sid, early })
    navigate('/workout/complete', { state: { sessionId: sid } })
  }

  async function goNextExercise() {
    if (isLastExercise) await handleFinish(false)
    else await goToExercise(index + 1)
  }

  async function handleSwap(newId: string) {
    await swapExercise(sid, index, newId)
    setPanel(null)
  }

  async function handleSkip(reason: SkipReason) {
    await recordSkip(sid, { exerciseId: currentExerciseId!, reason })
    await track('exercise_skipped', { exerciseId: currentExerciseId, reason })
    setPanel(null)
    if (isLastExercise) await handleFinish(false)
    else await goToExercise(index + 1)
  }

  async function handleDiscard() {
    await track('workout_abandoned', { sessionId: sid })
    await discardSession(sid)
    navigate('/dashboard')
  }

  const substitutes = profile ? getSubstitutes(currentExercise, profile.equipment) : []
  const workingKg = parseWeight(weight, unit) ?? undefined
  const warmups = setsLogged === 0 ? warmupSets(currentExercise.warmupRamp, workingKg, unit) : []
  const resting = activeSession.restEndsAt !== undefined
  const showForm = panel === null

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <button className="text-sm font-semibold text-faint min-h-12 px-2" onClick={() => setPanel('leave')}>
          Leave
        </button>
        <p className="label-eyebrow text-faint">
          Exercise {index + 1} / {order.length}
        </p>
        <button
          className="text-sm font-semibold text-accent min-h-12 px-2"
          onClick={() => setPanel(totalLogged === 0 ? 'empty' : 'finish')}
        >
          Finish early
        </button>
      </div>

      <h1 className="font-display font-semibold text-2xl md:text-3xl mb-1">{currentExercise.name}</h1>
      <p className="text-sm text-faint mb-4">
        {setsLogged} of {targetSets} sets · target {plannedExercise?.targetRepsLow}-
        {plannedExercise?.targetRepsHigh} reps
      </p>

      {warmups.length > 0 && (
        <Card className="mb-4 bg-accent-soft">
          <p className="label-eyebrow mb-2">Warm-up first</p>
          <ul className="text-sm text-faint space-y-1">
            {warmups.map((w) => (
              <li key={`${w.weightKg}-${w.reps}`}>
                {formatWeight(w.weightKg, unit)} × {w.reps} reps
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ul className="text-xs text-faint space-y-1 mb-4">
        {currentExercise.formCues.map((cue) => (
          <li key={cue}>{cue}</li>
        ))}
      </ul>

      {suggestionMessage && setsLogged === 0 && <p className="text-sm text-accent mb-4">{suggestionMessage}</p>}
      {repTarget && setsLogged === 0 && <p className="text-sm text-accent mb-4">Aim for {repTarget} reps.</p>}

      <div className="flex gap-3 mb-4">
        <Button variant="ghost" className="flex-1" onClick={() => setPanel('swap')}>
          Replace exercise
        </Button>
        <Button variant="ghost" className="flex-1" onClick={() => setPanel('skip')}>
          Skip
        </Button>
      </div>

      {panel === 'swap' && (
        <Card className="mb-4">
          <p className="font-semibold mb-3">Same movement, same muscles, kit you actually have</p>
          {substitutes.length === 0 ? (
            <p className="text-sm text-faint">There's no close swap available with your equipment.</p>
          ) : (
            <div className="space-y-2">
              {substitutes.map((sub) => (
                <button
                  key={sub.id}
                  className="w-full text-left font-semibold rounded-lg border border-line px-4 py-3 min-h-12 hover:bg-surface"
                  onClick={() => handleSwap(sub.id)}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}
          <Button variant="ghost" className="w-full mt-3" onClick={() => setPanel(null)}>
            Cancel
          </Button>
        </Card>
      )}

      {panel === 'skip' && (
        <Card className="mb-4">
          <p className="font-semibold mb-3">Why skip this one?</p>
          <div className="space-y-2">
            {SKIP_REASONS.map((r) => (
              <button
                key={r.value}
                className="w-full text-left font-semibold rounded-lg border border-line px-4 py-3 min-h-12 hover:bg-surface"
                onClick={() => handleSkip(r.value)}
              >
                {r.label}
              </button>
            ))}
            <button className="w-full text-left text-faint px-4 py-3 min-h-12" onClick={() => handleSkip('unspecified')}>
              Skip without saying
            </button>
            <Button variant="ghost" className="w-full" onClick={() => setPanel(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {panel === 'leave' && (
        <Card className="mb-4">
          <p className="font-semibold mb-2">Leave this workout?</p>
          <p className="text-sm text-faint mb-3">
            Save &amp; exit keeps everything logged so far. You can pick it up again from the dashboard.
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => navigate('/dashboard')}>Save &amp; exit</Button>
            <Button variant="danger" onClick={handleDiscard}>
              Discard workout
            </Button>
            <Button variant="ghost" onClick={() => setPanel(null)}>
              Stay
            </Button>
          </div>
        </Card>
      )}

      {panel === 'finish' && (
        <Card className="mb-4">
          <p className="font-semibold mb-2">Finish now?</p>
          <p className="text-sm text-faint mb-3">
            {totalLogged} set{totalLogged === 1 ? '' : 's'} logged. Finishing early still counts.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setPanel(null)}>
              Keep going
            </Button>
            <Button className="flex-1" onClick={() => handleFinish(true)}>
              Finish workout
            </Button>
          </div>
        </Card>
      )}

      {panel === 'empty' && (
        <Card className="mb-4">
          <p className="font-semibold mb-2">Nothing logged yet</p>
          <p className="text-sm text-faint mb-3">A workout needs at least one set. Keep going, or discard this one.</p>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setPanel(null)}>
              Keep going
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleDiscard}>
              Discard workout
            </Button>
          </div>
        </Card>
      )}

      {showForm && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-2">
            <label className="block">
              <span className="label-eyebrow block text-faint mb-1.5">Weight ({unit})</span>
              <input
                type="number"
                inputMode="decimal"
                min={loadRange.min}
                max={loadRange.max}
                aria-invalid={Boolean(weightError)}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={`w-full rounded-lg border bg-elevated px-3 py-3 min-h-12 text-center text-lg font-semibold focus:outline-2 ${
                  weightError ? 'border-danger focus:outline-danger' : 'border-line focus:outline-accent'
                }`}
              />
              {weightError && <span className="block text-xs font-semibold text-danger mt-1">{weightError}</span>}
            </label>
            <label className="block">
              <span className="label-eyebrow block text-faint mb-1.5">Reps</span>
              <input
                type="number"
                inputMode="numeric"
                min={REPS_RANGE.min}
                max={REPS_RANGE.max}
                aria-invalid={Boolean(repsError)}
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className={`w-full rounded-lg border bg-elevated px-3 py-3 min-h-12 text-center text-lg font-semibold focus:outline-2 ${
                  repsError ? 'border-danger focus:outline-danger' : 'border-line focus:outline-accent'
                }`}
              />
              {repsError && <span className="block text-xs font-semibold text-danger mt-1">{repsError}</span>}
            </label>
            <div>
              <span className="label-eyebrow block text-faint mb-1.5">RPE</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    aria-label={`RPE ${n}`}
                    aria-pressed={rpe === n}
                    onClick={() => setRpe(n)}
                    className={`flex-1 min-w-0 min-h-12 rounded-lg text-sm font-semibold border border-line ${
                      rpe === n ? 'bg-accent text-on-accent' : 'bg-elevated'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {repsMissing && !allSetsDone && <p className="text-xs text-faint mb-2">Enter your reps to log this set.</p>}

          <Button className="w-full mb-4" onClick={handleLogSet} disabled={!canLog}>
            Complete set
          </Button>

          {resting && (
            <RestTimer
              endsAt={activeSession.restEndsAt!}
              sound={Boolean(restSound)}
              onAdjust={(d) => setRestEndsAt(sid, Math.max(Date.now(), activeSession.restEndsAt! + d * 1000))}
              onFinished={() => setRestEndsAt(sid, undefined)}
              onSkip={() => setRestEndsAt(sid, undefined)}
            />
          )}

          {allSetsDone && (
            <Button variant="secondary" className="w-full" onClick={goNextExercise}>
              {isLastExercise ? 'Finish workout' : 'Next exercise'}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
