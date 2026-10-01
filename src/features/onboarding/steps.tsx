import type { ReactNode } from 'react'
import { Card, TextField } from '../../components/ui'
import { FieldGroup, NumberField, SegmentedControl, TextArea, ToggleChip } from '../../components/forms'
import {
  EQUIPMENT_OPTIONS,
  FITNESS_LEVELS,
  GOALS,
  INJURY_AREA_OPTIONS,
  PREFERENCE_OPTIONS,
  SEX_OPTIONS,
  UNIT_OPTIONS,
  WEEKDAYS,
  toggleInArray,
  withLabel,
} from '../../lib/options'
import { AGE_GATE, AGE_RANGE, HEIGHT_CM_RANGE, bodyWeightRangeForUnit, rangeErrorMessage } from '../../lib/validation'
import {
  READINESS_QUESTIONS,
  ageError,
  explainPlan,
  needsGentleStart,
  needsGuardianNote,
  type OnboardingDraft,
  type StepId,
  type YesNo,
} from './draft'
import type { PrimaryGoal } from '../../db/types'

interface StepProps {
  draft: OnboardingDraft
  set: (patch: Partial<OnboardingDraft>) => void
}

function NameStep({ draft, set }: StepProps) {
  return <TextField label="Name" hint="Used for your greeting, nothing else." value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} autoFocus />
}

function BasicsStep({ draft, set }: StepProps) {
  const ageMsg = ageError(draft.age)
  const heightMsg = rangeErrorMessage(String(draft.heightCm ?? ''), HEIGHT_CM_RANGE, 'cm')
  const weightMsg = rangeErrorMessage(draft.weightInput, bodyWeightRangeForUnit(draft.weightUnit), draft.weightUnit)
  return (
    <div className="space-y-5">
      <p className="text-xs text-faint">Used to size your starting program. Stays on this device, like everything else.</p>
      <FieldGroup legend="Weights in">
        <SegmentedControl label="Weight unit" options={withLabel(UNIT_OPTIONS, 'short')} value={draft.weightUnit} onChange={(weightUnit) => set({ weightUnit })} />
      </FieldGroup>
      <NumberField
        label="Age"
        inputMode="numeric"
        value={draft.age === undefined ? '' : String(draft.age)}
        onChange={(v) => set({ age: v === '' ? undefined : Number(v), guardianAck: false })}
        error={ageMsg}
        min={AGE_RANGE.min}
        max={AGE_RANGE.max}
        hint={`We ask so we can size things sensibly. StepUp is for ages ${AGE_RANGE.min} and up.`}
      />
      {needsGuardianNote(draft.age) && (
        <Card className="bg-accent-soft">
          <p className="text-sm mb-3">
            You’re under {AGE_GATE}, so please make sure a parent or guardian knows you’re using StepUp, and check any new exercise with them or a coach.
          </p>
          <label className="flex items-start gap-3 text-sm font-semibold min-h-11">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-accent" checked={draft.guardianAck} onChange={(e) => set({ guardianAck: e.target.checked })} />
            A parent or guardian knows I’m using StepUp
          </label>
        </Card>
      )}
      <FieldGroup legend="Sex (optional)">
        <SegmentedControl
          label="Sex"
          options={withLabel(SEX_OPTIONS)}
          value={draft.sex}
          onChange={(sex) => set({ sex })}
        />
      </FieldGroup>
      <div className="grid grid-cols-2 gap-4">
        <NumberField
          label="Height (cm)"
          inputMode="numeric"
          value={draft.heightCm === undefined ? '' : String(draft.heightCm)}
          onChange={(v) => set({ heightCm: v === '' ? undefined : Number(v) })}
          error={heightMsg}
          min={HEIGHT_CM_RANGE.min}
          max={HEIGHT_CM_RANGE.max}
        />
        <NumberField
          label={`Starting weight (${draft.weightUnit})`}
          value={draft.weightInput}
          onChange={(weightInput) => set({ weightInput })}
          error={weightMsg}
          min={bodyWeightRangeForUnit(draft.weightUnit).min}
          max={bodyWeightRangeForUnit(draft.weightUnit).max}
        />
      </div>
    </div>
  )
}

function LevelStep({ draft, set }: StepProps) {
  return <SegmentedControl label="Where you’re starting from" layout="column" options={withLabel(FITNESS_LEVELS)} value={draft.fitnessLevel} onChange={(fitnessLevel) => set({ fitnessLevel })} />
}

function ActivityStep({ draft, set }: StepProps) {
  return (
    <FieldGroup legend="Tick any that apply">
      <div className="flex flex-col gap-3">
        <ToggleChip pressed={draft.liftsAlready} onClick={() => set({ liftsAlready: !draft.liftsAlready })} className="justify-start">
          I already lift weights
        </ToggleChip>
        <ToggleChip pressed={draft.doesCardioAlready} onClick={() => set({ doesCardioAlready: !draft.doesCardioAlready })} className="justify-start">
          I already do cardio
        </ToggleChip>
      </div>
    </FieldGroup>
  )
}

function GoalsStep({ draft, set }: StepProps) {
  const others = GOALS.filter((g) => g.value !== draft.primaryGoal)
  return (
    <div className="space-y-6">
      <FieldGroup legend="Primary goal">
        <SegmentedControl
          label="Primary goal"
          layout="column"
          options={withLabel(GOALS)}
          value={draft.primaryGoal}
          onChange={(primaryGoal) => set({ primaryGoal, secondaryGoal: draft.secondaryGoal === primaryGoal ? undefined : draft.secondaryGoal })}
        />
      </FieldGroup>
      <FieldGroup legend="Secondary goal (optional)">
        <div className="flex flex-col gap-3">
          {others.map((g) => (
            <ToggleChip
              key={g.value}
              pressed={draft.secondaryGoal === g.value}
              onClick={() => set({ secondaryGoal: draft.secondaryGoal === g.value ? undefined : (g.value as PrimaryGoal) })}
              className="justify-start"
            >
              {g.label}
            </ToggleChip>
          ))}
        </div>
      </FieldGroup>
    </div>
  )
}

function ScheduleStep({ draft, set }: StepProps) {
  const count = draft.trainingDays.length
  return (
    <div className="space-y-6">
      <FieldGroup legend="Which days can you train?">
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <ToggleChip key={d.value} pressed={draft.trainingDays.includes(d.value)} aria-label={d.long} onClick={() => set({ trainingDays: toggleInArray(draft.trainingDays, d.value).sort((a, b) => a - b) })}>
              {d.label}
            </ToggleChip>
          ))}
        </div>
        <p className="text-xs text-faint mt-2" role="status">
          {count === 0 && 'Pick at least one day.'}
          {count > 6 && 'Keep a rest day: pick six at most.'}
          {count >= 1 && count <= 6 && `${count} day${count === 1 ? '' : 's'} a week. Rest days are part of the plan.`}
        </p>
      </FieldGroup>
      <label className="block">
        <span className="label-eyebrow block text-ink mb-2">Typical session length: {draft.sessionLengthMinutes} min</span>
        <input
          type="range"
          min={15}
          max={90}
          step={5}
          value={draft.sessionLengthMinutes}
          onChange={(e) => set({ sessionLengthMinutes: Number(e.target.value) })}
          className="w-full accent-accent"
        />
      </label>
    </div>
  )
}

function EquipmentStep({ draft, set }: StepProps) {
  return (
    <FieldGroup legend="Pick everything you can use">
      <div className="flex flex-col gap-3">
        {EQUIPMENT_OPTIONS.map((o) => (
          <ToggleChip key={o.value} pressed={draft.equipment.includes(o.value)} onClick={() => set({ equipment: toggleInArray(draft.equipment, o.value) })} className="justify-start">
            {o.label}
          </ToggleChip>
        ))}
      </div>
    </FieldGroup>
  )
}

function PreferencesStep({ draft, set }: StepProps) {
  return (
    <>
      <p className="text-xs text-faint mb-4">We lean towards these where they fit your kit and level.</p>
      <FieldGroup legend="Tick any you like">
        <div className="flex flex-wrap gap-2">
          {PREFERENCE_OPTIONS.map((o) => (
            <ToggleChip key={o.value} pressed={draft.trainingPreferences.includes(o.value)} onClick={() => set({ trainingPreferences: toggleInArray(draft.trainingPreferences, o.value) })}>
              {o.label}
            </ToggleChip>
          ))}
        </div>
      </FieldGroup>
    </>
  )
}

function HealthStep({ draft, set }: StepProps) {
  return (
    <div className="space-y-6">
      <FieldGroup legend="Areas that give you trouble">
        <div className="flex flex-wrap gap-2">
          {INJURY_AREA_OPTIONS.map((o) => (
            <ToggleChip key={o.value} pressed={draft.injuryAreas.includes(o.value)} onClick={() => set({ injuryAreas: toggleInArray(draft.injuryAreas, o.value) })}>
              {o.label}
            </ToggleChip>
          ))}
        </div>
        <p className="text-xs text-faint mt-2">Movements that commonly aggravate these are left out of your plan.</p>
      </FieldGroup>
      <TextArea label="Anything else to keep in mind (optional)" value={draft.injuriesNote} onChange={(e) => set({ injuriesNote: e.target.value })} maxLength={500} hint="For example “old ankle sprain”. If you write “no deadlifts” or similar, we’ll leave those out too." />
      <TextArea label="Anything you’d rather not do (optional)" value={draft.exclusions} onChange={(e) => set({ exclusions: e.target.value })} maxLength={500} hint="For example “no burpees, no running”." />
      <p className="text-sm">StepUp isn’t a medical device and this isn’t medical advice. For injury-specific programming, check with a professional.</p>
    </div>
  )
}

function ReadinessStep({ draft, set }: StepProps) {
  const gentle = needsGentleStart(draft)
  return (
    <div className="space-y-5">
      <p className="text-sm text-faint">Five quick questions, optional, and never stored once your plan is built. Answer as honestly as you like.</p>
      {READINESS_QUESTIONS.map((q) => (
        <div key={q.id}>
          <p id={`q-${q.id}`} className="text-sm font-semibold mb-2">
            {q.text}
          </p>
          <SegmentedControl
            label={q.text}
            options={[
              { value: 'no' as YesNo, label: 'No' },
              { value: 'yes' as YesNo, label: 'Yes' },
            ]}
            value={draft.readiness[q.id]}
            onChange={(v) => set({ readiness: { ...draft.readiness, [q.id]: v } })}
          />
        </div>
      ))}
      {gentle && (
        <Card className="bg-accent-soft">
          <p className="font-semibold text-sm mb-1">Thanks for telling us.</p>
          <p className="text-sm">
            We’ll start gently: fewer sets, easier movements and no heavy barbell work. It’s a good idea to check in with a doctor or physiotherapist before you
            build up. StepUp isn’t medical advice.
          </p>
        </Card>
      )}
    </div>
  )
}

function ReviewStep({ draft }: StepProps) {
  return (
    <div>
      <p className="text-sm text-faint mb-4">You can change any of this later in Profile.</p>
      <ul className="space-y-3 text-sm list-disc pl-5">
        {explainPlan(draft).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}

const BODIES: Record<StepId, (p: StepProps) => ReactNode> = {
  name: NameStep,
  basics: BasicsStep,
  level: LevelStep,
  activity: ActivityStep,
  goals: GoalsStep,
  schedule: ScheduleStep,
  equipment: EquipmentStep,
  preferences: PreferencesStep,
  health: HealthStep,
  readiness: ReadinessStep,
  review: ReviewStep,
}

export function StepBody({ step, draft, set }: StepProps & { step: StepId }) {
  const Body = BODIES[step]
  return <Body draft={draft} set={set} />
}
