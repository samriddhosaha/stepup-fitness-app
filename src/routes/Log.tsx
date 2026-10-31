import { BodyCard } from '../features/health/BodyCard'
import { CheckInCard } from '../features/health/CheckInCard'
import { HabitsCard } from '../features/health/HabitsCard'
import { WaterCard } from '../features/health/WaterCard'
import { NutritionSummary } from '../features/nutrition/NutritionSummary'

/** The daily log: the small things worth a tap a day. Training itself lives in Plan. */
export default function Log() {
  return (
    <div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl mb-2">Log</h1>
      <p className="text-sm text-faint mb-6">Food, water, recovery, habits and body — a few taps a day. Nothing here is required.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <NutritionSummary compact />
          <WaterCard />
          <HabitsCard />
        </div>
        <div className="space-y-6">
          <CheckInCard />
          <BodyCard />
        </div>
      </div>
    </div>
  )
}
