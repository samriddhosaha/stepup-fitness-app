import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '../components/ui'
import { getActivePlan } from '../db/schema'
import { getExerciseById } from '../db/exerciseLibrary'
import { estimateSessionMinutes } from '../lib/plan'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function PlanReady() {
  const navigate = useNavigate()
  const plan = useLiveQuery(getActivePlan)

  return (
    <div className="flex-1 flex flex-col justify-between py-10">
      <div>
        <h1 className="font-display font-semibold text-4xl leading-none mb-4">
          Your plan is ready.
        </h1>
        <p className="text-faint">
          The first one is the only one that starts everything.
        </p>
      </div>

      {plan && (
        <ul className="space-y-3" aria-label="Your sessions">
          {plan.sessions.map((s) => (
            <li key={s.name + s.dayIndex} className="rounded-lg border border-line bg-elevated px-4 py-3">
              <p className="font-semibold">
                {s.name} <span className="text-xs font-normal text-faint">· {DAYS[s.dayIndex]} · about {estimateSessionMinutes(s)} min</span>
              </p>
              <p className="text-sm text-faint">{s.exercises.map((e) => getExerciseById(e.exerciseId)?.name).filter(Boolean).join(', ')}</p>
            </li>
          ))}
        </ul>
      )}

      <Button className="w-full md:w-auto" onClick={() => navigate('/dashboard')}>
        See my plan
      </Button>
    </div>
  )
}
