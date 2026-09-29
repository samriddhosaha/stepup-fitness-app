import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '../components/ui'
import { getActivePlan } from '../db/schema'

export default function PlanReady() {
  const navigate = useNavigate()
  const plan = useLiveQuery(getActivePlan)

  return (
    <div className="flex-1 flex flex-col justify-between py-10">
      <div>
        <p className="font-display text-3xl leading-tight mb-4">
          Your plan is ready.
        </p>
        <p className="text-faint">
          The first one is the only one that starts everything.
        </p>
      </div>

      {plan && (
        <div className="space-y-3">
          {plan.sessions.map((s) => (
            <div key={s.name + s.dayIndex} className="rounded-xl border border-hairline bg-elevated px-4 py-3">
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-faint">{s.exercises.length} exercises</p>
            </div>
          ))}
        </div>
      )}

      <Button className="w-full" onClick={() => navigate('/dashboard')}>
        See my plan
      </Button>
    </div>
  )
}
