import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FieldGroup, SegmentedControl } from '../../components/forms'
import { Card } from '../../components/ui'
import { db } from '../../db/schema'
import type { CheckIn } from '../../db/types'
import { SLEEP_CHOICES, readinessFor } from '../../lib/health'
import { saveCheckIn } from '../../lib/healthStore'
import { useTodayISO } from '../../lib/useToday'

type Answers = Partial<Pick<CheckIn, 'sleepHours' | 'soreness' | 'energy'>>

const SLEEP = SLEEP_CHOICES.map((c) => ({ value: String(c.hours), label: c.label }))
const SORENESS = [
  { value: '1', label: 'Fresh' },
  { value: '2', label: 'A bit sore' },
  { value: '3', label: 'Very sore' },
]
const ENERGY = [
  { value: '1', label: 'Low' },
  { value: '2', label: 'OK' },
  { value: '3', label: 'High' },
]

function CheckInForm({ initial }: { initial: Answers }) {
  const [draft, setDraft] = useState<Answers>(initial)

  async function answer(patch: Answers) {
    const next = { ...draft, ...patch }
    setDraft(next)
    // The third answer completes the check-in and saves it — no Save button.
    if (next.sleepHours !== undefined && next.soreness !== undefined && next.energy !== undefined) {
      await saveCheckIn({ sleepHours: next.sleepHours, soreness: next.soreness, energy: next.energy })
    }
  }

  return (
    <div className="space-y-4">
      <FieldGroup legend="Sleep last night">
        <SegmentedControl
          label="Sleep last night"
          options={SLEEP}
          value={draft.sleepHours === undefined ? undefined : String(draft.sleepHours)}
          onChange={(v) => answer({ sleepHours: Number(v) })}
        />
      </FieldGroup>
      <FieldGroup legend="Soreness">
        <SegmentedControl
          label="Soreness"
          options={SORENESS}
          value={draft.soreness === undefined ? undefined : String(draft.soreness)}
          onChange={(v) => answer({ soreness: Number(v) as CheckIn['soreness'] })}
        />
      </FieldGroup>
      <FieldGroup legend="Energy">
        <SegmentedControl
          label="Energy"
          options={ENERGY}
          value={draft.energy === undefined ? undefined : String(draft.energy)}
          onChange={(v) => answer({ energy: Number(v) as CheckIn['energy'] })}
        />
      </FieldGroup>
    </div>
  )
}

/**
 * The daily recovery check-in: sleep, soreness, energy — three taps. Saves on the third answer
 * and turns it into a plain-language readiness hint. `home` hides the form behind a "Change"
 * button once today's is done.
 */
export function CheckInCard({ variant = 'log' }: { variant?: 'log' | 'home' }) {
  const today = useTodayISO()
  const state = useLiveQuery(
    async () => ({ checkIn: (await db.checkIns.where('date').equals(today).first()) ?? null }),
    [today],
  )
  const [editing, setEditing] = useState(false)

  if (!state) return null
  const { checkIn } = state
  const readiness = checkIn ? readinessFor(checkIn) : null
  const showForm = !checkIn || editing || variant === 'log'

  return (
    <Card className={readiness && variant === 'home' && !editing ? 'bg-accent-soft' : ''}>
      <h2 className="label-eyebrow text-faint mb-3">{checkIn ? 'Today’s readiness' : 'Daily check-in · 3 taps'}</h2>

      {readiness && (
        <div className="mb-4" data-testid="readiness" role="status">
          <p className="font-display font-bold text-xl">{readiness.headline}</p>
          <p className="text-sm text-faint mt-1">{readiness.detail}</p>
        </div>
      )}

      {showForm ? (
        // Keyed so reopening the editor starts from what was saved.
        <CheckInForm
          key={checkIn?.id ?? 'new'}
          initial={checkIn ? { sleepHours: checkIn.sleepHours, soreness: checkIn.soreness, energy: checkIn.energy } : {}}
        />
      ) : (
        <button
          type="button"
          className="text-sm font-semibold text-accent min-h-11 underline underline-offset-2"
          onClick={() => setEditing(true)}
        >
          Change my answers
        </button>
      )}
      {!checkIn && <p className="text-xs text-faint mt-3">Just a nudge for how hard to push today — never a rule.</p>}
    </Card>
  )
}
