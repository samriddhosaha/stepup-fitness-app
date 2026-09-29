import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { EXERCISE_LIBRARY } from '../db/exerciseLibrary'
import { bodyWeightSeries, liftProgressionSeries, weeklyVolumeSeries } from '../lib/progress'
import { kgToDisplay, todayISODate, unitLabel } from '../lib/format'
import { bodyWeightRangeForUnit, rangeErrorMessage } from '../lib/validation'
import { Button, Card } from '../components/ui'
import { TrendLineChart, VolumeBarChart } from '../components/Charts'

export default function Progress() {
  const profile = useLiveQuery(() => db.profile.orderBy('createdAt').last())
  const [weightInput, setWeightInput] = useState('')

  const bodyWeight = useLiveQuery(bodyWeightSeries, [])
  const volume = useLiveQuery(weeklyVolumeSeries, [])
  const prs = useLiveQuery(() => db.personalRecords.orderBy('achievedAt').reverse().toArray())

  const liftOptions = EXERCISE_LIBRARY.filter((e) =>
    ['squat', 'hinge', 'press', 'pull'].includes(e.movementPattern),
  )
  const [selectedLift, setSelectedLift] = useState(liftOptions[0]?.id)
  const liftSeries = useLiveQuery(
    () => (selectedLift ? liftProgressionSeries(selectedLift) : Promise.resolve([])),
    [selectedLift],
  )

  const unit = profile?.weightUnit ?? 'kg'
  const weightRange = bodyWeightRangeForUnit(unit)
  const weightError = rangeErrorMessage(weightInput, weightRange, unitLabel(unit))

  async function logBodyWeight() {
    if (!weightInput || weightError) return
    const kg = unit === 'lb' ? Number(weightInput) * 0.45359237 : Number(weightInput)
    await db.progressSnapshots.add({ date: todayISODate(), bodyWeightKg: kg })
    setWeightInput('')
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Progress</h1>

      <Card>
        <p className="font-medium mb-3">Body weight</p>
        <TrendLineChart
          data={(bodyWeight ?? []).map((p) => ({ date: p.date, value: kgToDisplay(p.value, unit) }))}
          unit={unitLabel(unit)}
          emptyLabel="Log your weight a couple of times to see a trend."
        />
        <div className="flex gap-3 mt-3">
          <input
            type="number"
            inputMode="decimal"
            min={weightRange.min}
            max={weightRange.max}
            aria-label={`Weight (${unitLabel(unit)})`}
            aria-invalid={Boolean(weightError)}
            placeholder={`Weight (${unitLabel(unit)})`}
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className={`flex-1 rounded-xl border bg-elevated px-4 min-h-12 focus:outline-2 ${
              weightError ? 'border-danger focus:outline-danger' : 'border-line focus:outline-accent'
            }`}
          />
          <Button onClick={logBodyWeight} disabled={!weightInput || Boolean(weightError)}>
            Log
          </Button>
        </div>
        {weightError && <p className="text-xs text-danger mt-2">{weightError}</p>}
      </Card>

      <Card>
        <p className="font-medium mb-3">Weekly training volume</p>
        <VolumeBarChart
          data={volume ?? []}
          emptyLabel="Complete a few workouts to see your weekly volume."
        />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium">Lift progression</p>
          <select
            aria-label="Select lift for progression chart"
            value={selectedLift}
            onChange={(e) => setSelectedLift(e.target.value)}
            className="text-sm rounded-lg border border-line bg-elevated px-2 py-1.5"
          >
            {liftOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <TrendLineChart
          data={liftSeries ?? []}
          unit="kg est."
          emptyLabel="Log a few sessions of this lift to see your trend."
        />
      </Card>

      <Card>
        <p className="font-medium mb-3">Personal records</p>
        {!prs || prs.length === 0 ? (
          <p className="text-sm text-faint">No personal records yet. They’ll show up here.</p>
        ) : (
          <ul className="space-y-2">
            {prs.map((pr) => (
              <li key={pr.id} className="flex justify-between text-sm">
                <span>
                  {EXERCISE_LIBRARY.find((e) => e.id === pr.exerciseId)?.name ?? pr.exerciseId}
                </span>
                <span className="text-faint">{pr.value} kg est.</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
