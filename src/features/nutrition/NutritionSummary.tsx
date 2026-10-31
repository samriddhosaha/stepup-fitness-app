import { Link } from 'react-router-dom'
import { Card } from '../../components/ui'
import { progressTowards } from '../../lib/nutrition'
import { useNutritionToday } from '../../lib/useNutrition'

function MacroBar({ label, value, target, unit }: { label: string; value: number; target?: number; unit: string }) {
  const shown = Math.round(value)
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-semibold">{label}</span>
        <span>
          <span className="font-semibold">{shown}</span>
          {target !== undefined && <span className="text-faint"> / {target}</span>}
          <span className="text-faint"> {unit}</span>
        </span>
      </div>
      <div
        className="h-3 rounded-full border border-line overflow-hidden"
        role="progressbar"
        aria-label={`${label}${target !== undefined ? ` toward ${target} ${unit}` : ''}`}
        aria-valuemin={0}
        aria-valuemax={target ?? shown}
        aria-valuenow={shown}
      >
        <div
          className="h-full bg-accent motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${progressTowards(value, target) * 100}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Today's protein (first — it is the number that matters most for lifters), then calories, with
 * carbs and fat as plain text. `compact` is the Home/Log version with a link into Nutrition.
 */
export function NutritionSummary({ compact = false }: { compact?: boolean }) {
  const { data } = useNutritionToday()
  if (!data) return null
  const { totals, effective, logs } = data
  const hasTargets = effective.calories !== undefined || effective.proteinG !== undefined

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="label-eyebrow text-faint">Nutrition today</h2>
        {compact && (
          <Link
            to="/nutrition"
            className="text-sm font-semibold text-accent min-h-11 inline-flex items-center underline underline-offset-2"
          >
            Add food
          </Link>
        )}
      </div>

      <div className="space-y-3">
        <MacroBar label="Protein" value={totals.proteinG} target={effective.proteinG} unit="g" />
        <MacroBar label="Calories" value={totals.calories} target={effective.calories} unit="kcal" />
      </div>

      <p className="text-xs text-faint mt-3">
        Carbs {Math.round(totals.carbsG)} g · Fat {Math.round(totals.fatG)} g
        {logs.length === 0 ? ' · nothing logged yet' : ''}
      </p>

      {!hasTargets && (
        <p className="text-sm mt-3">
          No targets yet.{' '}
          <Link to="/nutrition" className="font-semibold text-accent underline underline-offset-2">
            Set them up
          </Link>
          .
        </p>
      )}
    </Card>
  )
}
