import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft } from 'lucide-react'
import { db } from '../db/schema'
import { getExerciseById } from '../db/exerciseLibrary'
import { bestCandidate } from '../lib/records'
import { formatWeight } from '../lib/units'
import { useUnit } from '../lib/useUnit'
import { parseISODateLocal } from '../lib/format'
import { summariseSets } from '../features/workout/setValues'
import { Card, EmptyState, PageSkeleton } from '../components/ui'

/** Every time one exercise was logged, newest first. */
export default function ExerciseHistory() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const unit = useUnit()
  const exercise = getExerciseById(id)
  const rows = useLiveQuery(async () => {
    const done = await db.workoutSessions.where('completedAt').above(0).toArray()
    return done
      .flatMap((s) => {
        const ex = s.exercises.find((e) => e.exerciseId === id)
        return ex && ex.sets.length > 0 ? [{ session: s, ex }] : []
      })
      .sort((a, b) => b.session.date.localeCompare(a.session.date))
  }, [id])

  if (!exercise) {
    return <EmptyState title="Exercise not found" body="That exercise isn’t in the library." />
  }
  if (!rows) return <PageSkeleton />

  return (
    <div>
      <button className="flex items-center gap-1 text-sm text-faint mb-6 min-h-12" onClick={() => navigate(-1)}>
        <ChevronLeft size={18} aria-hidden="true" /> Back
      </button>
      <h1 className="font-display font-semibold text-2xl md:text-3xl mb-1">{exercise.name}</h1>
      <p className="text-sm text-faint mb-6">{exercise.primaryMuscles.join(', ')}</p>

      {rows.length === 0 ? (
        <EmptyState title="Nothing logged yet" body="Once you log this exercise, every session shows up here." />
      ) : (
        <ol className="space-y-3">
          {rows.map(({ session, ex }) => {
            const best = bestCandidate(ex)
            return (
              <li key={session.id}>
                <Card>
                  <p className="label-eyebrow text-faint mb-1">
                    {parseISODateLocal(session.date).toLocaleDateString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm font-semibold">{summariseSets(ex.sets, unit, exercise.trackingType)}</p>
                  {best && best.kind !== 'reps' && (
                    <p className="text-xs text-faint mt-1">
                      Best: {formatWeight(best.value, unit)}
                      {best.kind === 'e1rm' ? ' estimated one-rep max' : ' lifted'}
                    </p>
                  )}
                </Card>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
