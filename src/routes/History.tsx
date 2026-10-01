import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { db, getActivePlan } from '../db/schema'
import { parseISODateLocal, toISODate, todayISODate, weekdayIndexOfISO } from '../lib/format'
import { useUnit } from '../lib/useUnit'
import { Card, PageSkeleton } from '../components/ui'
import { DayDetail } from '../features/history/DayDetail'

type DayStatus = 'completed' | 'not-done' | 'scheduled' | 'rest'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Status is never colour alone: each state also has a mark and a spoken description.
const MARK: Record<DayStatus, string> = { completed: '✓', 'not-done': '–', scheduled: '○', rest: '' }
const SPOKEN: Record<DayStatus, string> = {
  completed: 'workout completed',
  'not-done': 'scheduled, not done',
  scheduled: 'workout scheduled',
  rest: 'rest day',
}

export default function History() {
  const [viewedMonth, setViewedMonth] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [selected, setSelected] = useState<string | null>(null)
  const plan = useLiveQuery(async () => (await getActivePlan()) ?? null)
  const sessions = useLiveQuery(() => db.workoutSessions.toArray())
  const unit = useUnit()

  const today = todayISODate()

  const cells = useMemo(() => {
    const year = viewedMonth.getFullYear()
    const month = viewedMonth.getMonth()
    const startOffset = (new Date(year, month, 1).getDay() + 6) % 7 // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const out: (string | null)[] = Array.from({ length: startOffset }, () => null)
    for (let d = 1; d <= daysInMonth; d += 1) out.push(toISODate(new Date(year, month, d)))
    return out
  }, [viewedMonth])

  if (plan === undefined || sessions === undefined) return <PageSkeleton label="Loading your history" />

  // Scheduled-ness only counts from the day the plan began, so a new plan doesn't
  // retroactively mark older days as missed.
  const planStart = plan ? toISODate(new Date(plan.createdAt)) : null

  function statusFor(date: string): DayStatus {
    if (sessions!.some((s) => s.date === date && s.completedAt)) return 'completed'
    const scheduled = Boolean(plan?.sessions.some((s) => s.dayIndex === weekdayIndexOfISO(date)))
    if (!scheduled || (planStart && date < planStart)) return 'rest'
    return date < today ? 'not-done' : 'scheduled'
  }

  const selectedSessions = selected ? sessions.filter((s) => s.date === selected) : []
  const label = (iso: string) =>
    parseISODateLocal(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="md:flex md:gap-10 md:items-start">
      <div className="md:max-w-md md:shrink-0 md:w-full">
        <div className="flex items-center justify-between mb-6">
          <button
            aria-label="Previous month"
            className="min-h-12 min-w-12 flex items-center justify-center rounded-lg border border-line"
            onClick={() => setViewedMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <h1 className="font-display font-semibold text-xl">
            {viewedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h1>
          <button
            aria-label="Next month"
            className="min-h-12 min-w-12 flex items-center justify-center rounded-lg border border-line"
            onClick={() => setViewedMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-4" role="group" aria-label="Calendar">
          {WEEKDAY_LABELS.map((l) => (
            <span key={l} className="label-eyebrow text-faint py-1" aria-hidden="true">
              {l.slice(0, 1)}
            </span>
          ))}
          {cells.map((date, i) => {
            if (!date) return <span key={`blank-${i}`} />
            const status = statusFor(date)
            const isToday = date === today
            return (
              <button
                key={date}
                type="button"
                aria-label={`${label(date)} — ${SPOKEN[status]}`}
                aria-current={isToday ? 'date' : undefined}
                aria-pressed={date === selected}
                onClick={() => setSelected(date)}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-semibold min-h-11 border ${
                  isToday ? 'border-accent' : 'border-transparent'
                } ${date === selected ? 'bg-hairline/40' : ''} ${status === 'completed' ? 'bg-accent-soft' : ''}`}
              >
                <span>{Number(date.slice(-2))}</span>
                <span aria-hidden="true" className="font-mono text-[0.7rem] leading-none h-3 text-faint">
                  {MARK[status]}
                </span>
              </button>
            )
          })}
        </div>

        <ul className="flex items-center gap-4 text-xs text-faint flex-wrap" aria-label="Legend">
          <li>✓ Completed</li>
          <li>– Not done</li>
          <li>○ Scheduled</li>
        </ul>
      </div>

      <div className="mt-6 md:mt-0 md:flex-1">
        {selected ? (
          <section aria-label={`Details for ${label(selected)}`}>
            <h2 className="label-eyebrow text-faint mb-3">{label(selected)}</h2>
            {selectedSessions.length > 0 ? (
              <DayDetail sessions={selectedSessions} unit={unit} />
            ) : (
              <Card>
                <p className="text-sm text-faint">
                  {statusFor(selected) === 'rest'
                    ? 'Nothing scheduled. A rest day.'
                    : statusFor(selected) === 'scheduled'
                      ? 'A workout is scheduled for this day.'
                      : 'No workout was logged this day. That’s fine.'}
                </p>
              </Card>
            )}
          </section>
        ) : (
          <p className="hidden md:block text-sm text-faint">Select a day to see what happened.</p>
        )}
      </div>
    </div>
  )
}
