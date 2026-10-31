import { useState } from 'react'
import { Link } from 'react-router-dom'
import { NumberField } from '../../components/forms'
import { useToast } from '../../components/toastContext'
import { Button, Card } from '../../components/ui'
import { WATER_CUSTOM_RANGE, WATER_QUICK_ML } from '../../lib/health'
import { addWater, removeWater } from '../../lib/healthStore'
import { formatMl, useWater } from '../../lib/useWater'
import { rangeErrorMessage } from '../../lib/validation'
import { WaterRing } from './WaterRing'

/**
 * Today's water. `compact` is the Home version (ring + one-tap +250 ml); the full version on
 * the Log tab adds every quick amount, a custom amount and undo.
 */
export function WaterCard({ compact = false }: { compact?: boolean }) {
  const { data } = useWater()
  const toast = useToast()
  const [custom, setCustom] = useState('')

  if (!data) return null
  const { totalMl, goalMl, fraction, last, isCustomGoal } = data
  const reached = totalMl >= goalMl

  async function add(ml: number) {
    const id = await addWater(ml)
    toast(`Added ${ml} ml.`, { label: 'Undo', onClick: () => void removeWater(id) })
  }

  const ring = (size: number) => (
    <WaterRing fraction={fraction} size={size} stroke={size > 110 ? 14 : 10}>
      <span className={`font-display font-bold leading-none ${size > 110 ? 'text-2xl' : 'text-lg'}`}>
        {formatMl(totalMl)}
      </span>
      <span className="text-xs text-faint mt-1">of {formatMl(goalMl)}</span>
    </WaterRing>
  )

  if (compact) {
    return (
      <Card>
        <div className="flex items-center gap-4">
          {ring(96)}
          <div className="min-w-0 flex-1">
            <h2 className="label-eyebrow text-faint mb-1">Water</h2>
            <p className="text-sm mb-3">
              {reached ? 'Goal reached. Nice and steady.' : `${formatMl(goalMl - totalMl)} to go today.`}
            </p>
            <div className="flex gap-2 flex-wrap items-center">
              <Button variant="secondary" className="px-4" onClick={() => add(250)}>
                +250 ml
              </Button>
              <Link to="/log" className="text-sm font-semibold text-accent min-h-11 inline-flex items-center px-1 underline underline-offset-2">
                More
              </Link>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const customError = rangeErrorMessage(custom, WATER_CUSTOM_RANGE, 'ml')

  return (
    <Card>
      <h2 className="label-eyebrow text-faint mb-4">Water</h2>
      <div className="flex items-center gap-5 mb-5">
        {ring(140)}
        <div>
          <p className="text-sm">
            {reached ? 'Goal reached — anything more is a bonus.' : `${formatMl(goalMl - totalMl)} to go.`}
          </p>
          <p className="text-xs text-faint mt-2">
            Goal {formatMl(goalMl)}
            {isCustomGoal ? ' (set by you)' : ' (from your weight)'} ·{' '}
            <Link to="/profile" className="font-semibold text-accent underline underline-offset-2">
              change
            </Link>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        {WATER_QUICK_ML.map((ml) => (
          <Button key={ml} variant="secondary" className="px-1 text-sm whitespace-nowrap" onClick={() => add(ml)}>
            +{ml} ml
          </Button>
        ))}
      </div>

      <div className="flex gap-3 mb-3 items-end">
        <div className="flex-1 min-w-0">
          <NumberField
            label="Custom amount (ml)"
            inputMode="numeric"
            value={custom}
            onChange={setCustom}
            error={customError}
            min={WATER_CUSTOM_RANGE.min}
            max={WATER_CUSTOM_RANGE.max}
          />
        </div>
        <Button
          variant="secondary"
          disabled={!custom || Boolean(customError)}
          onClick={async () => {
            await add(Math.round(Number(custom)))
            setCustom('')
          }}
        >
          Add
        </Button>
      </div>

      <Button
        variant="ghost"
        className="w-full"
        disabled={!last}
        onClick={async () => {
          if (!last?.id) return
          await removeWater(last.id)
          toast(`Removed ${last.ml} ml.`)
        }}
      >
        {last ? `Undo last entry (${last.ml} ml)` : 'Nothing to undo'}
      </Button>
    </Card>
  )
}
