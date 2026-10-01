import { useState } from 'react'
import { Button } from '../../components/ui'
import { NumberField, TextArea } from '../../components/forms'
import { RPE_LABELS, type SetFormValues } from './constants'
import type { WeightUnit } from '../../db/types'

/**
 * Weight / reps / effort for one set. Weight and reps have +/- steppers, effort uses plain
 * words, and an optional note stays tucked away until asked for.
 */
export function SetForm({
  unit,
  values,
  onChange,
  weightStep,
  weightRange,
  weightError,
  repsError,
  canSubmit,
  submitLabel,
  hint,
  onSubmit,
  onCancel,
  onSameAsLast,
}: {
  unit: WeightUnit
  values: SetFormValues
  onChange: (patch: Partial<SetFormValues>) => void
  weightStep: number
  weightRange: { min: number; max: number }
  weightError: string | null
  repsError: string | null
  canSubmit: boolean
  submitLabel: string
  hint?: string
  onSubmit: () => void
  onCancel?: () => void
  onSameAsLast?: () => void
}) {
  const [noteOpen, setNoteOpen] = useState(false)
  const showNote = noteOpen || values.note !== ''

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
        <NumberField
          label={`Weight (${unit})`}
          value={values.weight}
          onChange={(weight) => onChange({ weight })}
          error={weightError}
          min={weightRange.min}
          max={weightRange.max}
          step={weightStep}
          stepper
          centered
        />
        <NumberField
          label="Reps"
          inputMode="numeric"
          value={values.reps}
          onChange={(reps) => onChange({ reps })}
          error={repsError}
          min={1}
          max={100}
          step={1}
          stepper
          centered
        />
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
          <TextArea
            label="Note"
            value={values.note}
            onChange={(e) => onChange({ note: e.target.value })}
            maxLength={300}
            className="min-h-16"
          />
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
