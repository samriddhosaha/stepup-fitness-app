import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { generatePlan } from '../lib/plan'
import {
  EQUIPMENT_OPTIONS,
  FITNESS_LEVELS,
  GOALS,
  PREFERENCE_OPTIONS,
  toggleInArray,
  withLabel,
} from '../lib/options'
import { Button, PageSkeleton, TextField } from '../components/ui'
import { FieldGroup, SegmentedControl, TextArea, ToggleChip } from '../components/forms'
import { Dialog } from '../components/overlays'
import { useToast } from '../components/toastContext'
import type { Profile } from '../db/types'

export default function ProfileEdit() {
  const profile = useLiveQuery(() => db.profile.orderBy('createdAt').last())
  if (!profile) return <PageSkeleton />
  // keyed so the editable draft starts from the loaded profile without syncing state in an effect
  return <ProfileEditForm key={profile.id} profile={profile} />
}

function ProfileEditForm({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [draft, setDraft] = useState<Profile>(profile)
  const [showRebuildChoice, setShowRebuildChoice] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const planAffectingChanged =
    JSON.stringify(draft.equipment) !== JSON.stringify(profile.equipment) ||
    draft.daysPerWeek !== profile.daysPerWeek ||
    draft.primaryGoal !== profile.primaryGoal ||
    draft.secondaryGoal !== profile.secondaryGoal ||
    draft.fitnessLevel !== profile.fitnessLevel

  async function saveProfile(rebuild: boolean) {
    if (!draft.id || saving) return
    setSaving(true)
    setSaveError(null)
    setShowRebuildChoice(false)
    try {
      // Profile and (optional) new plan are saved together or not at all.
      await db.transaction('rw', db.profile, db.plans, async () => {
        await db.profile.put(draft)
        if (rebuild) await db.plans.add(generatePlan(draft))
      })
      toast(rebuild ? 'Preferences saved and plan rebuilt.' : 'Preferences saved.')
      navigate('/profile')
    } catch {
      setSaveError('We couldn’t save those changes. Nothing was lost; please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <h1 className="font-display font-semibold text-2xl md:text-3xl mb-6">Edit preferences</h1>

      <div className="flex-1 space-y-6">
        <TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />

        <FieldGroup legend="Fitness level">
          <SegmentedControl
            label="Fitness level"
            layout="column"
            options={withLabel(FITNESS_LEVELS, 'short')}
            value={draft.fitnessLevel}
            onChange={(fitnessLevel) => setDraft({ ...draft, fitnessLevel })}
          />
        </FieldGroup>

        <FieldGroup legend="Primary goal">
          <SegmentedControl
            label="Primary goal"
            layout="column"
            options={withLabel(GOALS, 'short')}
            value={draft.primaryGoal}
            onChange={(primaryGoal) => setDraft({ ...draft, primaryGoal })}
          />
        </FieldGroup>

        <label className="block">
          <span className="label-eyebrow block text-ink mb-2">Days per week: {draft.daysPerWeek}</span>
          <input
            type="range"
            min={1}
            max={6}
            value={draft.daysPerWeek}
            onChange={(e) => setDraft({ ...draft, daysPerWeek: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </label>

        <label className="block">
          <span className="label-eyebrow block text-ink mb-2">Session length: {draft.sessionLengthMinutes} min</span>
          <input
            type="range"
            min={15}
            max={90}
            step={5}
            value={draft.sessionLengthMinutes}
            onChange={(e) => setDraft({ ...draft, sessionLengthMinutes: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </label>

        <FieldGroup legend="Equipment">
          <div className="flex flex-col gap-2">
            {EQUIPMENT_OPTIONS.map((opt) => (
              <ToggleChip
                key={opt.value}
                pressed={draft.equipment.includes(opt.value)}
                onClick={() => setDraft({ ...draft, equipment: toggleInArray(draft.equipment, opt.value) })}
              >
                {opt.short}
              </ToggleChip>
            ))}
          </div>
        </FieldGroup>

        <FieldGroup legend="Training preferences">
          <div className="flex flex-wrap gap-2">
            {PREFERENCE_OPTIONS.map((opt) => (
              <ToggleChip
                key={opt.value}
                pressed={draft.trainingPreferences.includes(opt.value)}
                onClick={() =>
                  setDraft({ ...draft, trainingPreferences: toggleInArray(draft.trainingPreferences, opt.value) })
                }
              >
                {opt.short}
              </ToggleChip>
            ))}
          </div>
        </FieldGroup>

        <TextArea
          label="Exclusions"
          value={draft.exclusions ?? ''}
          onChange={(e) => setDraft({ ...draft, exclusions: e.target.value })}
        />
        <TextArea
          label="Injuries"
          value={draft.injuries ?? ''}
          onChange={(e) => setDraft({ ...draft, injuries: e.target.value })}
        />
      </div>

      <Button
        className="w-full mt-6"
        loading={saving}
        onClick={() => (planAffectingChanged ? setShowRebuildChoice(true) : saveProfile(false))}
      >
        Save
      </Button>
      {saveError && (
        <p role="alert" className="text-sm font-semibold text-danger mt-4">
          {saveError}
        </p>
      )}

      <Dialog open={showRebuildChoice} onClose={() => setShowRebuildChoice(false)} title="Update your plan too?">
        <p className="text-sm text-faint mb-4">
          These changes affect what your plan can include. Rebuild it to match, or keep your current plan as-is.
        </p>
        <div className="flex flex-col gap-3">
          <Button onClick={() => saveProfile(true)}>Rebuild plan</Button>
          <Button variant="secondary" onClick={() => saveProfile(false)}>
            Keep current plan
          </Button>
          <Button variant="ghost" onClick={() => setShowRebuildChoice(false)}>
            Back to editing
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
