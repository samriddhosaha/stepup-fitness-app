import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { generatePlan } from '../lib/plan'
import { Button, Card, Chip, PageSkeleton, TextField } from '../components/ui'
import type { Equipment, FitnessLevel, PrimaryGoal, Profile, TrainingPreference } from '../db/types'

const FITNESS_LEVELS: { value: FitnessLevel; label: string }[] = [
  { value: 'new', label: 'New to structured workouts' },
  { value: 'regular', label: 'Work out regularly' },
  { value: 'experienced', label: 'Trained consistently for a while' },
]
const GOALS: { value: PrimaryGoal; label: string }[] = [
  { value: 'build-muscle', label: 'Build muscle' },
  { value: 'lift-heavier', label: 'Lift heavier over time' },
  { value: 'lean-out', label: 'Lean out while keeping muscle' },
  { value: 'go-longer', label: 'Go longer without fading' },
  { value: 'feel-better', label: 'Feel better across the board' },
]
const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: 'none', label: 'No equipment' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'bands', label: 'Bands' },
  { value: 'bench-rack', label: 'Bench/bar/rack' },
  { value: 'full-gym', label: 'Full gym' },
]
const PREFERENCE_OPTIONS: { value: TrainingPreference; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'machines', label: 'Machines' },
  { value: 'conditioning', label: 'Conditioning' },
  { value: 'mobility', label: 'Mobility' },
]

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

export default function ProfileEdit() {
  const profile = useLiveQuery(() => db.profile.orderBy('createdAt').last())
  if (!profile) return <PageSkeleton />
  // keyed so the editable draft starts from the loaded profile without syncing state in an effect
  return <ProfileEditForm key={profile.id} profile={profile} />
}

function ProfileEditForm({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Profile>(profile)
  const [showRebuildChoice, setShowRebuildChoice] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const currentDraft = draft

  const planAffectingChanged =
    JSON.stringify(currentDraft.equipment) !== JSON.stringify(profile.equipment) ||
    currentDraft.daysPerWeek !== profile.daysPerWeek ||
    currentDraft.primaryGoal !== profile.primaryGoal ||
    currentDraft.secondaryGoal !== profile.secondaryGoal ||
    currentDraft.fitnessLevel !== profile.fitnessLevel

  async function saveProfile(rebuild: boolean) {
    if (!currentDraft.id || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      // Profile and (optional) new plan are saved together or not at all.
      await db.transaction('rw', db.profile, db.plans, async () => {
        await db.profile.put(currentDraft)
        if (rebuild) await db.plans.add(generatePlan(currentDraft))
      })
      navigate('/profile')
    } catch {
      setSaveError('We couldn’t save those changes. Nothing was lost; please try again.')
      setSaving(false)
    }
  }

  async function handleSaveClick() {
    if (planAffectingChanged) {
      setShowRebuildChoice(true)
    } else {
      await saveProfile(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <h1 className="font-display font-semibold text-2xl md:text-3xl mb-6">Edit preferences</h1>

      <div className="flex-1 space-y-6 overflow-y-auto">
        <TextField
          label="Name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />

        <div>
          <p className="label-eyebrow text-faint mb-2">Fitness level</p>
          <div className="flex flex-col gap-2">
            {FITNESS_LEVELS.map((opt) => (
              <Chip
                key={opt.value}
                active={draft.fitnessLevel === opt.value}
                onClick={() => setDraft({ ...draft, fitnessLevel: opt.value })}
                className="justify-start! text-left px-5"
              >
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="label-eyebrow text-faint mb-2">Primary goal</p>
          <div className="flex flex-col gap-2">
            {GOALS.map((opt) => (
              <Chip
                key={opt.value}
                active={draft.primaryGoal === opt.value}
                onClick={() => setDraft({ ...draft, primaryGoal: opt.value })}
                className="justify-start! text-left px-5"
              >
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="label-eyebrow text-faint mb-2">Days per week: {draft.daysPerWeek}</p>
          <input
            type="range"
            aria-label="Days per week"
            min={1}
            max={6}
            value={draft.daysPerWeek}
            onChange={(e) => setDraft({ ...draft, daysPerWeek: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>

        <div>
          <p className="label-eyebrow text-faint mb-2">Session length: {draft.sessionLengthMinutes} min</p>
          <input
            type="range"
            aria-label="Session length in minutes"
            min={15}
            max={90}
            step={5}
            value={draft.sessionLengthMinutes}
            onChange={(e) => setDraft({ ...draft, sessionLengthMinutes: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>

        <div>
          <p className="label-eyebrow text-faint mb-2">Equipment</p>
          <div className="flex flex-col gap-2">
            {EQUIPMENT_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                active={draft.equipment.includes(opt.value)}
                onClick={() =>
                  setDraft({ ...draft, equipment: toggleInArray(draft.equipment, opt.value) })
                }
                className="justify-start! text-left px-5"
              >
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="label-eyebrow text-faint mb-2">Training preferences</p>
          <div className="flex flex-wrap gap-2">
            {PREFERENCE_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                active={draft.trainingPreferences.includes(opt.value)}
                onClick={() =>
                  setDraft({
                    ...draft,
                    trainingPreferences: toggleInArray(draft.trainingPreferences, opt.value),
                  })
                }
              >
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="label-eyebrow block text-faint mb-2">Exclusions</span>
          <textarea
            className="w-full rounded-lg border border-line bg-elevated px-4 py-3 min-h-20"
            value={draft.exclusions ?? ''}
            onChange={(e) => setDraft({ ...draft, exclusions: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label-eyebrow block text-faint mb-2">Injuries</span>
          <textarea
            className="w-full rounded-lg border border-line bg-elevated px-4 py-3 min-h-20"
            value={draft.injuries ?? ''}
            onChange={(e) => setDraft({ ...draft, injuries: e.target.value })}
          />
        </label>
      </div>

      {showRebuildChoice ? (
        <Card className="mt-4">
          <p className="font-semibold mb-2">Update your plan too?</p>
          <p className="text-sm text-faint mb-4">
            These changes affect what your plan can include. Rebuild it to
            match, or keep your current plan as-is.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => saveProfile(false)}>
              Keep current plan
            </Button>
            <Button className="flex-1" onClick={() => saveProfile(true)}>
              Rebuild plan
            </Button>
          </div>
        </Card>
      ) : (
        <Button className="w-full mt-6" onClick={handleSaveClick} disabled={saving}>
          Save
        </Button>
      )}
      {saveError && (
        <p role="alert" className="text-sm font-semibold text-danger mt-4">
          {saveError}
        </p>
      )}
    </div>
  )
}
