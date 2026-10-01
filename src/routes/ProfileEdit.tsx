import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { getExerciseById } from '../db/exerciseLibrary'
import { generatePlan, trainingDayIndices } from '../lib/plan'
import {
  EQUIPMENT_OPTIONS,
  FITNESS_LEVELS,
  GOALS,
  INJURY_AREA_OPTIONS,
  PREFERENCE_OPTIONS,
  WEEKDAYS,
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

const sameList = (a: unknown[] | undefined, b: unknown[] | undefined) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort())

function ProfileEditForm({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [draft, setDraft] = useState<Profile>(profile)
  const [showRebuildChoice, setShowRebuildChoice] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const days = trainingDayIndices(draft)
  const planAffectingChanged =
    !sameList(draft.equipment, profile.equipment) ||
    !sameList(trainingDayIndices(draft), trainingDayIndices(profile)) ||
    !sameList(draft.injuryAreas, profile.injuryAreas) ||
    !sameList(draft.avoidedExerciseIds, profile.avoidedExerciseIds) ||
    !sameList(draft.trainingPreferences, profile.trainingPreferences) ||
    draft.primaryGoal !== profile.primaryGoal ||
    draft.secondaryGoal !== profile.secondaryGoal ||
    draft.fitnessLevel !== profile.fitnessLevel ||
    draft.sessionLengthMinutes !== profile.sessionLengthMinutes ||
    (draft.exclusions ?? '') !== (profile.exclusions ?? '') ||
    (draft.injuries ?? '') !== (profile.injuries ?? '') ||
    Boolean(draft.gentleStart) !== Boolean(profile.gentleStart)

  function toggleDay(day: number) {
    const picked = toggleInArray(trainingDayIndices(draft), day).sort((a, b) => a - b)
    if (picked.length === 0 || picked.length > 6) return // at least one day, and always a rest day
    setDraft({ ...draft, trainingDays: picked, daysPerWeek: picked.length })
  }

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

        <FieldGroup legend="Training days">
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <ToggleChip key={d.value} pressed={days.includes(d.value)} aria-label={d.long} onClick={() => toggleDay(d.value)}>
                {d.label}
              </ToggleChip>
            ))}
          </div>
          <p className="text-xs text-faint mt-2" role="status">
            {days.length} day{days.length === 1 ? '' : 's'} a week.
          </p>
        </FieldGroup>

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
                onClick={() => setDraft({ ...draft, trainingPreferences: toggleInArray(draft.trainingPreferences, opt.value) })}
              >
                {opt.short}
              </ToggleChip>
            ))}
          </div>
        </FieldGroup>

        <FieldGroup legend="Areas that give you trouble">
          <div className="flex flex-wrap gap-2">
            {INJURY_AREA_OPTIONS.map((opt) => (
              <ToggleChip
                key={opt.value}
                pressed={(draft.injuryAreas ?? []).includes(opt.value)}
                onClick={() => setDraft({ ...draft, injuryAreas: toggleInArray(draft.injuryAreas ?? [], opt.value) })}
              >
                {opt.label}
              </ToggleChip>
            ))}
          </div>
          <p className="text-xs text-faint mt-2">Movements that commonly aggravate these are left out when your plan is built.</p>
        </FieldGroup>

        <TextArea label="Anything you’d rather not do" value={draft.exclusions ?? ''} onChange={(e) => setDraft({ ...draft, exclusions: e.target.value })} hint="For example “no burpees, no running”." />
        <TextArea label="Other injuries or notes" value={draft.injuries ?? ''} onChange={(e) => setDraft({ ...draft, injuries: e.target.value })} />

        <FieldGroup legend="Pace">
          <ToggleChip pressed={Boolean(draft.gentleStart)} onClick={() => setDraft({ ...draft, gentleStart: !draft.gentleStart })}>
            Keep my plan gentle (fewer sets, no heavy barbell work)
          </ToggleChip>
        </FieldGroup>

        {(draft.avoidedExerciseIds?.length ?? 0) > 0 && (
          <FieldGroup legend="Exercises you asked not to see">
            <ul className="space-y-2">
              {draft.avoidedExerciseIds!.map((id) => (
                <li key={id} className="flex items-center justify-between text-sm">
                  <span>{getExerciseById(id)?.name ?? id}</span>
                  <button
                    className="min-h-11 px-2 font-semibold text-accent"
                    aria-label={`Allow ${getExerciseById(id)?.name ?? id} again`}
                    onClick={() => setDraft({ ...draft, avoidedExerciseIds: draft.avoidedExerciseIds!.filter((x) => x !== id) })}
                  >
                    Allow again
                  </button>
                </li>
              ))}
            </ul>
          </FieldGroup>
        )}
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
          These changes affect what your plan can include. Rebuild it to match, or keep your current plan as-is. Your weights and history are kept either way.
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
