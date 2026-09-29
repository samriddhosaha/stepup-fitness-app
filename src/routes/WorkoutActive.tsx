import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getActivePlan } from '../db/schema'
import { getExerciseById, getSubstitutes } from '../db/exerciseLibrary'
import {
  finishSession,
  getInProgressSession,
  leaveSession,
  logSet,
  mostRecentLoggedSets,
  recordSkip,
} from '../lib/workout'
import { suggestNextLoad } from '../lib/overload'
import { checkAndRecordPRs } from '../lib/records'
import { awardXP } from '../lib/xp'
import { track } from '../lib/analytics'
import { REPS_RANGE, WORKOUT_LOAD_KG_RANGE, rangeErrorMessage } from '../lib/validation'
import { Button, Card } from '../components/ui'
import type { PlanExercise, SkipReason } from '../db/types'

const SKIP_REASONS: { value: SkipReason; label: string }[] = [
  { value: 'too-difficult', label: 'Too difficult today' },
  { value: 'equipment-not-free', label: 'Equipment not free' },
  { value: 'discomfort-or-pain', label: 'Discomfort or pain' },
  { value: 'running-out-of-time', label: 'Running out of time' },
  { value: 'another-reason', label: 'Another reason' },
]

const DEFAULT_REST_SECONDS = 90

export default function WorkoutActive() {
  const navigate = useNavigate()
  const session = useLiveQuery(getInProgressSession)
  const plan = useLiveQuery(getActivePlan)
  const profile = useLiveQuery(() => db.profile.orderBy('createdAt').last())

  const [exerciseIds, setExerciseIds] = useState<string[] | null>(null)
  const [swapMap, setSwapMap] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [restSeconds, setRestSeconds] = useState(0)
  const [restRunning, setRestRunning] = useState(false)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState<number | null>(null)
  const [showSwap, setShowSwap] = useState(false)
  const [showSkip, setShowSkip] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [suggestionMessage, setSuggestionMessage] = useState<string | undefined>(undefined)

  const weightError = rangeErrorMessage(weight, WORKOUT_LOAD_KG_RANGE, 'kg')
  const repsError = rangeErrorMessage(reps, REPS_RANGE, 'reps')

  const planSession = useMemo(
    () => plan?.sessions.find((s) => s.name === session?.planSessionName),
    [plan, session],
  )

  useEffect(() => {
    if (planSession && exerciseIds === null) {
      setExerciseIds(planSession.exercises.map((e) => e.exerciseId))
    }
  }, [planSession, exerciseIds])

  useEffect(() => {
    if (!restRunning) return
    if (restSeconds <= 0) {
      setRestRunning(false)
      return
    }
    const t = setTimeout(() => setRestSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [restRunning, restSeconds])

  const currentExerciseId = exerciseIds?.[index]
  const currentExercise = currentExerciseId ? getExerciseById(currentExerciseId) : undefined
  // swapMap is keyed by the *post-swap* exerciseId, pointing back at the
  // original planned exerciseId, so target sets/reps/load still resolve
  // correctly against the plan after a swap.
  const plannedExercise: PlanExercise | undefined = planSession?.exercises.find(
    (pe) => pe.exerciseId === (swapMap[currentExerciseId ?? ''] ?? currentExerciseId),
  )

  useEffect(() => {
    setWeight('')
    setReps('')
    setRpe(null)
    setSuggestionMessage(undefined)
    if (!currentExerciseId || !plannedExercise) return
    mostRecentLoggedSets(currentExerciseId, session?.id).then((prevSets) => {
      if (prevSets && prevSets.length > 0) {
        const suggestion = suggestNextLoad(plannedExercise, prevSets)
        setSuggestionMessage(suggestion.message)
        if (suggestion.suggestedWeightKg) setWeight(String(suggestion.suggestedWeightKg))
      } else if (plannedExercise.startingLoadKg) {
        setWeight(String(plannedExercise.startingLoadKg))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExerciseId])

  if (!session || !planSession || !exerciseIds || !currentExerciseId || !currentExercise) {
    return null
  }
  const activeSession = session

  const loggedForCurrent = session.exercises.find((e) => e.exerciseId === currentExerciseId)
  const setsLogged = loggedForCurrent?.sets.length ?? 0
  const targetSets = plannedExercise?.targetSets ?? 3
  const isLastExercise = index === exerciseIds.length - 1
  const allSetsDone = setsLogged >= targetSets

  async function handleLogSet() {
    if (!activeSession.id) return
    if (weightError || repsError) return
    await logSet(
      activeSession.id,
      currentExerciseId!,
      {
        setIndex: setsLogged,
        weightKg: weight ? Number(weight) : undefined,
        reps: reps ? Number(reps) : undefined,
        rpe: rpe ?? undefined,
      },
      swapMap[currentExerciseId!],
    )
    await awardXP('set')
    setRestSeconds(DEFAULT_REST_SECONDS)
    setRestRunning(true)
    setRpe(null)
  }

  async function goNextExercise() {
    if (activeSession.id) await awardXP('exercise')
    if (isLastExercise) {
      await handleFinish(false)
    } else {
      setIndex((i) => i + 1)
      setRestRunning(false)
      setRestSeconds(0)
    }
  }

  async function handleSwap(newId: string) {
    setSwapMap((m) => ({ ...m, [newId]: swapMap[currentExerciseId!] ?? currentExerciseId! }))
    setExerciseIds((ids) => ids!.map((id, i) => (i === index ? newId : id)))
    setShowSwap(false)
  }

  async function handleSkip(reason: SkipReason) {
    if (activeSession.id) {
      await recordSkip(activeSession.id, { exerciseId: currentExerciseId!, reason })
      await track('exercise_skipped', { exerciseId: currentExerciseId, reason })
    }
    setShowSkip(false)
    if (isLastExercise) {
      await handleFinish(false)
    } else {
      setIndex((i) => i + 1)
      setRestRunning(false)
      setRestSeconds(0)
    }
  }

  async function handleFinish(early: boolean) {
    if (!activeSession.id) return
    await finishSession(activeSession.id, early)
    const fresh = await db.workoutSessions.get(activeSession.id)
    if (fresh) {
      const newPRs = await checkAndRecordPRs(fresh.exercises)
      for (const pr of newPRs) {
        await awardXP('pr', pr.exerciseId)
        await track('pr_achieved', { exerciseId: pr.exerciseId, value: pr.value })
      }
    }
    await awardXP('workout')
    await track('workout_completed', { sessionId: activeSession.id, early })
    navigate('/workout/complete', { state: { sessionId: activeSession.id } })
  }

  async function handleLeave() {
    if (activeSession.id) {
      await track('workout_abandoned', { sessionId: activeSession.id })
      await leaveSession(activeSession.id)
    }
    navigate('/dashboard')
  }

  const substitutes = profile ? getSubstitutes(currentExercise, profile.equipment) : []
  const warmupRamp = currentExercise.warmupRamp

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <button
          className="text-sm font-bold text-faint min-h-12 px-2"
          onClick={() => setShowLeaveConfirm(true)}
        >
          Leave
        </button>
        <p className="label-eyebrow text-faint">
          Exercise {index + 1} / {exerciseIds.length}
        </p>
        <button
          className="text-sm font-bold text-accent min-h-12 px-2"
          onClick={() => handleFinish(true)}
        >
          Finish early
        </button>
      </div>

      <h1 className="font-display font-bold text-2xl md:text-3xl mb-1">{currentExercise.name}</h1>
      <p className="text-sm text-faint mb-4">
        {setsLogged} of {targetSets} sets · target {plannedExercise?.targetRepsLow}-
        {plannedExercise?.targetRepsHigh} reps
      </p>

      {warmupRamp && setsLogged === 0 && (
        <Card className="mb-4 bg-accent-soft">
          <p className="label-eyebrow mb-2">Warm-up first</p>
          <ul className="text-sm text-faint space-y-1">
            {warmupRamp.map((r, i) => {
              const base = plannedExercise?.startingLoadKg ?? 0
              return (
                <li key={i}>
                  {Math.round(base * r.percentOfWorking)} kg × {r.reps} reps
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <ul className="text-xs text-faint space-y-1 mb-4">
        {currentExercise.formCues.map((cue) => (
          <li key={cue}>{cue}</li>
        ))}
      </ul>

      {suggestionMessage && setsLogged === 0 && (
        <p className="text-sm text-accent mb-4">{suggestionMessage}</p>
      )}

      <div className="flex gap-3 mb-4">
        <Button variant="ghost" className="flex-1" onClick={() => setShowSwap(true)}>
          Replace exercise
        </Button>
        <Button variant="ghost" className="flex-1" onClick={() => setShowSkip(true)}>
          Skip
        </Button>
      </div>

      {showSwap && (
        <Card className="mb-4">
          <p className="font-bold mb-3">Same movement, same muscles, kit you actually have</p>
          {substitutes.length === 0 ? (
            <p className="text-sm text-faint">
              There's no close swap available with your equipment.
            </p>
          ) : (
            <div className="space-y-2">
              {substitutes.map((sub) => (
                <button
                  key={sub.id}
                  className="w-full text-left font-bold rounded-sm border-2 border-ink px-4 py-3 min-h-12 hover:bg-hairline/40"
                  onClick={() => handleSwap(sub.id)}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}
          <Button variant="ghost" className="w-full mt-3" onClick={() => setShowSwap(false)}>
            Cancel
          </Button>
        </Card>
      )}

      {showSkip && (
        <Card className="mb-4">
          <p className="font-bold mb-3">Why skip this one?</p>
          <div className="space-y-2">
            {SKIP_REASONS.map((r) => (
              <button
                key={r.value}
                className="w-full text-left font-bold rounded-sm border-2 border-ink px-4 py-3 min-h-12 hover:bg-hairline/40"
                onClick={() => handleSkip(r.value)}
              >
                {r.label}
              </button>
            ))}
            <button
              className="w-full text-left text-faint px-4 py-3 min-h-12"
              onClick={() => handleSkip('unspecified')}
            >
              Skip without saying
            </button>
          </div>
        </Card>
      )}

      {showLeaveConfirm && (
        <Card className="mb-4">
          <p className="font-bold mb-2">Leave this workout?</p>
          <p className="text-sm text-faint mb-3">
            Nothing logged so far will be saved.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setShowLeaveConfirm(false)}>
              Stay
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleLeave}>
              Leave
            </Button>
          </div>
        </Card>
      )}

      {!showSwap && !showSkip && !showLeaveConfirm && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <label className="block">
              <span className="label-eyebrow block text-faint mb-1.5">Weight (kg)</span>
              <input
                type="number"
                inputMode="decimal"
                min={WORKOUT_LOAD_KG_RANGE.min}
                max={WORKOUT_LOAD_KG_RANGE.max}
                aria-invalid={Boolean(weightError)}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={`w-full rounded-sm border-2 bg-elevated px-3 py-3 min-h-12 text-center text-lg font-bold focus:outline-2 ${
                  weightError ? 'border-danger focus:outline-danger' : 'border-ink focus:outline-accent'
                }`}
              />
              {weightError && <span className="block text-xs font-bold text-danger mt-1">{weightError}</span>}
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
                className={`w-full rounded-sm border-2 bg-elevated px-3 py-3 min-h-12 text-center text-lg font-bold focus:outline-2 ${
                  repsError ? 'border-danger focus:outline-danger' : 'border-ink focus:outline-accent'
                }`}
              />
              {repsError && <span className="block text-xs font-bold text-danger mt-1">{repsError}</span>}
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
                    className={`flex-1 min-h-12 rounded-sm text-sm font-bold border-2 border-ink ${
                      rpe === n ? 'bg-accent text-white' : 'bg-elevated'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            className="w-full mb-4"
            onClick={handleLogSet}
            disabled={Boolean(weightError) || Boolean(repsError)}
          >
            Complete set
          </Button>

          {restRunning && (
            <Card className="mb-4">
              <p className="text-center text-3xl font-display font-bold mb-3">
                {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, '0')}
              </p>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setRestSeconds((s) => Math.max(0, s - 15))}
                >
                  −15s
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setRestSeconds((s) => s + 15)}
                >
                  +15s
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setRestRunning(false)}>
                  Skip rest
                </Button>
              </div>
            </Card>
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
