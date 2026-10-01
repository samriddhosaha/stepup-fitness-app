import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { getExerciseById } from '../db/exerciseLibrary'
import {
  bodyWeightSeries,
  liftProgressionSeries,
  liftsWithData,
  weeklyMuscleSets,
  weeklyVolumeSeries,
} from '../lib/progress'
import { deleteBodyWeight, saveBodyWeight, sevenDayAverage } from '../lib/bodyWeight'
import { kgToDisplay, todayISODate, unitLabel } from '../lib/format'
import { formatWeight, parseWeight } from '../lib/units'
import { useUnit } from '../lib/useUnit'
import { isRealPR } from '../lib/records'
import { bodyWeightRangeForUnit, rangeErrorMessage } from '../lib/validation'
import { Button, Card, PageSkeleton } from '../components/ui'
import { NumberField, Select } from '../components/forms'
import { useToast } from '../components/toastContext'
import { TrendLineChart, VolumeBarChart } from '../components/Charts'
import type { PersonalRecord, WeightUnit } from '../db/types'

function prValue(pr: PersonalRecord, unit: WeightUnit): string {
  if (pr.kind === 'reps') return `${pr.value} reps`
  return `${formatWeight(pr.value, unit)}${pr.kind === 'weight' ? '' : ' est.'}`
}

function BodyWeightCard({ unit }: { unit: WeightUnit }) {
  const toast = useToast()
  const readings = useLiveQuery(() => db.progressSnapshots.orderBy('date').toArray(), [])
  const series = useLiveQuery(bodyWeightSeries, [])
  const [input, setInput] = useState('')
  const [correcting, setCorrecting] = useState<{ date: string; value: string } | null>(null)

  const range = bodyWeightRangeForUnit(unit)
  const error = rangeErrorMessage(input, range, unitLabel(unit))
  const correctError = correcting ? rangeErrorMessage(correcting.value, range, unitLabel(unit)) : null
  const avg = readings ? sevenDayAverage(readings, todayISODate()) : undefined

  async function log() {
    const kg = parseWeight(input, unit)
    if (kg === null || error) return
    await saveBodyWeight(todayISODate(), kg)
    setInput('')
    toast('Weight saved for today.')
  }

  async function saveCorrection() {
    if (!correcting || correctError) return
    const kg = parseWeight(correcting.value, unit)
    if (kg === null) return
    await saveBodyWeight(correcting.date, kg)
    setCorrecting(null)
  }

  return (
    <Card>
      <h2 className="label-eyebrow text-faint mb-3">Body weight</h2>
      <TrendLineChart
        title="Body weight"
        data={(series ?? []).map((p) => ({ date: p.date, value: kgToDisplay(p.value, unit) }))}
        unit={unitLabel(unit)}
        emptyLabel="Log your weight a couple of times to see a trend."
      />
      {avg !== undefined && (
        <p className="text-sm mt-2">
          <span className="text-faint">7-day average:</span> {formatWeight(avg, unit)}
        </p>
      )}
      <div className="flex gap-3 mt-3 items-end">
        <div className="flex-1">
          <NumberField
            label={`Today’s weight (${unitLabel(unit)})`}
            value={input}
            onChange={setInput}
            error={error}
            min={range.min}
            max={range.max}
            step={0.1}
          />
        </div>
        <Button onClick={log} disabled={!input || Boolean(error)}>
          Log
        </Button>
      </div>

      {readings && readings.length > 0 && (
        <ul className="mt-4" aria-label="Recent readings">
          {[...readings].reverse().slice(0, 5).map((r) =>
            correcting?.date === r.date ? (
              <li key={r.id} className="py-2 border-b border-dotted border-hairline">
                <NumberField
                  label={`Weight on ${r.date} (${unitLabel(unit)})`}
                  value={correcting.value}
                  onChange={(value) => setCorrecting({ date: r.date, value })}
                  error={correctError}
                  step={0.1}
                />
                <div className="flex gap-3 mt-2">
                  <Button className="flex-1" onClick={saveCorrection} disabled={Boolean(correctError) || !correcting.value}>
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setCorrecting(null)}>
                    Cancel
                  </Button>
                </div>
              </li>
            ) : (
              <li key={r.id} className="flex items-center justify-between text-sm py-1 border-b border-dotted border-hairline">
                <span>
                  <span className="font-semibold">{formatWeight(r.bodyWeightKg, unit)}</span>{' '}
                  <span className="text-faint">{r.date}</span>
                </span>
                <span className="flex">
                  <button
                    className="min-h-11 px-2 font-semibold text-accent"
                    aria-label={`Correct weight from ${r.date}`}
                    onClick={() => setCorrecting({ date: r.date, value: formatWeight(r.bodyWeightKg, unit, false) })}
                  >
                    Correct
                  </button>
                  <button
                    className="min-h-11 px-2 font-semibold text-danger"
                    aria-label={`Delete weight from ${r.date}`}
                    onClick={() => void deleteBodyWeight(r.id!)}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </Card>
  )
}

function MuscleCard() {
  const rows = useLiveQuery(() => weeklyMuscleSets(todayISODate()), [])
  const max = Math.max(1, ...(rows ?? []).map((r) => r.sets))
  return (
    <Card>
      <h2 className="label-eyebrow text-faint mb-3">Sets per muscle this week</h2>
      {!rows || rows.length === 0 ? (
        <p className="text-sm text-faint">Finish a workout and your week’s sets by muscle show up here.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.muscle} className="text-sm">
              <div className="flex justify-between mb-0.5">
                <span className="capitalize font-semibold">{r.muscle}</span>
                <span className="text-faint">
                  {r.sets} set{r.sets === 1 ? '' : 's'}
                </span>
              </div>
              <div className="h-2 rounded-full border border-line overflow-hidden" aria-hidden="true">
                <div className="h-full bg-accent" style={{ width: `${(r.sets / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function PersonalBests({ unit }: { unit: WeightUnit }) {
  const prs = useLiveQuery(async () => (await db.personalRecords.toArray()).filter(isRealPR), [])
  const [open, setOpen] = useState<string | null>(null)

  const byExercise = new Map<string, PersonalRecord[]>()
  for (const pr of prs ?? []) byExercise.set(pr.exerciseId, [...(byExercise.get(pr.exerciseId) ?? []), pr])
  const rows = [...byExercise.entries()].map(([exerciseId, list]) => ({
    exerciseId,
    best: list.reduce((a, b) => (b.value > a.value ? b : a)),
    history: [...list].sort((a, b) => b.achievedAt - a.achievedAt),
  }))

  return (
    <Card>
      <h2 className="label-eyebrow text-faint mb-3">Personal bests</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-faint">No personal bests yet. They’ll show up here, once you’ve beaten a past session.</p>
      ) : (
        <ul>
          {rows.map(({ exerciseId, best, history }) => (
            <li key={exerciseId} className="border-b border-dotted border-hairline last:border-0">
              <button
                className="w-full flex justify-between items-center text-sm min-h-12 text-left"
                aria-expanded={open === exerciseId}
                onClick={() => setOpen(open === exerciseId ? null : exerciseId)}
              >
                <span className="font-semibold">{getExerciseById(exerciseId)?.name ?? exerciseId}</span>
                <span className="text-faint">{prValue(best, unit)}</span>
              </button>
              {open === exerciseId && (
                <ul className="pb-3 text-sm text-faint">
                  {history.map((h) => (
                    <li key={h.id} className="flex justify-between">
                      <span>{new Date(h.achievedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                      <span>{prValue(h, unit)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default function Progress() {
  const unit = useUnit()
  const volume = useLiveQuery(weeklyVolumeSeries, [])
  const lifts = useLiveQuery(liftsWithData, [])
  const [picked, setPicked] = useState<string | null>(null)
  const selectedLift = picked && lifts?.includes(picked) ? picked : lifts?.[0]
  const liftSeries = useLiveQuery(
    () => (selectedLift ? liftProgressionSeries(selectedLift) : Promise.resolve([])),
    [selectedLift],
  )

  if (volume === undefined || lifts === undefined) return <PageSkeleton label="Loading your progress" />

  return (
    <div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl mb-6">Progress</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <BodyWeightCard unit={unit} />

        <Card>
          <h2 className="label-eyebrow text-faint mb-3">Weekly training volume</h2>
          <VolumeBarChart
            title="Weekly training volume"
            data={volume.map((p) => ({ ...p, value: Math.round(kgToDisplay(p.value, unit)) }))}
            unit={unitLabel(unit)}
            emptyLabel="Complete a few workouts to see your weekly volume."
          />
        </Card>

        <MuscleCard />

        <Card>
          <div className="mb-3">
            <h2 className="label-eyebrow text-faint mb-2">Lift progression</h2>
            {lifts.length > 0 && (
              <Select
                label="Lift"
                value={selectedLift}
                onChange={(e) => setPicked(e.target.value)}
                options={lifts.map((id) => ({ value: id, label: getExerciseById(id)?.name ?? id }))}
              />
            )}
          </div>
          <TrendLineChart
            title={`${selectedLift ? getExerciseById(selectedLift)?.name : 'Lift'} estimated one-rep max`}
            data={(liftSeries ?? []).map((p) => ({ ...p, value: kgToDisplay(p.value, unit) }))}
            unit={`${unitLabel(unit)} est.`}
            emptyLabel={
              lifts.length === 0
                ? 'Log a weighted lift and its trend shows up here.'
                : 'Log a few sessions of this lift to see your trend.'
            }
          />
        </Card>

        <PersonalBests unit={unit} />
      </div>
    </div>
  )
}

