import { useMemo, useState } from 'react'
import { Dialog } from '../../components/overlays'
import { Button, TextField } from '../../components/ui'
import { FieldGroup, Select, ToggleChip } from '../../components/forms'
import { addOptions } from '../../lib/planEdit'
import { CUSTOM_PATTERNS, createCustomExercise, validateCustomName } from '../../lib/customExercises'
import { EQUIPMENT_OPTIONS, toggleInArray } from '../../lib/options'
import type { Equipment, Exercise, MovementPattern, PlanSession, Profile, TrackingType } from '../../db/types'

const TRACKING: { value: TrackingType; label: string }[] = [
  { value: 'weight-reps', label: 'Weight and reps' },
  { value: 'bodyweight-reps', label: 'Reps only' },
  { value: 'duration', label: 'Time (seconds)' },
  { value: 'distance-time', label: 'Minutes and distance' },
]

function CreateForm({ onCreated, onBack }: { onCreated: (e: Exercise) => void; onBack: () => void }) {
  const [name, setName] = useState('')
  const [pattern, setPattern] = useState<MovementPattern>('press')
  const [equipment, setEquipment] = useState<Equipment[]>(['none'])
  const [tracking, setTracking] = useState<TrackingType>('weight-reps')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const error = touched ? validateCustomName(name) : null

  async function save() {
    setTouched(true)
    if (validateCustomName(name) || saving) return
    setSaving(true)
    try {
      onCreated(await createCustomExercise({ name, movementPattern: pattern, equipment, trackingType: tracking }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} error={error} maxLength={60} />
      <Select
        label="Type of movement"
        value={pattern}
        onChange={(e) => setPattern(e.target.value as MovementPattern)}
        options={CUSTOM_PATTERNS.map((p) => ({ value: p.value, label: p.label }))}
      />
      <FieldGroup legend="Kit it needs">
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map((o) => (
            <ToggleChip key={o.value} pressed={equipment.includes(o.value)} onClick={() => setEquipment((eq) => toggleInArray(eq, o.value))}>
              {o.short}
            </ToggleChip>
          ))}
        </div>
      </FieldGroup>
      <Select
        label="What you log"
        value={tracking}
        onChange={(e) => setTracking(e.target.value as TrackingType)}
        options={TRACKING.map((t) => ({ value: t.value, label: t.label }))}
      />
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-1" onClick={save} loading={saving}>
          Create and add
        </Button>
      </div>
    </div>
  )
}

/** Pick any exercise that is safe and available for this person, or make their own. */
export function AddExerciseDialog({
  open,
  session,
  profile,
  onClose,
  onAdd,
}: {
  open: boolean
  session: PlanSession | undefined
  profile: Profile
  onClose: () => void
  onAdd: (exerciseId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [pattern, setPattern] = useState<'all' | MovementPattern>('all')
  const [creating, setCreating] = useState(false)

  const options = useMemo(() => {
    if (!session) return []
    const q = query.trim().toLowerCase()
    return addOptions(session, profile)
      .filter((e) => (pattern === 'all' || e.movementPattern === pattern) && (!q || e.name.toLowerCase().includes(q)))
      .slice(0, 40)
  }, [session, profile, query, pattern])

  function close() {
    setCreating(false)
    setQuery('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={close} title={creating ? 'Create your own exercise' : 'Add an exercise'}>
      {creating ? (
        <CreateForm
          onBack={() => setCreating(false)}
          onCreated={(e) => {
            onAdd(e.id)
            close()
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <TextField label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Select
              label="Type"
              value={pattern}
              onChange={(e) => setPattern(e.target.value as 'all' | MovementPattern)}
              options={[{ value: 'all', label: 'All' }, ...CUSTOM_PATTERNS]}
            />
          </div>
          <ul className="max-h-64 overflow-y-auto space-y-2 mb-3" aria-label="Exercises you can add">
            {options.length === 0 ? (
              <li className="text-sm text-faint py-2">Nothing matches. Try another search, or create your own.</li>
            ) : (
              options.map((e) => (
                <li key={e.id}>
                  <button
                    className="w-full text-left rounded-lg border border-line px-4 py-3 min-h-12 hover:bg-surface bg-elevated"
                    onClick={() => {
                      onAdd(e.id)
                      close()
                    }}
                  >
                    <span className="font-semibold">{e.name}</span>
                    <span className="block text-xs text-faint">{e.primaryMuscles.join(', ') || e.movementPattern}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setCreating(true)}>
              Create your own
            </Button>
            <Button variant="ghost" className="flex-1" onClick={close}>
              Close
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )
}
