import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { db, getActivePlan } from '../db/schema'
import { toISODate, todayISODate } from '../lib/format'
import { Card } from '../components/ui'

type DayStatus = 'completed' | 'missed' | 'rest' | 'scheduled' | 'none'

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function History() {
  const [viewedMonth, setViewedMonth] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const plan = useLiveQuery(getActivePlan)
  const sessions = useLiveQuery(() => db.workoutSessions.toArray())

  const today = todayISODate()

  const days = useMemo(() => {
    const year = viewedMonth.getFullYear()
    const month = viewedMonth.getMonth()
    const firstOfMonth = new Date(year, month, 1)
    const startOffset = (firstOfMonth.getDay() + 6) % 7 // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells: { date: string | null; dayIndex: number }[] = []
    for (let i = 0; i < startOffset; i += 1) cells.push({ date: null, dayIndex: -1 })
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = new Date(year, month, d)
      cells.push({ date: toISODate(date), dayIndex: (date.getDay() + 6) % 7 })
    }
    return cells
  }, [viewedMonth])

  function statusFor(date: string, dayIndex: number): DayStatus {
    const hasSessionThatDay = plan?.sessions.some((s) => s.dayIndex === dayIndex)
    const completed = sessions?.find((s) => s.date === date && s.completedAt)
    if (completed) return 'completed'
    if (!hasSessionThatDay) return 'rest'
    if (date < today) return 'missed'
    if (date === today) return 'scheduled'
    return 'scheduled'
  }

  const [selected, setSelected] = useState<string | null>(null)
  const selectedSessions = sessions?.filter((s) => s.date === selected)

  return (
    <div className="md:flex md:gap-10 md:items-start">
      <div className="md:max-w-md md:shrink-0 md:w-full">
        <div className="flex items-center justify-between mb-6">
          <button
            aria-label="Previous month"
            className="min-h-12 min-w-12 flex items-center justify-center border-2 border-ink"
            onClick={() =>
              setViewedMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="font-display font-bold text-xl">
            {viewedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h1>
          <button
            aria-label="Next month"
            className="min-h-12 min-w-12 flex items-center justify-center border-2 border-ink"
            onClick={() =>
              setViewedMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-4">
          {WEEKDAY_LABELS.map((l, i) => (
            <span key={i} className="label-eyebrow text-faint py-1">
              {l}
            </span>
          ))}
          {days.map((cell, i) => {
            if (!cell.date) return <span key={i} />
            const status = statusFor(cell.date, cell.dayIndex)
            const dotColor: Record<DayStatus, string> = {
              completed: 'bg-accent',
              missed: 'bg-danger',
              rest: 'bg-transparent',
              scheduled: 'bg-hairline',
              none: 'bg-transparent',
            }
            return (
              <button
                key={cell.date}
                onClick={() => setSelected(cell.date)}
                className={`aspect-square flex flex-col items-center justify-center text-xs font-bold min-h-11 border-2 ${
                  cell.date === today ? 'border-accent' : 'border-transparent'
                } ${cell.date === selected ? 'bg-hairline/40' : ''}`}
              >
                <span>{Number(cell.date.slice(-2))}</span>
                <span className={`w-2 h-2 mt-0.5 ${dotColor[status]}`} />
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-4 text-xs text-faint">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-accent" /> Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-danger" /> Missed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-hairline" /> Scheduled
          </span>
        </div>
      </div>

      <div className="mt-6 md:mt-0 md:flex-1">
        {selected ? (
          <Card>
            {selectedSessions && selectedSessions.length > 0 ? (
              selectedSessions.map((s) => (
                <div key={s.id}>
                  <p className="font-bold">{s.planSessionName}</p>
                  <p className="text-sm text-faint">
                    {s.completedAt ? 'Workout completed.' : 'Workout planned. Not completed.'}
                  </p>
                </div>
              ))
            ) : statusFor(selected, (new Date(selected).getDay() + 6) % 7) === 'rest' ? (
              <p className="text-sm text-faint">Nothing scheduled. A rest day.</p>
            ) : (
              <p className="text-sm text-faint">Workout planned. Not completed.</p>
            )}
          </Card>
        ) : (
          <p className="hidden md:block text-sm text-faint">Select a day to see what happened.</p>
        )}
      </div>
    </div>
  )
}
