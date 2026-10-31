import { useLiveQuery } from 'dexie-react-hooks'
import { Card } from '../../components/ui'
import { db } from '../../db/schema'
import { parseISODateLocal } from '../../lib/format'
import { trainingHeatmap } from '../../lib/heatmap'
import { useTodayISO } from '../../lib/useToday'

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function cellClass(count: number, future: boolean): string {
  if (future) return 'border border-dashed border-hairline'
  if (count === 0) return 'bg-surface border border-hairline'
  return count === 1 ? 'bg-accent/45 border border-line' : 'bg-accent border border-line'
}

/**
 * The last twelve weeks of training days, one small square per day. Rest days are plain, not
 * red, and the days still to come are dashed: it shows rhythm, not "misses".
 */
export function TrainingHeatmap() {
  const today = useTodayISO()
  const sessions = useLiveQuery(() => db.workoutSessions.where('completedAt').above(0).toArray(), [])
  if (!sessions) return null

  const { weeks, totalSessions, activeWeeks } = trainingHeatmap(sessions, today)
  const summary =
    totalSessions === 0
      ? 'No workouts in the last 12 weeks yet.'
      : `${totalSessions} workout${totalSessions === 1 ? '' : 's'} across ${activeWeeks} of the last 12 weeks.`

  return (
    <Card>
      <h2 className="label-eyebrow text-faint mb-3">Training days</h2>
      <div className="flex gap-1.5" role="img" aria-label={`Training days, last 12 weeks. ${summary}`}>
        <div className="flex flex-col gap-1.5 pr-1" aria-hidden="true">
          {DAY_LETTERS.map((letter, i) => (
            <span key={i} className="h-4 text-[10px] leading-4 text-faint">
              {letter}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]?.date} className="flex flex-col gap-1.5 flex-1" aria-hidden="true">
            {week.map((day) => (
              <span
                key={day.date}
                title={`${parseISODateLocal(day.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}: ${
                  day.future ? 'to come' : day.count === 0 ? 'rest' : `${day.count} workout${day.count === 1 ? '' : 's'}`
                }`}
                className={`h-4 rounded-sm ${cellClass(day.count, day.future)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="text-sm mt-3">{summary}</p>
    </Card>
  )
}
