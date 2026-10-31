import { Link } from 'react-router-dom'
import { AddFoodPanel } from '../features/nutrition/AddFoodPanel'
import { NutritionSummary } from '../features/nutrition/NutritionSummary'
import { TargetsCard } from '../features/nutrition/TargetsCard'
import { TodayEntries } from '../features/nutrition/TodayEntries'
import { WeeklyNutritionCard } from '../features/nutrition/WeeklyNutritionCard'

export default function Nutrition() {
  return (
    <div>
      <Link to="/log" className="text-sm font-semibold text-faint min-h-12 inline-flex items-center">
        ← Log
      </Link>
      <h1 className="font-display font-semibold text-3xl md:text-4xl mb-1">Nutrition</h1>
      <p className="text-sm text-faint mb-6">
        Keep it simple: protein first, calories second. Everything stays on this device.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-start">
        <div className="space-y-6">
          <NutritionSummary />
          <TodayEntries />
          <WeeklyNutritionCard />
        </div>
        <div className="space-y-6">
          <AddFoodPanel />
          <TargetsCard />
        </div>
      </div>
    </div>
  )
}
