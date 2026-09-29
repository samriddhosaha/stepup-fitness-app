import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { getActivePlan } from '../db/schema'
import { getExerciseById } from '../db/exerciseLibrary'
import { Card, EmptyState } from '../components/ui'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function Plan() {
  const plan = useLiveQuery(getActivePlan)

  if (plan === undefined) return null

  if (!plan || plan.sessions.length === 0) {
    return <EmptyState title="No plan yet" body="We couldn't find a plan for you yet." />
  }

  const sorted = [...plan.sessions].sort((a, b) => a.dayIndex - b.dayIndex)

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Your plan</h1>

      {plan.volumeUneven && (
        <div className="rounded-xl bg-warning/10 border border-warning/30 px-4 py-3 text-sm">
          Pushing and pulling volume are uneven in this plan.
        </div>
      )}

      {sorted.map((session) => (
        <Card key={session.name + session.dayIndex}>
          <p className="text-xs text-faint mb-1">{DAY_NAMES[session.dayIndex]}</p>
          <p className="font-display text-lg mb-3">{session.name}</p>
          <ul className="space-y-1.5">
            {session.exercises.map((pe) => {
              const exercise = getExerciseById(pe.exerciseId)
              return (
                <li key={pe.exerciseId} className="flex justify-between text-sm">
                  <span>{exercise?.name ?? pe.exerciseId}</span>
                  <span className="text-faint">
                    {pe.targetSets} × {pe.targetRepsLow}-{pe.targetRepsHigh}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      ))}

      <Link to="/profile/edit" className="block text-center text-sm text-accent mt-2">
        Edit training preferences
      </Link>
    </div>
  )
}
