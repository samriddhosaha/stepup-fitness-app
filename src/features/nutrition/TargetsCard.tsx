import { useState } from 'react'
import { Link } from 'react-router-dom'
import { NumberField, SegmentedControl } from '../../components/forms'
import { Button, Card } from '../../components/ui'
import { db } from '../../db/schema'
import type { ActivityLevel, NutritionGoal, Profile, Sex } from '../../db/types'
import {
  ACTIVITY_LEVELS,
  CALORIE_FLOOR,
  CALORIE_TARGET_RANGE,
  GOAL_OPTIONS,
  NUTRITION_DISCLAIMER,
  PROTEIN_TARGET_RANGE,
} from '../../lib/nutrition'
import { formatWeight } from '../../lib/units'
import { useNutritionToday } from '../../lib/useNutrition'
import { useUnit } from '../../lib/useUnit'
import { AGE_RANGE, HEIGHT_CM_RANGE, rangeErrorMessage } from '../../lib/validation'

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'unspecified', label: 'Prefer not to say' },
]

const ACTIVITY_OPTIONS = ACTIVITY_LEVELS.map((l) => ({ value: l.value, label: `${l.label} — ${l.hint}` }))
const GOAL_CHOICES = GOAL_OPTIONS.map((g) => ({ value: g.value, label: g.label }))

/**
 * A stepper + typed number that saves as soon as the value is valid. While typing, what's on
 * screen is a draft (so "1" on the way to "150" isn't snapped back); once the saved value
 * changes, the draft is dropped.
 */
function TargetField({
  label,
  value,
  step,
  range,
  unit,
  onCommit,
}: {
  label: string
  value: number
  step: number
  range: { min: number; max: number }
  unit: string
  onCommit: (n: number) => void
}) {
  const [draft, setDraft] = useState<{ base: number; text: string } | null>(null)
  const shown = draft && draft.base === value ? draft.text : String(value)
  return (
    <NumberField
      label={label}
      stepper
      centered
      step={step}
      inputMode="numeric"
      min={range.min}
      max={range.max}
      value={shown}
      error={rangeErrorMessage(shown, range, unit)}
      onChange={(text) => {
        setDraft({ base: value, text })
        const n = Number(text)
        if (text.trim() !== '' && Number.isFinite(n) && n >= range.min && n <= range.max) onCommit(Math.round(n))
      }}
    />
  )
}

/**
 * Daily calorie and protein targets: worked out from the profile (Mifflin-St Jeor, activity and
 * goal), and fully editable. Anything the user sets themselves wins over the calculation.
 */
export function TargetsCard() {
  const { data } = useNutritionToday()
  const unit = useUnit()
  const [age, setAge] = useState<string | null>(null)
  const [height, setHeight] = useState<string | null>(null)

  if (!data?.profile) return null
  const { profile, calculated, effective, weightKg } = data

  async function update(patch: Partial<Profile>) {
    await db.profile.update(profile.id!, patch)
  }

  const ageText = age ?? (profile.age !== undefined ? String(profile.age) : '')
  const heightText = height ?? (profile.heightCm !== undefined ? String(profile.heightCm) : '')
  const ageError = rangeErrorMessage(ageText, AGE_RANGE, 'years')
  const heightError = rangeErrorMessage(heightText, HEIGHT_CM_RANGE, 'cm')
  const goal = profile.nutritionGoal ?? 'maintain'
  const activity = profile.activityLevel ?? 'light'

  return (
    <Card>
      <h2 className="label-eyebrow text-faint mb-3">Your targets</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <NumberField
          label="Age"
          inputMode="numeric"
          min={AGE_RANGE.min}
          max={AGE_RANGE.max}
          error={ageError}
          value={ageText}
          onChange={(v) => {
            setAge(v)
            if (v === '') void update({ age: undefined })
            else if (!rangeErrorMessage(v, AGE_RANGE, 'years')) void update({ age: Math.round(Number(v)) })
          }}
        />
        <NumberField
          label="Height (cm)"
          inputMode="numeric"
          min={HEIGHT_CM_RANGE.min}
          max={HEIGHT_CM_RANGE.max}
          error={heightError}
          value={heightText}
          onChange={(v) => {
            setHeight(v)
            if (v === '') void update({ heightCm: undefined })
            else if (!rangeErrorMessage(v, HEIGHT_CM_RANGE, 'cm')) void update({ heightCm: Math.round(Number(v)) })
          }}
        />
      </div>

      <div className="mb-4">
        <span className="label-eyebrow block text-faint mb-2">Sex (used in the formula)</span>
        <SegmentedControl label="Sex" options={SEX_OPTIONS} value={profile.sex} onChange={(sex) => update({ sex })} />
      </div>

      <p className="text-sm mb-4">
        <span className="label-eyebrow text-faint mr-2">Weight</span>
        {weightKg !== undefined ? (
          <>
            <span className="font-semibold">{formatWeight(weightKg, unit)}</span>
            <span className="text-faint"> from your latest weigh-in · </span>
          </>
        ) : (
          <span className="text-faint">No weight yet · </span>
        )}
        <Link to="/log" className="font-semibold text-accent underline underline-offset-2">
          log weight
        </Link>
      </p>

      <div className="mb-4">
        <span className="label-eyebrow block text-faint mb-2">Activity</span>
        <SegmentedControl<ActivityLevel>
          label="Activity level"
          layout="column"
          options={ACTIVITY_OPTIONS}
          value={activity}
          onChange={(activityLevel) => update({ activityLevel })}
        />
      </div>

      <div className="mb-5">
        <span className="label-eyebrow block text-faint mb-2">Goal</span>
        <SegmentedControl<NutritionGoal>
          label="Goal"
          options={GOAL_CHOICES}
          value={goal}
          onChange={(nutritionGoal) => update({ nutritionGoal })}
        />
        <p className="text-xs text-faint mt-2">{GOAL_OPTIONS.find((g) => g.value === goal)?.hint}</p>
      </div>

      <div className="border-t border-hairline pt-4" data-testid="targets-result">
        {calculated.ok ? (
          <>
            <p className="text-sm text-faint mb-3">
              Maintenance is about <span className="font-semibold text-ink">{calculated.tdee.toLocaleString()} kcal</span> a
              day (resting {calculated.bmr.toLocaleString()}).
              {calculated.floored && ` Your target is held at ${CALORIE_FLOOR} kcal, the lowest we’ll suggest.`}
            </p>
            <p className="text-sm mb-1">
              <span className="label-eyebrow text-faint mr-2">Suggested</span>
              <span className="font-semibold">{calculated.proteinG} g protein</span> · {calculated.calories.toLocaleString()}{' '}
              kcal · carbs {calculated.carbsG} g · fat {calculated.fatG} g
            </p>
          </>
        ) : (
          <p className="text-sm text-faint">
            Add your {calculated.missing.join(', ').replace(/, ([^,]*)$/, ' and $1')} and we’ll work out a starting point. Or
            just set your own below.
          </p>
        )}
      </div>

      <div className="mt-5 space-y-4">
        <TargetField
          label={`Protein target (g)${profile.proteinTargetG !== undefined ? ' — set by you' : ''}`}
          value={effective.proteinG ?? 120}
          step={5}
          range={PROTEIN_TARGET_RANGE}
          unit="g"
          onCommit={(proteinTargetG) => update({ proteinTargetG })}
        />
        <TargetField
          label={`Calorie target (kcal)${profile.calorieTargetKcal !== undefined ? ' — set by you' : ''}`}
          value={effective.calories ?? 2000}
          step={50}
          range={CALORIE_TARGET_RANGE}
          unit="kcal"
          onCommit={(calorieTargetKcal) => update({ calorieTargetKcal })}
        />
        {(profile.proteinTargetG !== undefined || profile.calorieTargetKcal !== undefined) && calculated.ok && (
          <Button variant="ghost" onClick={() => update({ proteinTargetG: undefined, calorieTargetKcal: undefined })}>
            Use the calculated targets
          </Button>
        )}
      </div>

      <p className="text-xs text-faint mt-5">{NUTRITION_DISCLAIMER}</p>
    </Card>
  )
}
