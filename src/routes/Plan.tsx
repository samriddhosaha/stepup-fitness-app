import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { getActivePlan } from '../db/schema'
import { useProfile } from '../db/repo'
import { getExerciseById } from '../db/exerciseLibrary'
import { balancePlan, estimateSessionMinutes, planBalance } from '../lib/plan'
import {
  addToPlan,
  moveInPlan,
  removeFromPlan,
  renameSession,
  saveActivePlan,
  setPrescription,
  swapInPlan,
  swapOptions,
} from '../lib/planEdit'
import { targetLabel } from '../features/workout/setValues'
import { planToIcs } from '../lib/ics'
import { deliverFile } from '../lib/files'
import { AddExerciseDialog } from '../features/plan/AddExerciseDialog'
import { Button, Card, EmptyState, PageSkeleton, TextField } from '../components/ui'
import { NumberField } from '../components/forms'
import { Dialog } from '../components/overlays'
import { useToast } from '../components/toastContext'
import type { Plan as PlanType, PlanExercise, Profile } from '../db/types'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function Adjust({ pe, label, onChange }: { pe: PlanExercise; label: string; onChange: (p: { targetSets?: number; targetRepsLow?: number; targetRepsHigh?: number }) => void }) {
  const [sets, setSets] = useState(String(pe.targetSets))
  const [low, setLow] = useState(String(pe.targetRepsLow))
  const [high, setHigh] = useState(String(pe.targetRepsHigh))
  const ok = Number(sets) >= 1 && Number(sets) <= 10 && Number(low) >= 1 && Number(high) >= Number(low)
  return (
    <div className="grid grid-cols-3 gap-2 mt-2 items-end">
      <NumberField label="Sets" inputMode="numeric" value={sets} onChange={setSets} min={1} max={10} step={1} />
      <NumberField label="From" inputMode="numeric" value={low} onChange={setLow} min={1} step={1} />
      <NumberField label="To" inputMode="numeric" value={high} onChange={setHigh} min={1} step={1} />
      <Button
        className="col-span-3 min-h-11"
        variant="secondary"
        disabled={!ok}
        aria-label={`Save sets and ${label} range`}
        onClick={() => onChange({ targetSets: Number(sets), targetRepsLow: Number(low), targetRepsHigh: Number(high) })}
      >
        Save
      </Button>
    </div>
  )
}

export default function Plan() {
  const plan = useLiveQuery(async () => (await getActivePlan()) ?? null)
  const profile = useProfile()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [swap, setSwap] = useState<{ si: number; ei: number } | null>(null)
  const [adding, setAdding] = useState<number | null>(null)
  const [adjusting, setAdjusting] = useState<string | null>(null)

  if (plan === undefined || profile === undefined) return <PageSkeleton />
  if (!plan || !profile || plan.sessions.length === 0) {
    return <EmptyState title="No plan yet" body="We couldn't find a plan for you yet." />
  }

  const activePlan: PlanType = plan
  const me: Profile = profile
  const order = activePlan.sessions.map((s, i) => ({ s, i })).sort((a, b) => a.s.dayIndex - b.s.dayIndex)
  const balance = planBalance(activePlan)

  async function apply(next: PlanType) {
    if (next !== activePlan) await saveActivePlan(next)
  }

  const swapTarget = swap ? activePlan.sessions[swap.si]?.exercises[swap.ei] : undefined
  const swapChoices = swap && swapTarget ? swapOptions(swapTarget.exerciseId, me, activePlan.sessions[swap.si]!.exercises.map((e) => e.exerciseId)) : []

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <h1 className="font-display font-semibold text-3xl md:text-4xl">Your plan</h1>
        <Button variant={editing ? 'primary' : 'secondary'} className="min-h-11 px-4" aria-pressed={editing} onClick={() => setEditing((e) => !e)}>
          {editing ? 'Done' : 'Edit plan'}
        </Button>
      </div>

      {balance.uneven && (
        <div role="status" className="rounded-lg border border-line bg-warning/10 px-4 py-3 text-sm mb-6">
          <p className="font-semibold mb-2">
            Pushing and pulling are uneven ({balance.push} push sets, {balance.pull} pull sets).
          </p>
          <Button
            variant="secondary"
            className="min-h-11"
            onClick={async () => {
              await apply(balancePlan(activePlan, me))
              toast('Plan balanced.')
            }}
          >
            Balance my plan
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {order.map(({ s: session, i: si }) => (
          <Card key={`${session.name}-${session.dayIndex}`}>
            <p className="label-eyebrow text-faint mb-1">
              {DAY_NAMES[session.dayIndex]} · about {estimateSessionMinutes(session)} min
            </p>
            {editing ? (
              <div className="mb-3">
                <TextField
                  label="Session name"
                  defaultValue={session.name}
                  maxLength={40}
                  onBlur={(e) => void apply(renameSession(activePlan, si, e.target.value))}
                />
              </div>
            ) : (
              <h2 className="font-display font-semibold text-lg mb-3">{session.name}</h2>
            )}
            <ul className="space-y-1.5">
              {session.exercises.map((pe, ei) => {
                const exercise = getExerciseById(pe.exerciseId)
                const key = `${si}-${ei}-${pe.exerciseId}`
                return (
                  <li key={key} className="text-sm">
                    <div className="flex justify-between gap-2">
                      <span>
                        {exercise?.name ?? pe.exerciseId}
                        {pe.block && pe.block !== 'main' ? <span className="text-xs text-faint"> · {pe.block}</span> : null}
                      </span>
                      <span className="text-faint shrink-0">
                        {pe.targetSets} × {targetLabel(pe.targetRepsLow, pe.targetRepsHigh, exercise?.trackingType)}
                      </span>
                    </div>
                    {editing && (
                      <div className="flex flex-wrap gap-1 mt-1 mb-2">
                        <button className="min-h-11 min-w-11 grid place-items-center rounded-lg border border-line" aria-label={`Move ${exercise?.name} up`} disabled={ei === 0} onClick={() => void apply(moveInPlan(activePlan, si, ei, ei - 1))}>
                          <ArrowUp size={16} aria-hidden="true" />
                        </button>
                        <button className="min-h-11 min-w-11 grid place-items-center rounded-lg border border-line" aria-label={`Move ${exercise?.name} down`} disabled={ei === session.exercises.length - 1} onClick={() => void apply(moveInPlan(activePlan, si, ei, ei + 1))}>
                          <ArrowDown size={16} aria-hidden="true" />
                        </button>
                        <button className="min-h-11 px-3 rounded-lg border border-line font-semibold" aria-label={`Swap ${exercise?.name}`} onClick={() => setSwap({ si, ei })}>
                          Swap
                        </button>
                        <button className="min-h-11 px-3 rounded-lg border border-line font-semibold" aria-expanded={adjusting === key} aria-label={`Adjust ${exercise?.name}`} onClick={() => setAdjusting(adjusting === key ? null : key)}>
                          Adjust
                        </button>
                        <button
                          className="min-h-11 px-3 rounded-lg border border-line font-semibold text-danger disabled:opacity-40"
                          aria-label={`Remove ${exercise?.name}`}
                          disabled={session.exercises.length <= 1}
                          onClick={() => void apply(removeFromPlan(activePlan, si, ei))}
                        >
                          Remove
                        </button>
                        {adjusting === key && (
                          <div className="w-full">
                            <Adjust
                              pe={pe}
                              label={targetLabel(pe.targetRepsLow, pe.targetRepsHigh, exercise?.trackingType)}
                              onChange={async (patch) => {
                                await apply(setPrescription(activePlan, si, ei, patch))
                                setAdjusting(null)
                                toast('Saved.')
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {editing && (
              <Button variant="ghost" className="mt-3 min-h-11" onClick={() => setAdding(si)}>
                Add an exercise
              </Button>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={swap !== null} onClose={() => setSwap(null)} title={`Swap ${swapTarget ? (getExerciseById(swapTarget.exerciseId)?.name ?? '') : ''}`}>
        {swapChoices.length === 0 ? (
          <p className="text-sm text-faint mb-4">There’s no close swap that fits your kit and what you’ve told us.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {swapChoices.map((e) => (
              <button
                key={e.id}
                className="w-full text-left font-semibold rounded-lg border border-line px-4 py-3 min-h-12 hover:bg-surface bg-elevated"
                onClick={async () => {
                  if (swap) await apply(swapInPlan(activePlan, swap.si, swap.ei, e.id, me))
                  setSwap(null)
                }}
              >
                {e.name}
              </button>
            ))}
          </div>
        )}
        <Button variant="ghost" className="w-full" onClick={() => setSwap(null)}>
          Cancel
        </Button>
      </Dialog>

      <AddExerciseDialog
        open={adding !== null}
        session={adding !== null ? activePlan.sessions[adding] : undefined}
        profile={me}
        onClose={() => setAdding(null)}
        onAdd={async (id) => {
          if (adding !== null) await apply(addToPlan(activePlan, adding, id, me))
        }}
      />

      <div className="flex flex-col items-center gap-2 mt-6 text-sm font-semibold">
        <Button
          variant="ghost"
          className="min-h-11"
          onClick={async () => {
            try {
              await deliverFile(new Blob([planToIcs(activePlan)], { type: 'text/calendar' }), 'stepup-plan.ics', true)
              toast('Calendar file ready. Open it to add your workout days.')
            } catch (err) {
              if ((err as DOMException).name !== 'AbortError') toast('That didn’t work. Please try again.')
            }
          }}
        >
          Add my workout days to a calendar
        </Button>
        <Link to="/profile/edit" className="text-accent">
          Rebuild from my preferences
        </Link>
        <p className="text-xs font-normal text-faint max-w-sm text-center">
          Your weights and history are kept when you edit or rebuild a plan.
        </p>
      </div>
    </div>
  )
}
