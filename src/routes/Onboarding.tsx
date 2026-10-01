import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Button, PageSkeleton, StepProgress } from '../components/ui'
import { db } from '../db/schema'
import { generatePlan } from '../lib/plan'
import { track } from '../lib/analytics'
import { AGE_GATE } from '../lib/validation'
import { StepBody } from '../features/onboarding/steps'
import {
  INITIAL_DRAFT,
  STEPS,
  STEP_TITLES,
  clearDraft,
  loadDraft,
  saveDraft,
  stepValid,
  toProfile,
  type OnboardingDraft,
  type OnboardingMode,
} from '../features/onboarding/draft'

export default function Onboarding() {
  const [params] = useSearchParams()
  // restore a draft (refresh, or coming back later) before showing anything
  const [restored, setRestored] = useState<{ draft: OnboardingDraft; step: number; mode: OnboardingMode } | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    void loadDraft().then((saved) => {
      if (!cancelled) setRestored(saved ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (restored === undefined) return <PageSkeleton label="Loading" />
  const wantsQuick = params.get('mode') === 'quick'
  return (
    <OnboardingFlow
      initialMode={restored?.mode ?? (wantsQuick ? 'quick' : 'full')}
      initialDraft={restored?.draft ?? INITIAL_DRAFT}
      initialStep={restored?.step ?? 0}
    />
  )
}

function OnboardingFlow({ initialMode, initialDraft, initialStep }: { initialMode: OnboardingMode; initialDraft: OnboardingDraft; initialStep: number }) {
  const navigate = useNavigate()
  const mode = initialMode
  const steps = STEPS[mode]
  const [stepIndex, setStepIndex] = useState(initialStep)
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const startedRef = useRef(false)
  const first = useRef(true)

  const step = steps[stepIndex]!
  const isLast = stepIndex === steps.length - 1
  const patch = (p: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...p }))

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      void track('onboarding_started', { mode })
    }
  }, [mode])

  // a refresh keeps your answers and your place
  useEffect(() => {
    void saveDraft({ draft, step: stepIndex, mode })
  }, [draft, stepIndex, mode])

  // moving between steps lands focus on the new question
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    headingRef.current?.focus()
    document.title = `${STEP_TITLES[step]} · StepUp`
  }, [step])

  async function finish() {
    setSubmitting(true)
    setSubmitError(null)
    const profile = toProfile(draft, mode)
    try {
      // Profile and plan are written together: never an onboarded user without a plan.
      await db.transaction('rw', db.profile, db.plans, async () => {
        await db.profile.add(profile)
        await db.plans.add(generatePlan(profile))
      })
      await clearDraft()
      await track('onboarding_completed', { mode })
      navigate('/plan-ready')
    } catch {
      setSubmitError('We couldn’t save your plan. Nothing was lost; please try again.')
      setSubmitting(false)
    }
  }

  async function next() {
    if (!stepValid(step, draft)) return
    void track('onboarding_step_completed', { step })
    if (isLast) await finish()
    else setStepIndex((i) => i + 1)
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        {stepIndex > 0 && (
          <button
            aria-label="Previous step"
            onClick={() => setStepIndex((i) => i - 1)}
            className="min-h-12 min-w-12 flex items-center justify-center rounded-lg border border-line hover:bg-surface"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        )}
        <StepProgress step={stepIndex + 1} total={steps.length} />
      </div>

      <div className="flex-1">
        <h1 ref={headingRef} tabIndex={-1} className="font-display font-semibold text-2xl md:text-3xl mb-6 outline-none">
          {STEP_TITLES[step]}
        </h1>
        <StepBody step={step} draft={draft} set={patch} />
      </div>

      {submitError && (
        <p role="alert" className="text-sm font-semibold text-danger mt-6">
          {submitError}
        </p>
      )}
      {mode === 'quick' && isLast && (
        <p className="text-xs text-faint mt-6">By continuing you confirm you’re {AGE_GATE} or older. You can add the rest of your details later in Profile.</p>
      )}
      <Button className="w-full mt-6" disabled={!stepValid(step, draft)} loading={submitting} onClick={next}>
        {isLast ? 'Build my plan' : 'Continue'}
      </Button>
    </div>
  )
}
