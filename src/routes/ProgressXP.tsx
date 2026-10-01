import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/schema'
import { getLevelProgress, getTotalXP } from '../lib/xp'
import { Card } from '../components/ui'

const XP_LABELS: Record<string, string> = {
  set: 'Set completed',
  exercise: 'Exercise completed',
  workout: 'Workout completed',
  pr: 'Personal record',
}

export default function ProgressXP() {
  const events = useLiveQuery(() => db.xpEvents.orderBy('occurredAt').reverse().toArray())

  if (!events) return null

  const totalXP = getTotalXP(events)
  const progress = getLevelProgress(totalXP)
  const percent = progress.xpForNextLevel
    ? Math.min(100, Math.round((progress.xpIntoLevel / progress.xpForNextLevel) * 100))
    : 100

  return (
    <div>
      <Link to="/progress" className="text-sm font-semibold text-faint">
        ← Progress
      </Link>

      <div className="md:grid md:grid-cols-3 md:gap-8 mt-6 space-y-6 md:space-y-0">
        <div className="md:col-span-1">
          <Card>
            <p className="label-eyebrow text-faint mb-1">{progress.rank}</p>
            <p className="font-display font-semibold text-3xl mb-3">Level {progress.level}</p>
            <div className="h-2 rounded-full border border-line overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-xs text-faint mt-2">
              {progress.xpIntoLevel} / {progress.xpForNextLevel} XP to next level
            </p>
          </Card>
        </div>

        <div className="md:col-span-2">
          <p className="label-eyebrow text-faint mb-3">History</p>
          <ul>
            {events.slice(0, 50).map((e) => (
              <li key={e.id} className="flex justify-between text-sm py-2 border-b border-dotted border-hairline">
                <span className="font-semibold">{XP_LABELS[e.type] ?? e.type}</span>
                <span className={e.amount < 0 ? 'text-danger font-semibold' : 'text-accent font-semibold'}>
                  {e.amount > 0 ? '+' : ''}
                  {e.amount} XP
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
