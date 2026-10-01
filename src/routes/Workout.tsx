import { useLiveQuery } from 'dexie-react-hooks'
import { getActivePlan } from '../db/schema'
import { getExerciseById } from '../db/exerciseLibrary'
import { findTodaysSession } from '../lib/workout'
import { Button, Card, EmptyState, PageSkeleton } from '../components/ui'
import { useStartWorkout } from '../components/StartWorkout'

export default function Workout() {
  const plan = useLiveQuery(getActivePlan)
  const { begin, dialog } = useStartWorkout()

  if (plan === undefined) return <PageSkeleton />
  if (!plan) return <EmptyState title="No plan yet" body="We couldn't load your plan." />

  const todays = findTodaysSession(plan.sessions)

  if (!todays) {
    return (
      <div className="flex-1 flex flex-col justify-between py-10">
        {dialog}
        <div>
          <p className="font-display font-semibold text-3xl mb-2">Nothing scheduled.</p>
          <p className="text-faint">A rest day.</p>
          <p className="text-sm text-faint mt-4">
            Rest is part of the plan, not a break from it.
          </p>
        </div>
        <div className="space-y-3">
          {plan.sessions.map((s) => (
            <Card key={s.name + s.dayIndex}>
              <p className="font-semibold mb-2">{s.name}</p>
              <Button variant="secondary" className="w-full" onClick={() => begin(s)}>
                Train anyway
              </Button>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col justify-between py-10">
      {dialog}
      <div>
        <p className="font-display font-semibold text-3xl mb-2">{todays.name}</p>
        <p className="text-faint">Nothing to prove today. Just begin.</p>
      </div>

      <div className="my-6">
        {todays.exercises.map((pe) => {
          const exercise = getExerciseById(pe.exerciseId)
          const hasWarmup = Boolean(exercise?.warmupRamp)
          return (
            <div key={pe.exerciseId} className="flex justify-between items-center text-sm py-2 border-b border-dotted border-hairline">
              <span className="font-semibold">{exercise?.name}</span>
              <span className="text-faint">
                {hasWarmup && 'Warm-up + '}
                {pe.targetSets} × {pe.targetRepsLow}-{pe.targetRepsHigh}
              </span>
            </div>
          )
        })}
      </div>

      <Button className="w-full md:w-auto" onClick={() => begin(todays)}>
        Start workout
      </Button>
    </div>
  )
}
