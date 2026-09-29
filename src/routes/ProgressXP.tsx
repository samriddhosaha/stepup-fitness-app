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
  streak: 'Streak milestone',
  'weekly-mission': 'Weekly mission',
  loss: 'Missed or skipped',
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
    <div className="space-y-6">
      <Link to="/progress" className="text-sm text-faint">
        ← Progress
      </Link>

      <Card>
        <p className="text-xs text-faint mb-1">{progress.rank}</p>
        <p className="font-display text-3xl mb-3">Level {progress.level}</p>
        <div className="h-2 rounded-full bg-hairline overflow-hidden">
          <div className="h-full bg-accent rounded-full" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs text-faint mt-2">
          {progress.xpIntoLevel} / {progress.xpForNextLevel} XP to next level
        </p>
      </Card>

      <div>
        <p className="font-medium mb-3">History</p>
        <ul className="space-y-2">
          {events.slice(0, 50).map((e) => (
            <li key={e.id} className="flex justify-between text-sm py-2 border-b border-hairline">
              <span>{XP_LABELS[e.type] ?? e.type}</span>
              <span className={e.amount < 0 ? 'text-danger' : 'text-accent'}>
                {e.amount > 0 ? '+' : ''}
                {e.amount} XP
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
