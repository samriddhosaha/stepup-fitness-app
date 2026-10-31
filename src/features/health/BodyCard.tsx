import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { NumberField, SegmentedControl } from '../../components/forms'
import { useToast } from '../../components/toastContext'
import { Button, Card } from '../../components/ui'
import { db } from '../../db/schema'
import type { MeasurementType } from '../../db/types'
import { saveBodyWeight } from '../../lib/bodyWeight'
import { todayISODate, unitLabel } from '../../lib/format'
import {
  MEASUREMENT_TYPES,
  cmToDisplay,
  displayToCm,
  lengthUnitLabel,
  measurementRangeForUnit,
  measurementSummaries,
} from '../../lib/health'
import { addMeasurement } from '../../lib/healthStore'
import { formatWeight, parseWeight } from '../../lib/units'
import { useUnit } from '../../lib/useUnit'
import { bodyWeightRangeForUnit, rangeErrorMessage } from '../../lib/validation'

/**
 * Quick weigh-in and optional tape measurements. Weigh-in history, corrections and the trend
 * live on the Progress tab, which shares the same one-reading-a-day rule.
 */
export function BodyCard() {
  const unit = useUnit()
  const toast = useToast()
  const [weight, setWeight] = useState('')
  const [type, setType] = useState<MeasurementType>('waist')
  const [measure, setMeasure] = useState('')

  const latest = useLiveQuery(() => db.progressSnapshots.orderBy('date').last(), [])
  const measurements = useLiveQuery(() => db.bodyMeasurements.toArray(), [])

  const weightLabel = unitLabel(unit)
  const lengthLabel = lengthUnitLabel(unit)
  const weightError = rangeErrorMessage(weight, bodyWeightRangeForUnit(unit), weightLabel)
  const measureError = rangeErrorMessage(measure, measurementRangeForUnit(unit), lengthLabel)
  const summaries = measurementSummaries(measurements ?? [])
  const typeLabel = MEASUREMENT_TYPES.find((m) => m.value === type)?.label ?? ''

  return (
    <Card>
      <h2 className="label-eyebrow text-faint mb-4">Body</h2>

      <div className="flex gap-3 items-end">
        <div className="flex-1 min-w-0">
          <NumberField
            label={`Today’s weight (${weightLabel})`}
            value={weight}
            onChange={setWeight}
            error={weightError}
            step={0.1}
          />
        </div>
        <Button
          disabled={!weight || Boolean(weightError)}
          onClick={async () => {
            const kg = parseWeight(weight, unit)
            if (kg === null) return
            await saveBodyWeight(todayISODate(), kg)
            setWeight('')
            toast('Weight saved for today.')
          }}
        >
          Log
        </Button>
      </div>
      <p className="text-xs text-faint mt-2">
        {latest ? `Last: ${formatWeight(latest.bodyWeightKg, unit)} on ${latest.date}. ` : ''}
        <Link to="/progress" className="font-semibold text-accent underline underline-offset-2">
          Trend and history
        </Link>
      </p>

      <div className="mt-6 pt-5 border-t border-hairline">
        <h3 className="label-eyebrow text-faint mb-3">Measurements (optional)</h3>
        <SegmentedControl
          label="Measurement type"
          options={MEASUREMENT_TYPES}
          value={type}
          onChange={setType}
          className="mb-3"
        />
        <div className="flex gap-3 items-end">
          <div className="flex-1 min-w-0">
            <NumberField
              label={`${typeLabel} (${lengthLabel})`}
              value={measure}
              onChange={setMeasure}
              error={measureError}
              step={0.5}
            />
          </div>
          <Button
            variant="secondary"
            disabled={!measure || Boolean(measureError)}
            onClick={async () => {
              await addMeasurement(type, displayToCm(Number(measure), unit))
              setMeasure('')
              toast(`${typeLabel} saved.`)
            }}
          >
            Save
          </Button>
        </div>

        {summaries.length > 0 && (
          <ul className="mt-4 space-y-1" aria-label="Latest measurements">
            {summaries.map((s) => {
              const change = s.changeCm !== undefined ? cmToDisplay(s.changeCm, unit) : undefined
              return (
                <li
                  key={s.type}
                  className="flex items-center justify-between text-sm min-h-11 border-b border-dotted border-hairline"
                >
                  <span>
                    <span className="font-semibold capitalize">{s.type}</span> {cmToDisplay(s.latest.valueCm, unit)}{' '}
                    {lengthLabel}
                    {change !== undefined && change !== 0 && (
                      <span className="text-faint">
                        {' '}
                        ({change > 0 ? '+' : '−'}
                        {Math.abs(change)})
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="text-sm font-semibold text-danger min-h-11 px-2"
                    aria-label={`Delete latest ${s.type} measurement`}
                    onClick={async () => {
                      const row = s.latest
                      await db.bodyMeasurements.delete(row.id!)
                      toast('Measurement deleted', { label: 'Undo', onClick: () => void db.bodyMeasurements.put(row) })
                    }}
                  >
                    Delete
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Card>
  )
}
