import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Button, Chip, StepProgress, TextField } from '../components/ui'
import { db } from '../db/schema'
import { generatePlan } from '../lib/plan'
import { track } from '../lib/analytics'
import { AGE_RANGE, BODY_WEIGHT_KG_RANGE, HEIGHT_CM_RANGE, rangeErrorMessage } from '../lib/validation'
import type {
  Equipment,
  FitnessLevel,
  PrimaryGoal,
  Profile,
  Sex,
  TrainingPreference,
} from '../db/types'

const TOTAL_STEPS = 9

const FITNESS_LEVELS: { value: FitnessLevel; label: string }[] = [
  { value: 'new', label: "I'm new to structured workouts" },
  { value: 'regular', label: 'I already work out regularly' },
  { value: 'experienced', label: "I've trained consistently for a while" },
]

const GOALS: { value: PrimaryGoal; label: string }[] = [
  { value: 'build-muscle', label: 'Build muscle' },
  { value: 'lift-heavier', label: 'Lift heavier over time' },
  { value: 'lean-out', label: 'Lean out while keeping muscle' },
  { value: 'go-longer', label: 'Go longer without fading' },
  { value: 'feel-better', label: 'Feel better across the board' },
]

const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: 'none', label: 'No equipment / Bodyweight only' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'bands', label: 'Resistance bands' },
  { value: 'bench-rack', label: 'Bench/bar/rack at home' },
  { value: 'full-gym', label: 'Full gym (machines/racks/the lot)' },
]

const PREFERENCE_OPTIONS: { value: TrainingPreference; label: string }[] = [
  { value: 'barbell', label: 'Barbell work' },
  { value: 'dumbbell', label: 'Dumbbell work' },
  { value: 'bodyweight', label: 'Bodyweight training' },
  { value: 'machines', label: 'Machines' },
  { value: 'conditioning', label: 'Conditioning / cardio' },
  { value: 'mobility', label: 'Mobility & stretching' },
]

interface DraftProfile {
  name: string
  age?: number
  sex?: Sex
  heightCm?: number
  startingWeightKg?: number
  fitnessLevel?: FitnessLevel
  liftsAlready: boolean
  doesCardioAlready: boolean
  primaryGoal?: PrimaryGoal
  secondaryGoal?: PrimaryGoal
  daysPerWeek: number
  sessionLengthMinutes: number
  equipment: Equipment[]
  trainingPreferences: TrainingPreference[]
  exclusions: string
  injuries: string
}

const INITIAL_DRAFT: DraftProfile = {
  name: '',
  liftsAlready: false,
  doesCardioAlready: false,
  daysPerWeek: 3,
  sessionLengthMinutes: 45,
  equipment: [],
  trainingPreferences: [],
  exclusions: '',
  injuries: '',
}

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<DraftProfile>(INITIAL_DRAFT)
  const [submitting, setSubmitting] = useState(false)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      track('onboarding_started')
    }
  }, [])

  const ageError = rangeErrorMessage(String(draft.age ?? ''), AGE_RANGE, 'years')
  const heightError = rangeErrorMessage(String(draft.heightCm ?? ''), HEIGHT_CM_RANGE, 'cm')
  const weightError = rangeErrorMessage(
    String(draft.startingWeightKg ?? ''),
    BODY_WEIGHT_KG_RANGE,
    'kg',
  )

  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return draft.name.trim().length > 0
      case 2:
        return !ageError && !heightError && !weightError
      case 3:
        return draft.fitnessLevel !== undefined
      case 5:
        return draft.primaryGoal !== undefined
      case 7:
        return draft.equipment.length > 0
      default:
        return true
    }
  }

  async function handleNext() {
    if (!canAdvance()) return
    await track('onboarding_step_completed', { step })
    if (step === TOTAL_STEPS) {
      await finishOnboarding()
    } else {
      setStep((s) => s + 1)
    }
  }

  async function finishOnboarding() {
    setSubmitting(true)
    const profile: Profile = {
      name: draft.name.trim(),
      age: draft.age,
      sex: draft.sex,
      heightCm: draft.heightCm,
      startingWeightKg: draft.startingWeightKg,
      fitnessLevel: draft.fitnessLevel ?? 'new',
      liftsAlready: draft.liftsAlready,
      doesCardioAlready: draft.doesCardioAlready,
      primaryGoal: draft.primaryGoal ?? 'feel-better',
      secondaryGoal: draft.secondaryGoal,
      daysPerWeek: draft.daysPerWeek,
      sessionLengthMinutes: draft.sessionLengthMinutes,
      equipment: draft.equipment,
      trainingPreferences: draft.trainingPreferences,
      exclusions: draft.exclusions.trim() || undefined,
      injuries: draft.injuries.trim() || undefined,
      weightUnit: 'kg',
      appearance: 'system',
      onboardingCompleted: true,
      createdAt: Date.now(),
    }

    await db.profile.add(profile)
    const plan = generatePlan(profile)
    await db.plans.add(plan)
    await track('onboarding_completed')

    navigate('/plan-ready')
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        {step > 1 && (
          <button
            aria-label="Previous step"
            onClick={() => setStep((s) => s - 1)}
            className="min-h-12 min-w-12 flex items-center justify-center rounded-lg border border-line hover:bg-surface"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <StepProgress step={step} total={TOTAL_STEPS} />
      </div>

      <div className="flex-1">
        {step === 1 && (
          <StepBlock title="What should we call you?">
            <TextField
              label="Name"
              hint="Used for your progress chart, nothing else. This never changes which exercises you get."
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              autoFocus
            />
          </StepBlock>
        )}

        {step === 2 && (
          <StepBlock title="A few basics">
            <p className="text-xs text-faint mb-4">
              Used to size your starting program. Stays on this device, like
              everything else.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <TextField
                label="Age"
                type="number"
                inputMode="numeric"
                min={AGE_RANGE.min}
                max={AGE_RANGE.max}
                error={ageError}
                value={draft.age ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    age: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
              <div>
                <span className="label-eyebrow block text-faint mb-2">Sex</span>
                <div className="flex gap-2 flex-wrap">
                  {(['female', 'male', 'unspecified'] as Sex[]).map((s) => (
                    <Chip
                      key={s}
                      active={draft.sex === s}
                      onClick={() => setDraft((d) => ({ ...d, sex: s }))}
                    >
                      {s === 'unspecified' ? 'Prefer not to say' : s}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Height (cm)"
                type="number"
                inputMode="numeric"
                min={HEIGHT_CM_RANGE.min}
                max={HEIGHT_CM_RANGE.max}
                error={heightError}
                value={draft.heightCm ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    heightCm: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
              <TextField
                label="Starting weight (kg)"
                type="number"
                inputMode="decimal"
                min={BODY_WEIGHT_KG_RANGE.min}
                max={BODY_WEIGHT_KG_RANGE.max}
                error={weightError}
                value={draft.startingWeightKg ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    startingWeightKg: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </div>
          </StepBlock>
        )}

        {step === 3 && (
          <StepBlock title="How would you describe where you're starting from?">
            <div className="flex flex-col gap-3">
              {FITNESS_LEVELS.map((opt) => (
                <Chip
                  key={opt.value}
                  active={draft.fitnessLevel === opt.value}
                  onClick={() => setDraft((d) => ({ ...d, fitnessLevel: opt.value }))}
                  className="justify-start! text-left px-5"
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
          </StepBlock>
        )}

        {step === 4 && (
          <StepBlock title="What are you already doing?">
            <div className="flex flex-col gap-3">
              <Chip
                active={draft.liftsAlready}
                onClick={() => setDraft((d) => ({ ...d, liftsAlready: !d.liftsAlready }))}
                className="justify-start! text-left px-5"
              >
                I already lift weights
              </Chip>
              <Chip
                active={draft.doesCardioAlready}
                onClick={() =>
                  setDraft((d) => ({ ...d, doesCardioAlready: !d.doesCardioAlready }))
                }
                className="justify-start! text-left px-5"
              >
                I already do cardio
              </Chip>
            </div>
          </StepBlock>
        )}

        {step === 5 && (
          <StepBlock title="What matters most right now?">
            <p className="label-eyebrow text-faint mb-3">Primary goal</p>
            <div className="flex flex-col gap-3 mb-6">
              {GOALS.map((opt) => (
                <Chip
                  key={opt.value}
                  active={draft.primaryGoal === opt.value}
                  onClick={() => setDraft((d) => ({ ...d, primaryGoal: opt.value }))}
                  className="justify-start! text-left px-5"
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
            <p className="label-eyebrow text-faint mb-3">Secondary goal (optional)</p>
            <div className="flex flex-col gap-3">
              {GOALS.filter((g) => g.value !== draft.primaryGoal).map((opt) => (
                <Chip
                  key={opt.value}
                  active={draft.secondaryGoal === opt.value}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      secondaryGoal: d.secondaryGoal === opt.value ? undefined : opt.value,
                    }))
                  }
                  className="justify-start! text-left px-5"
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
          </StepBlock>
        )}

        {step === 6 && (
          <StepBlock title="How much time do you realistically have?">
            <div className="mb-6">
              <span className="label-eyebrow block text-faint mb-2">
                Days per week: {draft.daysPerWeek}
              </span>
              <input
                type="range"
                aria-label="Days per week"
                min={1}
                max={6}
                value={draft.daysPerWeek}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, daysPerWeek: Number(e.target.value) }))
                }
                className="w-full accent-accent"
              />
            </div>
            <div>
              <span className="label-eyebrow block text-faint mb-2">
                Typical session length: {draft.sessionLengthMinutes} min
              </span>
              <input
                type="range"
                aria-label="Typical session length in minutes"
                min={15}
                max={90}
                step={5}
                value={draft.sessionLengthMinutes}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, sessionLengthMinutes: Number(e.target.value) }))
                }
                className="w-full accent-accent"
              />
            </div>
          </StepBlock>
        )}

        {step === 7 && (
          <StepBlock title="What do you have access to?">
            <div className="flex flex-col gap-3">
              {EQUIPMENT_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  active={draft.equipment.includes(opt.value)}
                  onClick={() =>
                    setDraft((d) => ({ ...d, equipment: toggleInArray(d.equipment, opt.value) }))
                  }
                  className="justify-start! text-left px-5"
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
          </StepBlock>
        )}

        {step === 8 && (
          <StepBlock title="Anything you enjoy?">
            <p className="text-xs text-faint mb-4">
              We lean towards these where the plan allows.
            </p>
            <div className="flex flex-wrap gap-2">
              {PREFERENCE_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  active={draft.trainingPreferences.includes(opt.value)}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      trainingPreferences: toggleInArray(d.trainingPreferences, opt.value),
                    }))
                  }
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
          </StepBlock>
        )}

        {step === 9 && (
          <StepBlock title="Anything to work around?">
            <div className="flex flex-col gap-4">
              <label className="block">
                <span className="label-eyebrow block text-faint mb-2">
                  Anything you'd rather not do
                </span>
                <textarea
                  className="w-full rounded-lg border border-line bg-elevated px-4 py-3 text-ink min-h-24 focus:outline-2 focus:outline-accent"
                  value={draft.exclusions}
                  onChange={(e) => setDraft((d) => ({ ...d, exclusions: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="block text-sm font-semibold text-ink mb-2">
                  Injuries or anything else we should work around — we'll
                  leave these out of your plan entirely.
                </span>
                <textarea
                  className="w-full rounded-lg border border-line bg-elevated px-4 py-3 text-ink min-h-24 focus:outline-2 focus:outline-accent"
                  value={draft.injuries}
                  onChange={(e) => setDraft((d) => ({ ...d, injuries: e.target.value }))}
                />
              </label>
              <p className="text-xs text-faint">
                StepUp isn't a medical device and this isn't medical advice —
                for injury-specific programming, check with a professional.
              </p>
            </div>
          </StepBlock>
        )}
      </div>

      <Button
        className="w-full mt-8"
        disabled={!canAdvance() || submitting}
        onClick={handleNext}
      >
        {step === TOTAL_STEPS ? "Build my plan" : 'Continue'}
      </Button>
    </div>
  )
}

function StepBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="font-display font-semibold text-2xl md:text-3xl mb-6">{title}</h1>
      {children}
    </div>
  )
}
