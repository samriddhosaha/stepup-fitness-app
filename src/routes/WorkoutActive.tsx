import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { useProfile } from '../db/repo'
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
import { measureFor, loadStepFor, suggestNextLoad, warmupSets } from '../lib/overload'
import { estimateCalibrationHintKg } from '../lib/plan'
import { avoidExercise } from '../lib/planEdit'
import { track } from '../lib/analytics'
import { formatWeight, parseWeight, workoutLoadRangeForUnit } from '../lib/units'
import { useUnit } from '../lib/useUnit'
import { useWakeLock } from '../lib/useWakeLock'
import { Button, Card, PageSkeleton } from '../components/ui'
import { RestTimer } from '../components/RestTimer'
import { useToast } from '../components/toastContext'
import { SetForm } from '../features/workout/SetForm'
import { LoggedSets } from '../features/workout/LoggedSets'
import { WorkoutDialogs } from '../features/workout/WorkoutDialogs'
import { type WorkoutPanel } from '../features/workout/constants'
import {
  EMPTY_FORM,
  setFromValues,
  summariseSets,
  targetLabel,
  validateValues,
  valuesFromSet,
  type SetFormValues,
} from '../features/workout/setValues'
import type { LoggedSet, PlanExercise, SkipReason, WorkoutSession } from '../db/types'

const DEFAULT_REST_SECONDS = 90
/** Rests this short (mobility holds) don't warrant a countdown. */
const MIN_REST_TO_SHOW = 20

/** The planned slot for the exercise at the current position (a swapped-in exercise inherits the slot's targets). */
function plannedFor(session: WorkoutSession, exerciseId: string): PlanExercise | undefined {
  const originalId = session.swapMap?.[exerciseId] ?? exerciseId
  const original = session.plannedSnapshot?.find((p) => p.exerciseId === originalId)
  if (!original || originalId === exerciseId) return original
  return { ...original, exerciseId, startingLoadKg: undefined }
}

export default function WorkoutActive() {
  const navigate = useNavigate()
  const toast = useToast()
  // null = no open session, undefined = still loading
  const session = useLiveQuery(async () => (await getInProgressSession()) ?? null)
  const profile = useProfile()
  const restSound = useLiveQuery(async () => Boolean((await db.settings.get('restSound'))?.value), [])
  const unit = useUnit()

  const [form, setForm] = useState<SetFormValues>(EMPTY_FORM)
  const [editing, setEditing] = useState<number | null>(null)
  const [panel, setPanel] = useState<WorkoutPanel>(null)
  const [suggestionMessage, setSuggestionMessage] = useState<string | undefined>()
  const [target, setTarget] = useState<{ value: number; measure: string } | undefined>()
  const [calibration, setCalibration] = useState<{ hintKg?: number } | undefined>()
  const [lastTime, setLastTime] = useState<LoggedSet[] | undefined>()
  const [announce, setAnnounce] = useState('')
  const [painFor, setPainFor] = useState<string | null>(null)
  const logging = useRef(false)
  // Set while finishing: once the session closes the live query goes null, and we must head to the summary, not the dashboard.
  const [finishingId, setFinishingId] = useState<number | null>(null)

  useWakeLock(Boolean(session))

  const order = session?.exerciseOrder
  const index = session ? Math.min(session.currentIndex ?? 0, (order?.length ?? 1) - 1) : 0
  const currentExerciseId = order?.[index]
  const currentExercise = currentExerciseId ? getExerciseById(currentExerciseId) : undefined
  const plannedExercise = session && currentExerciseId ? plannedFor(session, currentExerciseId) : undefined
  const sessionId = session?.id
  const tracking = currentExercise?.trackingType ?? 'weight-reps'
  const patch = (p: Partial<SetFormValues>) => setForm((f) => ({ ...f, ...p }))

  // Prefill from what the lifter actually did last time (exerciseState), not the plan.
  useEffect(() => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setSuggestionMessage(undefined)
    setTarget(undefined)
    setCalibration(undefined)
    setLastTime(undefined)
    if (!currentExerciseId || !plannedExercise) return
    let cancelled = false
    void (async () => {
      const [state, prev] = await Promise.all([
        db.exerciseState.get(currentExerciseId),
        mostRecentLoggedSets(currentExerciseId, sessionId),
      ])
      if (cancelled) return
      const trackingType = getExerciseById(currentExerciseId)?.trackingType
      const s = suggestNextLoad(plannedExercise, [], state, { unit, tracking: trackingType })
      if (s.needsCalibration) {
        setCalibration({ hintKg: profile ? estimateCalibrationHintKg(currentExerciseId, profile) : undefined })
      } else {
        if (state) setSuggestionMessage(s.message)
        const kg = s.suggestedWeightKg ?? plannedExercise.startingLoadKg
        if (kg) patch({ weight: formatWeight(kg, unit, false) })
      }
      if (s.suggestedReps) setTarget({ value: s.suggestedReps, measure: s.measure ?? measureFor(trackingType) })
      setLastTime(prev)
    })()
    return () => {
      cancelled = true
    }
    // Re-prefill only when the exercise (or unit) changes, not on every live-query emission.
    // oxlint-disable-next-line react/exhaustive-deps
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

  // timed holds can carry a load (carries); reps-based lifts always have weight, bodyweight moves never
  const showWeight = tracking === 'weight-reps' || (tracking === 'duration' && currentExercise.kit === 'dumbbell')
  const loadRange = workoutLoadRangeForUnit(unit)
  const validation = validateValues(form, tracking, unit, showWeight)
  const workingKg = parseWeight(form.weight, unit) ?? undefined
  const weightStep = loadStepFor(currentExerciseId, workingKg, unit)
  const warmups = setsLogged === 0 && tracking === 'weight-reps' ? warmupSets(currentExercise.warmupRamp, workingKg, unit) : []
  const rest = plannedExercise?.restSeconds ?? DEFAULT_REST_SECONDS
  const resting = activeSession.restEndsAt !== undefined
  const lastSet = loggedSets[loggedSets.length - 1]
  const substitutes = profile ? getSubstitutes(currentExercise, profile.equipment).filter((s) => !profile.avoidedExerciseIds?.includes(s.id)) : []

  const painExercise = painFor ? getExerciseById(painFor) : undefined
  const painReplacement = painExercise && profile ? getSubstitutes(painExercise, profile.equipment).find((s) => !profile.avoidedExerciseIds?.includes(s.id)) : undefined

  async function handleSubmit() {
    if (!validation.canSubmit || logging.current) return
    logging.current = true
    try {
      if (editing !== null) {
        const next = setFromValues(form, tracking, unit, editing, showWeight)
        if (!next) return
        const { setIndex: _ignored, ...changes } = next
        void _ignored
        if (await updateSet(sid, currentExerciseId!, editing, changes)) {
          setAnnounce(`Set ${editing + 1} updated`)
          setEditing(null)
          patch({ reps: '', seconds: '', minutes: '', distance: '', rpe: null, note: '' })
        }
        return
      }
      const next = setFromValues(form, tracking, unit, setsLogged, showWeight)
      if (!next) return
      const result = await logSet(sid, currentExerciseId!, next, activeSession.swapMap?.[currentExerciseId!])
      if (result.ok) {
        setAnnounce(`Set ${setsLogged + 1} logged`)
        if (rest >= MIN_REST_TO_SHOW) await setRestEndsAt(sid, Date.now() + rest * 1000)
        patch({ reps: '', seconds: '', minutes: '', distance: '', rpe: null, note: '' })
      }
    } finally {
      logging.current = false
    }
  }

  function startEdit(i: number) {
    const s = loggedSets[i]
    if (!s) return
    setEditing(i)
    setForm(valuesFromSet(s, unit))
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
    const v = valuesFromSet(lastSet, unit)
    patch({ weight: v.weight, reps: v.reps, seconds: v.seconds, minutes: v.minutes, distance: v.distance, rpe: v.rpe })
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

  async function advance() {
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
    if (reason === 'discomfort-or-pain') {
      // don't just move on: offer to stop suggesting it
      setPainFor(currentExerciseId!)
      setPanel('pain')
      return
    }
    setPanel(null)
    await advance()
  }

  async function finishPainFlow(action: 'replace' | 'remove' | 'dismiss') {
    const id = painFor
    setPainFor(null)
    setPanel(null)
    if (id && action === 'replace' && painReplacement) {
      await avoidExercise(id, { replaceWith: painReplacement.id })
      toast(`${getExerciseById(id)?.name} won’t be suggested again.`)
    } else if (id && action === 'remove') {
      await avoidExercise(id, { removeFromPlan: true })
      toast(`${getExerciseById(id)?.name} won’t be suggested again.`)
    }
    await advance()
  }

  async function handleDiscard() {
    await track('workout_abandoned', { sessionId: sid })
    setFinishingId(null)
    await discardSession(sid)
    navigate('/dashboard')
  }

  const submitLabel = editing !== null ? `Save set ${editing + 1}` : allSetsDone ? 'Add another set' : 'Complete set'
  const needHint = validation.missing && !allSetsDone ? `Enter your ${validation.missing} to log this set.` : undefined

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <button className="text-sm font-semibold text-faint min-h-12 px-2" onClick={() => setPanel('leave')}>
          Leave
        </button>
        <p className="label-eyebrow text-faint">
          Exercise {index + 1} / {order.length}
          {plannedExercise?.block && plannedExercise.block !== 'main' ? ` · ${plannedExercise.block}` : ''}
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
        {setsLogged} of {targetSets} sets · target{' '}
        {plannedExercise ? targetLabel(plannedExercise.targetRepsLow, plannedExercise.targetRepsHigh, tracking) : ''}
      </p>
      {lastTime && lastTime.length > 0 && (
        <p className="text-sm mb-4">
          <span className="text-faint">Last time:</span> {summariseSets(lastTime, unit, tracking)}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {calibration && setsLogged === 0 && (
        <Card className="mb-4 bg-accent-soft">
          <p className="label-eyebrow mb-1">First time with this one</p>
          <p className="text-sm mb-2">
            Pick a weight you could lift about 10 times with good form, then log your sets. StepUp takes it from there.
          </p>
          {calibration.hintKg ? (
            <>
              <p className="text-xs text-faint mb-2">Many people start around {formatWeight(calibration.hintKg, unit)}. Lighter is always fine.</p>
              <Button variant="secondary" className="min-h-11" onClick={() => patch({ weight: formatWeight(calibration.hintKg!, unit, false) })}>
                Use {formatWeight(calibration.hintKg, unit)}
              </Button>
            </>
          ) : null}
        </Card>
      )}

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
      {target && setsLogged === 0 && (
        <p className="text-sm text-accent mb-4">
          Aim for {target.value} {target.measure}.
        </p>
      )}

      <div className="flex gap-3 mb-4">
        <Button variant="ghost" className="flex-1" onClick={() => setPanel('swap')}>
          Replace exercise
        </Button>
        <Button variant="ghost" className="flex-1" onClick={() => setPanel('skip')}>
          Skip
        </Button>
      </div>

      <LoggedSets sets={loggedSets} unit={unit} tracking={tracking} editingIndex={editing} onEdit={startEdit} onDelete={handleDelete} />

      <SetForm
        tracking={tracking}
        unit={unit}
        showWeight={showWeight}
        values={form}
        onChange={patch}
        errors={validation.errors}
        weightStep={weightStep}
        weightRange={loadRange}
        canSubmit={validation.canSubmit}
        submitLabel={submitLabel}
        hint={needHint}
        onSubmit={handleSubmit}
        onCancel={
          editing !== null
            ? () => {
                setEditing(null)
                patch({ reps: '', seconds: '', minutes: '', distance: '', rpe: null, note: '' })
              }
            : undefined
        }
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
        <Button variant={allSetsDone ? 'primary' : 'secondary'} className="w-full" onClick={advance}>
          {isLastExercise ? 'Finish workout' : allSetsDone ? 'Next exercise' : 'Done with this exercise'}
        </Button>
      )}

      <WorkoutDialogs
        panel={panel}
        close={() => (panel === 'pain' ? void finishPainFlow('dismiss') : setPanel(null))}
        substitutes={substitutes}
        totalLogged={totalLogged}
        onSwap={handleSwap}
        onSkip={handleSkip}
        onSaveAndExit={() => navigate('/dashboard')}
        onDiscard={handleDiscard}
        onFinish={() => handleFinish(true)}
        painExerciseName={painExercise?.name}
        painReplacement={painReplacement}
        onPainReplace={() => void finishPainFlow('replace')}
        onPainRemove={() => void finishPainFlow('remove')}
        onPainDismiss={() => void finishPainFlow('dismiss')}
      />
    </div>
  )
}
