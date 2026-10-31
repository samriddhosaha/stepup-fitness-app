import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check } from 'lucide-react'
import { useToast } from '../../components/toastContext'
import { Button, Card } from '../../components/ui'
import { db } from '../../db/schema'
import { habitStreak, recentHabitDays } from '../../lib/health'
import { addHabit, setHabitArchived, toggleHabit } from '../../lib/healthStore'
import { useTodayISO } from '../../lib/useToday'

/** Daily yes/no habits with a streak. `compact` is the Home version: just the toggles. */
export function HabitsCard({ compact = false }: { compact?: boolean }) {
  const today = useTodayISO()
  const toast = useToast()
  const [managing, setManaging] = useState(false)
  const [name, setName] = useState('')

  const rows = useLiveQuery(async () => {
    const [habits, logs] = await Promise.all([db.habits.toArray(), db.habitLogs.toArray()])
    const datesByHabit = new Map<number, string[]>()
    for (const log of logs) {
      const list = datesByHabit.get(log.habitId) ?? []
      list.push(log.date)
      datesByHabit.set(log.habitId, list)
    }
    return habits
      .filter((h) => !h.archived)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((habit) => {
        const dates = datesByHabit.get(habit.id!) ?? []
        return {
          habit,
          doneToday: dates.includes(today),
          streak: habitStreak(dates, today),
          week: recentHabitDays(dates, today, 7),
        }
      })
  }, [today])

  if (!rows) return null

  if (compact) {
    if (rows.length === 0) return null
    const done = rows.filter((r) => r.doneToday).length
    return (
      <Card>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="label-eyebrow text-faint">Habits today</h2>
          <span className="text-sm font-semibold">
            {done}/{rows.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {rows.map(({ habit, doneToday, streak }) => (
            <button
              key={habit.id}
              type="button"
              aria-pressed={doneToday}
              onClick={() => toggleHabit(habit.id!)}
              className={`rounded-lg border border-line min-h-12 px-4 text-sm font-semibold flex items-center gap-2 transition-colors ${
                doneToday ? 'bg-accent text-on-accent' : 'bg-elevated text-ink hover:bg-surface'
              }`}
            >
              {doneToday && <Check size={16} strokeWidth={3} aria-hidden="true" />}
              {habit.name}
              {streak > 1 && <span className="font-normal opacity-80">{streak}d</span>}
            </button>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="label-eyebrow text-faint">Habits</h2>
        <button
          type="button"
          className="text-sm font-semibold text-accent min-h-11 px-2"
          aria-pressed={managing}
          onClick={() => setManaging((m) => !m)}
        >
          {managing ? 'Done' : 'Manage'}
        </button>
      </div>

      {rows.length === 0 && <p className="text-sm text-faint mb-4">No habits yet. Add one below — creatine, mobility, anything.</p>}

      <ul className="space-y-3">
        {rows.map(({ habit, doneToday, streak, week }) => (
          <li key={habit.id} className="flex items-center gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={doneToday}
              aria-label={`${habit.name}, ${doneToday ? 'done' : 'not done'} today`}
              onClick={() => toggleHabit(habit.id!)}
              className={`shrink-0 w-12 h-12 rounded-lg border border-line flex items-center justify-center transition-colors ${
                doneToday ? 'bg-accent text-on-accent' : 'bg-elevated'
              }`}
            >
              {doneToday && <Check size={22} strokeWidth={3} aria-hidden="true" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{habit.name}</p>
              <p className="text-xs text-faint">{streak > 0 ? `${streak}-day streak` : 'No streak yet'}</p>
            </div>
            {/* The week strip makes way for the Remove button while managing. */}
            <div className={`flex gap-1 ${managing ? 'hidden' : ''}`} aria-hidden="true">
              {week.map((d) => (
                <span
                  key={d.date}
                  title={d.date}
                  className={`w-2.5 h-5 rounded-sm border border-line ${d.done ? 'bg-accent' : 'bg-transparent'}`}
                />
              ))}
            </div>
            {managing && (
              <button
                type="button"
                className="text-sm font-semibold text-danger min-h-11 px-2"
                onClick={async () => {
                  await setHabitArchived(habit.id!, true)
                  toast(`${habit.name} removed`, { label: 'Undo', onClick: () => void setHabitArchived(habit.id!, false) })
                }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        className="flex gap-3 mt-5 items-end"
        onSubmit={async (e) => {
          e.preventDefault()
          if (await addHabit(name)) setName('')
        }}
      >
        <label className="flex-1 min-w-0">
          <span className="label-eyebrow block text-ink mb-1.5">New habit</span>
          <input
            type="text"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line bg-elevated text-ink px-4 min-h-12 focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={name.trim() === ''}>
          Add
        </Button>
      </form>
    </Card>
  )
}
