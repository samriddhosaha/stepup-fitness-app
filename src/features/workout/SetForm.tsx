import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { NumberField, TextArea } from '../../components/forms'
import { RPE_LABELS } from './constants'
import { distanceUnitFor, type FieldErrors, type SetFormValues } from './setValues'
import type { TrackingType, WeightUnit } from '../../db/types'

/** A stopwatch that drops its reading into the seconds field when stopped. */
function Stopwatch({ onStop }: { onStop: (seconds: number) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => () => clearInterval(timer.current), [])

  function start() {
    const t = Date.now()
    setStartedAt(t)
    setNow(t)
    timer.current = setInterval(() => setNow(Date.now()), 250)
  }
  function stop() {
    clearInterval(timer.current)
    if (startedAt !== null) onStop(Math.max(1, Math.round((Date.now() - startedAt) / 1000)))
    setStartedAt(null)
  }
  const elapsed = startedAt === null ? 0 : Math.floor((now - startedAt) / 1000)

  return (
    <div className="flex items-center gap-3 mt-2">
      <Button variant="secondary" className="min-h-11" onClick={startedAt === null ? start : stop}>
        {startedAt === null ? 'Start timer' : 'Stop and use this time'}
      </Button>
      {startedAt !== null && (
        <span role="timer" aria-label="Stopwatch" className="font-mono text-lg">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
        </span>
      )}
    </div>
  )
}

/**
 * Entry for one set. The fields follow the exercise: weight and reps, reps only, a timed hold
 * (with a stopwatch), or minutes and distance. Effort and a note are shared.
 */
export function SetForm({
  tracking,
  unit,
  showWeight,
  values,
  onChange,
  errors,
  weightStep,
  weightRange,
  canSubmit,
  submitLabel,
  hint,
  onSubmit,
  onCancel,
  onSameAsLast,
}: {
  tracking: TrackingType
  unit: WeightUnit
  showWeight: boolean
  values: SetFormValues
  onChange: (patch: Partial<SetFormValues>) => void
  errors: FieldErrors
  weightStep: number
  weightRange: { min: number; max: number }
  canSubmit: boolean
  submitLabel: string
  hint?: string
  onSubmit: () => void
  onCancel?: () => void
  onSameAsLast?: () => void
}) {
  const [noteOpen, setNoteOpen] = useState(false)
  const showNote = noteOpen || values.note !== ''

  const weightField = (
    <NumberField
      label={tracking === 'duration' ? `Weight (${unit}, optional)` : `Weight (${unit})`}
      value={values.weight}
      onChange={(weight) => onChange({ weight })}
      error={errors.weight}
      min={weightRange.min}
      max={weightRange.max}
      step={weightStep}
      stepper
      centered
    />
  )

  return (
    <form
      noValidate // we validate (and explain) ourselves; native checks would block silently
      onSubmit={(e) => {
        e.preventDefault()
        if (canSubmit) onSubmit()
      }}
      className="mb-4"
    >
      <div className="grid grid-cols-2 gap-3 mb-4">
        {tracking === 'weight-reps' && (
          <>
            {weightField}
            <NumberField label="Reps" inputMode="numeric" value={values.reps} onChange={(reps) => onChange({ reps })} error={errors.reps} min={1} max={100} step={1} stepper centered />
          </>
        )}
        {tracking === 'bodyweight-reps' && (
          <div className="col-span-2">
            <NumberField label="Reps" inputMode="numeric" value={values.reps} onChange={(reps) => onChange({ reps })} error={errors.reps} min={1} max={100} step={1} stepper centered />
          </div>
        )}
        {tracking === 'duration' && (
          <>
            {showWeight ? weightField : null}
            <div className={showWeight ? '' : 'col-span-2'}>
              <NumberField label="Seconds" inputMode="numeric" value={values.seconds} onChange={(seconds) => onChange({ seconds })} error={errors.seconds} min={1} step={5} stepper centered />
            </div>
            <div className="col-span-2 -mt-2">
              <Stopwatch onStop={(s) => onChange({ seconds: String(s) })} />
            </div>
          </>
        )}
        {tracking === 'distance-time' && (
          <>
            <NumberField label="Minutes" inputMode="decimal" value={values.minutes} onChange={(minutes) => onChange({ minutes })} error={errors.minutes} min={1} step={1} stepper centered />
            <NumberField
              label={`Distance (${distanceUnitFor(unit)}, optional)`}
              value={values.distance}
              onChange={(distance) => onChange({ distance })}
              error={errors.distance}
              min={0}
              step={0.5}
              stepper
              centered
            />
          </>
        )}
      </div>

      <fieldset className="mb-4 min-w-0">
        <legend className="label-eyebrow text-ink mb-1.5 p-0">How did it feel?</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {RPE_LABELS.map((label, i) => {
            const n = i + 1
            const selected = values.rpe === n
            return (
              <button
                key={n}
                type="button"
                aria-pressed={selected}
                aria-label={`RPE ${n}, ${label}`}
                onClick={() => onChange({ rpe: selected ? null : n })}
                className={`min-h-14 min-w-0 rounded-lg border border-line px-0.5 flex flex-col items-center justify-center leading-tight ${
                  selected ? 'bg-accent text-on-accent' : 'bg-elevated text-ink hover:bg-surface'
                }`}
              >
                <span className="font-semibold">{n}</span>
                <span className="text-[0.7rem] font-mono">{label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-faint mt-1.5">1 is easy; 4–5 means close to your limit. Optional.</p>
      </fieldset>

      {showNote ? (
        <div className="mb-4">
          <TextArea label="Note" value={values.note} onChange={(e) => onChange({ note: e.target.value })} maxLength={300} className="min-h-16" />
        </div>
      ) : (
        <button type="button" className="text-sm font-semibold text-accent min-h-11 mb-2" onClick={() => setNoteOpen(true)}>
          Add a note
        </button>
      )}

      {hint && <p className="text-xs text-faint mb-2">{hint}</p>}

      <div className="flex gap-3 flex-wrap">
        <Button type="submit" className="flex-1 min-w-40" disabled={!canSubmit}>
          {submitLabel}
        </Button>
        {onSameAsLast && (
          <Button variant="ghost" onClick={onSameAsLast}>
            Same as last set
          </Button>
        )}
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
