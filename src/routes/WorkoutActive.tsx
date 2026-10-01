import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { getExerciseById, getSubstitutes } from '../db/exerciseLibrary'
import {
  deleteSet,
  discardSession,
  finishSession,
  getInProgressSession,
  logSet,
  mostRecentLoggedSets,
  recordSkip,
  restoreSet,
  setCurrentIndex,
  setRestEndsAt,
  swapExercise,
  updateSet,
} from '../lib/workout'
import { loadStepFor, suggestNextLoad, warmupSets } from '../lib/overload'
import { estimateStartingLoadKg } from '../lib/plan'
import { track } from '../lib/analytics'
import { REPS_RANGE, rangeErrorMessage } from '../lib/validation'
import { formatWeight, parseWeight, workoutLoadRangeForUnit } from '../lib/units'
import { useUnit } from '../lib/useUnit'
import { useWakeLock } from '../lib/useWakeLock'
import { Button, Card, PageSkeleton } from '../components/ui'
import { RestTimer } from '../components/RestTimer'
import { useToast } from '../components/toastContext'
import { SetForm } from '../features/workout/SetForm'
import { LoggedSets } from '../features/workout/LoggedSets'
import { WorkoutDialogs } from '../features/workout/WorkoutDialogs'
import { summariseSets, type SetFormValues, type WorkoutPanel } from '../features/workout/constants'
import type { LoggedSet, PlanExercise, Profile, SkipReason, WorkoutSession } from '../db/types'

const DEFAULT_REST_SECONDS = 90
const EMPTY_FORM: SetFormValues = { weight: '', reps: '', rpe: null, note: '' }

/** The planned slot for the exercise at the current position; swapped-in exercises get their own load estimate. */
function plannedFor(session: WorkoutSession, exerciseId: string, profile: Profile | undefined): PlanExercise | undefined {
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
  const toast = useToast()
  // null = no open session, undefined = still loading
  const session = useLiveQuery(async () => (await getInProgressSession()) ?? null)
  const profile = useLiveQuery(() => db.profile.orderBy('createdAt').last())
  const restSound = useLiveQuery(async () => Boolean((await db.settings.get('restSound'))?.value), [])
  const unit = useUnit()

  const [form, setForm] = useState<SetFormValues>(EMPTY_FORM)
  const [editing, setEditing] = useState<number | null>(null)
  const [panel, setPanel] = useState<WorkoutPanel>(null)
  const [suggestionMessage, setSuggestionMessage] = useState<string | undefined>()
  const [repTarget, setRepTarget] = useState<number | undefined>()
  const [lastTime, setLastTime] = useState<LoggedSet[] | undefined>()
  const [announce, setAnnounce] = useState('')
  const logging = useRef(false)
  // Set while finishing: once the session closes the live query goes null, and we must head to the summary, not the dashboard.
  const [finishingId, setFinishingId] = useState<number | null>(null)

  useWakeLock(Boolean(session))

  const order = session?.exerciseOrder
  const index = session ? Math.min(session.currentIndex ?? 0, (order?.length ?? 1) - 1) : 0
  const currentExerciseId = order?.[index]
  const currentExercise = currentExerciseId ? getExerciseById(currentExerciseId) : undefined
  const plannedExercise = session && currentExerciseId ? plannedFor(session, currentExerciseId, profile ?? undefined) : undefined
  const sessionId = session?.id
  const patch = (p: Partial<SetFormValues>) => setForm((f) => ({ ...f, ...p }))

  // Prefill from what the lifter actually did last time (exerciseState), not the plan.
  useEffect(() => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setSuggestionMessage(undefined)
    setRepTarget(undefined)
    setLastTime(undefined)
    if (!currentExerciseId || !plannedExercise) return
    let cancelled = false
    void (async () => {
      const [state, prev] = await Promise.all([
        db.exerciseState.get(currentExerciseId),
        mostRecentLoggedSets(currentExerciseId, sessionId),
      ])
      if (cancelled) return
      const s = suggestNextLoad(plannedExercise, [], state, { unit })
      if (state) setSuggestionMessage(s.message)
      const kg = s.suggestedWeightKg ?? plannedExercise.startingLoadKg
      if (kg) patch({ weight: formatWeight(kg, unit, false) })
      setRepTarget(s.suggestedReps)
      setLastTime(prev)
    })()
    return () => {
      cancelled = true
    }
    // Re-prefill only when the exercise (or unit) changes, not on every live-query emission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExerciseId, sessionId, unit])

  if (session === undefined) return <PageSkeleton label="Loading your workout" />
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
        <h1 className="font-display font-semibold text-2xl mb-2">This workout can’t be resumed.</h1>
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
  const loggedSets = loggedForCurrent?.sets ?? []
  const setsLogged = loggedSets.length
  const totalLogged = activeSession.exercises.reduce((n, e) => n + e.sets.length, 0)
  const targetSets = plannedExercise?.targetSets ?? 3
  const isLastExercise = index === order.length - 1
  const allSetsDone = setsLogged >= targetSets

  const loadRange = workoutLoadRangeForUnit(unit)
  const weightError = rangeErrorMessage(form.weight, loadRange, unit)
  const repsError = rangeErrorMessage(form.reps, REPS_RANGE, 'reps')
  const repsMissing = form.reps.trim() === ''
  const canSubmit = !weightError && !repsError && !repsMissing
  const workingKg = parseWeight(form.weight, unit) ?? undefined
  const weightStep = loadStepFor(currentExerciseId, workingKg, unit)
  const warmups = setsLogged === 0 ? warmupSets(currentExercise.warmupRamp, workingKg, unit) : []
  const substitutes = profile ? getSubstitutes(currentExercise, profile.equipment) : []
  const resting = activeSession.restEndsAt !== undefined
  const lastSet = loggedSets[loggedSets.length - 1]

  const formToSet = (setIndex: number): LoggedSet => ({
    setIndex,
    weightKg: parseWeight(form.weight, unit) ?? undefined,
    reps: Number(form.reps),
    rpe: form.rpe ?? undefined,
    note: form.note.trim() || undefined,
  })

  async function handleSubmit() {
    if (!canSubmit || logging.current) return
    logging.current = true
    try {
      if (editing !== null) {
        const { setIndex: _ignored, ...changes } = formToSet(editing)
        void _ignored
        if (await updateSet(sid, currentExerciseId!, editing, changes)) {
          setAnnounce(`Set ${editing + 1} updated`)
          setEditing(null)
          patch({ reps: '', rpe: null, note: '' })
        }
        return
      }
      const result = await logSet(sid, currentExerciseId!, formToSet(setsLogged), activeSession.swapMap?.[currentExerciseId!])
      if (result.ok) {
        setAnnounce(`Set ${setsLogged + 1} logged`)
        await setRestEndsAt(sid, Date.now() + DEFAULT_REST_SECONDS * 1000)
        patch({ reps: '', rpe: null, note: '' })
      }
    } finally {
      logging.current = false
    }
  }

  function startEdit(i: number) {
    const s = loggedSets[i]
    if (!s) return
    setEditing(i)
    setForm({
      weight: s.weightKg ? formatWeight(s.weightKg, unit, false) : '',
      reps: String(s.reps ?? ''),
      rpe: s.rpe ?? null,
      note: s.note ?? '',
    })
  }

  async function handleDelete(i: number) {
    const removed = loggedSets[i]
    if (!removed) return
    if (await deleteSet(sid, currentExerciseId!, i)) {
      setEditing(null)
      toast(`Set ${i + 1} deleted`, {
        label: 'Undo',
        onClick: () => void restoreSet(sid, currentExerciseId!, i, removed),
      })
    }
  }

  function sameAsLast() {
    if (!lastSet) return
    patch({
      weight: lastSet.weightKg ? formatWeight(lastSet.weightKg, unit, false) : '',
      reps: String(lastSet.reps ?? ''),
      rpe: lastSet.rpe ?? null,
    })
  }

  async function goToExercise(next: number) {
    await setRestEndsAt(sid, undefined)
    await setCurrentIndex(sid, next)
  }

  async function handleFinish(early: boolean) {
    setPanel(null)
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
    setFinishingId(null)
    await discardSession(sid)
    navigate('/dashboard')
  }

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
      <p className="text-sm text-faint mb-1">
        {setsLogged} of {targetSets} sets · target {plannedExercise?.targetRepsLow}-{plannedExercise?.targetRepsHigh} reps
      </p>
      {lastTime && lastTime.length > 0 && (
        <p className="text-sm mb-4">
          <span className="text-faint">Last time:</span> {summariseSets(lastTime, unit)}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
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

      <ul className="text-sm text-faint space-y-1 mb-4">
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

      <LoggedSets sets={loggedSets} unit={unit} editingIndex={editing} onEdit={startEdit} onDelete={handleDelete} />

      <SetForm
        unit={unit}
        values={form}
        onChange={patch}
        weightStep={weightStep}
        weightRange={loadRange}
        weightError={weightError}
        repsError={repsError}
        canSubmit={canSubmit}
        submitLabel={editing !== null ? `Save set ${editing + 1}` : allSetsDone ? 'Add another set' : 'Complete set'}
        hint={repsMissing ? 'Enter your reps to log this set.' : undefined}
        onSubmit={handleSubmit}
        onCancel={editing !== null ? () => { setEditing(null); patch({ reps: '', rpe: null, note: '' }) } : undefined}
        onSameAsLast={editing === null && lastSet ? sameAsLast : undefined}
      />

      {resting && (
        <RestTimer
          endsAt={activeSession.restEndsAt!}
          sound={Boolean(restSound)}
          onAdjust={(d) => setRestEndsAt(sid, Math.max(Date.now(), activeSession.restEndsAt! + d * 1000))}
          onFinished={() => setRestEndsAt(sid, undefined)}
          onSkip={() => setRestEndsAt(sid, undefined)}
        />
      )}

      {setsLogged > 0 && (
        <Button variant={allSetsDone ? 'primary' : 'secondary'} className="w-full" onClick={goNextExercise}>
          {isLastExercise ? 'Finish workout' : allSetsDone ? 'Next exercise' : 'Done with this exercise'}
        </Button>
      )}

      <WorkoutDialogs
        panel={panel}
        close={() => setPanel(null)}
        substitutes={substitutes}
        totalLogged={totalLogged}
        onSwap={handleSwap}
        onSkip={handleSkip}
        onSaveAndExit={() => navigate('/dashboard')}
        onDiscard={handleDiscard}
        onFinish={() => handleFinish(true)}
      />
    </div>
  )
}
