import { formatWeight } from '../../lib/units'
import { RPE_LABELS } from './constants'
import type { LoggedSet, WeightUnit } from '../../db/types'

export function LoggedSets({
  sets,
  unit,
  editingIndex,
  onEdit,
  onDelete,
}: {
  sets: LoggedSet[]
  unit: WeightUnit
  editingIndex: number | null
  onEdit: (index: number) => void
  onDelete: (index: number) => void
}) {
  if (sets.length === 0) return null
  return (
    <section aria-label="Sets logged this exercise" className="mb-4">
      <h2 className="label-eyebrow text-faint mb-1">Logged</h2>
      <ol>
        {sets.map((s, i) => (
          <li
            key={i}
            className={`flex items-center justify-between gap-2 py-1 border-b border-dotted border-hairline text-sm ${
              editingIndex === i ? 'bg-accent-soft' : ''
            }`}
          >
            <span>
              <span className="font-semibold">Set {i + 1}</span>
              {' · '}
              {s.weightKg ? `${formatWeight(s.weightKg, unit)} × ` : ''}
              {s.reps ?? s.durationSeconds} {s.reps ? 'reps' : 's'}
              {s.rpe ? ` · ${RPE_LABELS[s.rpe - 1]}` : ''}
              {s.note ? <span className="block text-xs text-faint">{s.note}</span> : null}
            </span>
            <span className="flex shrink-0">
              <button
                type="button"
                className="min-h-11 px-2 text-sm font-semibold text-accent"
                aria-label={`Edit set ${i + 1}`}
                onClick={() => onEdit(i)}
              >
                Edit
              </button>
              <button
                type="button"
                className="min-h-11 px-2 text-sm font-semibold text-danger"
                aria-label={`Delete set ${i + 1}`}
                onClick={() => onDelete(i)}
              >
                Delete
              </button>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
