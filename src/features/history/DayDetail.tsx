import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { getExerciseById } from '../../db/exerciseLibrary'
import { deleteCompletedSession, updateCompletedSet } from '../../lib/workout'
import { formatDuration } from '../../lib/format'
import { workoutLoadRangeForUnit } from '../../lib/units'
import { loadStepFor } from '../../lib/overload'
import { SKIP_REASONS } from '../workout/constants'
import { SetForm } from '../workout/SetForm'
import { describeSet, setFromValues, summariseSets, validateValues, valuesFromSet, type SetFormValues } from '../workout/setValues'
import { Button, Card } from '../../components/ui'
import { ConfirmDialog } from '../../components/overlays'
import { useToast } from '../../components/toastContext'
import type { LoggedSet, WeightUnit, WorkoutSession } from '../../db/types'

const skipLabel = (reason: string) => SKIP_REASONS.find((r) => r.value === reason)?.label ?? 'No reason given'

function volumeKg(session: WorkoutSession): number {
  return session.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.weightKg ?? 0) * (set.reps ?? 0), 0),
    0,
  )
}

function SetEditor({
  sessionId,
  exerciseId,
  index,
  set,
  unit,
  onDone,
}: {
  sessionId: number
  exerciseId: string
  index: number
  set: LoggedSet
  unit: WeightUnit
  onDone: () => void
}) {
  const tracking = getExerciseById(exerciseId)?.trackingType ?? 'weight-reps'
  const showWeight = tracking === 'weight-reps' || (tracking === 'duration' && Boolean(set.weightKg))
  const [values, setValues] = useState<SetFormValues>(() => valuesFromSet(set, unit))
  const validation = validateValues(values, tracking, unit, showWeight)

  async function save() {
    const next = setFromValues(values, tracking, unit, index, showWeight)
    if (!next) return
    const { setIndex: _ignored, ...changes } = next
    void _ignored
    await updateCompletedSet(sessionId, exerciseId, index, changes)
    onDone()
  }

  return (
    <li className="py-2 border-b border-dotted border-hairline">
      <p className="text-sm font-semibold mb-2">Set {index + 1}</p>
      <SetForm
        tracking={tracking}
        unit={unit}
        showWeight={showWeight}
        values={values}
        onChange={(p) => setValues((v) => ({ ...v, ...p }))}
        errors={validation.errors}
        weightStep={loadStepFor(exerciseId, set.weightKg, unit)}
        weightRange={workoutLoadRangeForUnit(unit)}
        canSubmit={validation.canSubmit}
        submitLabel="Save"
        onSubmit={save}
        onCancel={onDone}
      />
    </li>
  )
}

function SessionCard({ session, unit }: { session: WorkoutSession; unit: WeightUnit }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [editingSet, setEditingSet] = useState<{ exerciseId: string; index: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const prs = useLiveQuery(
    () => db.personalRecords.where('sessionId').equals(session.id!).filter((r) => !r.baseline).toArray(),
    [session.id],
  )
  const done = Boolean(session.completedAt)
  const vol = volumeKg(session)

  return (
    <Card className="mb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{session.planSessionName}</h3>
          <p className="text-sm text-faint">
            {done ? 'Completed' : 'Started, not finished'}
            {session.finishedEarly ? ' (finished early)' : ''}
            {session.durationSeconds ? ` · ${formatDuration(session.durationSeconds)}` : ''}
            {vol > 0 ? ` · ${Math.round(vol).toLocaleString()} kg·reps total` : ''}
          </p>
        </div>
        {done && (
          <Button variant="ghost" className="min-h-11 px-3" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
            {editing ? 'Done' : 'Edit'}
          </Button>
        )}
      </div>

      {prs && prs.length > 0 && (
        <p className="text-sm mt-3">
          <span className="label-eyebrow text-faint">Personal bests</span>{' '}
          {prs.map((p) => getExerciseById(p.exerciseId)?.name).join(', ')}
        </p>
      )}

      <ul className="mt-3">
        {session.exercises.map((ex) => (
          <li key={ex.exerciseId} className="py-2 border-b border-dotted border-hairline">
            <div className="flex justify-between gap-3 text-sm">
              <Link to={`/history/exercise/${ex.exerciseId}`} className="font-semibold underline-offset-2 hover:underline">
                {getExerciseById(ex.exerciseId)?.name ?? ex.exerciseId}
              </Link>
              <span className="text-faint text-right">{summariseSets(ex.sets, unit, getExerciseById(ex.exerciseId)?.trackingType)}</span>
            </div>
            {editing && (
              <ul className="mt-2">
                {ex.sets.map((set, i) =>
                  editingSet?.exerciseId === ex.exerciseId && editingSet.index === i ? (
                    <SetEditor
                      key={i}
                      sessionId={session.id!}
                      exerciseId={ex.exerciseId}
                      index={i}
                      set={set}
                      unit={unit}
                      onDone={() => setEditingSet(null)}
                    />
                  ) : (
                    <li key={i} className="flex justify-between items-center text-sm">
                      <span>
                        Set {i + 1} · {describeSet(set, unit, getExerciseById(ex.exerciseId)?.trackingType)}
                      </span>
                      <button
                        className="min-h-11 px-2 font-semibold text-accent"
                        aria-label={`Correct set ${i + 1} of ${getExerciseById(ex.exerciseId)?.name}`}
                        onClick={() => setEditingSet({ exerciseId: ex.exerciseId, index: i })}
                      >
                        Correct
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {session.skips.length > 0 && (
        <div className="mt-3">
          <p className="label-eyebrow text-faint mb-1">Skipped</p>
          <ul className="text-sm">
            {session.skips.map((s, i) => (
              <li key={i}>
                {getExerciseById(s.exerciseId)?.name ?? s.exerciseId} — {skipLabel(s.reason)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {done && editing && (
        <div className="mt-4">
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete this workout
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this workout?"
        body="It disappears from your history and progress charts. XP you’ve already earned stays."
        confirmLabel="Delete workout"
        danger
        onConfirm={async () => {
          setConfirmDelete(false)
          await deleteCompletedSession(session.id!)
          toast('Workout deleted.')
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Card>
  )
}

export function DayDetail({ sessions, unit }: { sessions: WorkoutSession[]; unit: WeightUnit }) {
  return (
    <div>
      {sessions.map((s) => (
        <SessionCard key={s.id} session={s} unit={unit} />
      ))}
    </div>
  )
}
