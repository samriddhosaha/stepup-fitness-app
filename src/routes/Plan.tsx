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
    <div>
      <h1 className="font-display font-bold text-3xl md:text-4xl mb-6">Your plan</h1>

      {plan.volumeUneven && (
        <div className="border-2 border-ink bg-warning/10 px-4 py-3 text-sm font-bold mb-6">
          Pushing and pulling volume are uneven in this plan.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((session) => (
          <Card key={session.name + session.dayIndex}>
            <p className="label-eyebrow text-faint mb-1">{DAY_NAMES[session.dayIndex]}</p>
            <p className="font-display font-bold text-lg mb-3">{session.name}</p>
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
      </div>

      <Link to="/profile/edit" className="block text-center text-sm font-bold text-accent mt-6">
        Edit training preferences
      </Link>
    </div>
  )
}
