import { useLiveQuery } from 'dexie-react-hooks'
import { Card } from '../../components/ui'
import { db } from '../../db/schema'
import { parseISODateLocal } from '../../lib/format'
import { progressTowards, weeklyNutrition } from '../../lib/nutrition'
import { useNutritionToday } from '../../lib/useNutrition'
import { useTodayISO } from '../../lib/useToday'

/**
 * The last seven days of protein, as plain bars. Averages only count days that have something
 * logged — a day you didn't log isn't a day you ate nothing.
 */
export function WeeklyNutritionCard() {
  const today = useTodayISO()
  const { data } = useNutritionToday()
  const logs = useLiveQuery(() => db.mealLogs.toArray(), [])
  if (!logs || !data) return null

  const week = weeklyNutrition(logs, today)
  const target = data.effective.proteinG

  return (
    <Card>
      <h2 className="label-eyebrow text-faint mb-3">Last 7 days</h2>
      {week.daysLogged === 0 ? (
        <p className="text-sm text-faint">Log a few days and your averages will show up here.</p>
      ) : (
        <>
          <p className="text-sm mb-1">
            <span className="font-semibold">{week.avgProteinG} g protein</span> a day on average
            {target !== undefined && <span className="text-faint"> (target {target} g)</span>}
          </p>
          <p className="text-xs text-faint mb-4">
            {week.avgCalories.toLocaleString()} kcal · carbs {week.avgCarbsG} g · fat {week.avgFatG} g · logged on{' '}
            {week.daysLogged} of 7 days
          </p>
          <ul className="flex items-end gap-2 h-24" aria-label="Protein per day">
            {week.days.map((d) => {
              const label = parseISODateLocal(d.date).toLocaleDateString(undefined, { weekday: 'short' })
              const grams = d.totals ? Math.round(d.totals.proteinG) : null
              const height = d.totals ? Math.max(6, progressTowards(d.totals.proteinG, target ?? 150) * 100) : 0
              return (
                <li key={d.date} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                  <span className="sr-only">
                    {label}: {grams === null ? 'nothing logged' : `${grams} g protein`}
                  </span>
                  <div
                    aria-hidden="true"
                    className={`w-full rounded-t ${grams === null ? 'border border-dashed border-line' : 'bg-accent'}`}
                    style={{ height: grams === null ? 6 : `${height}%` }}
                  />
                  <span aria-hidden="true" className="text-[10px] text-faint">
                    {label.slice(0, 2)}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Card>
  )
}
