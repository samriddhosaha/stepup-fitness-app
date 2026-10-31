import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, Chip } from '../../components/ui'
import { NumberField } from '../../components/forms'
import { db, setSetting } from '../../db/schema'
import type { WeightUnit } from '../../db/types'
import { BAR_OPTIONS, DEFAULT_BAR, DEFAULT_PLATES, calculatePlates, describePlates } from '../../lib/plates'

const trim = (n: number) => String(Math.round(n * 100) / 100)

/** Plate sizes get a proportional block so the stack reads at a glance. */
function PlateStack({ plates, unit }: { plates: number[]; unit: WeightUnit }) {
  const heaviest = DEFAULT_PLATES[unit][0] ?? 1
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      <div className="h-2 w-6 rounded-sm bg-ink" />
      {plates.map((p, i) => (
        <div
          key={i}
          className="w-3 rounded-sm border border-line bg-accent"
          style={{ height: `${Math.max(18, (p / heaviest) * 56)}px` }}
        />
      ))}
    </div>
  )
}

/**
 * "What do I put on the bar?" in the person's own unit. `target` is the weight field, so it opens
 * already answering for the set at hand; typing here changes the answer, not the field. The bar
 * choice is remembered on this device.
 */
export function PlateCalculator({ target, unit }: { target: number | null; unit: WeightUnit }) {
  const saved = useLiveQuery(async () => (await db.settings.get(`plateBar-${unit}`))?.value as number | undefined, [unit])
  const bar = saved ?? DEFAULT_BAR[unit]
  const [custom, setCustom] = useState<string | null>(null)
  const effectiveTarget = custom !== null ? Number(custom) : (target ?? 0)
  const valid = Number.isFinite(effectiveTarget) && effectiveTarget > 0
  const load = valid ? calculatePlates(effectiveTarget, bar, DEFAULT_PLATES[unit]) : null

  return (
    <Card className="mb-4" >
      <section aria-label="Plate calculator">
        <h2 className="label-eyebrow text-faint mb-3">Plate calculator</h2>

        <NumberField
          label={`Target (${unit})`}
          value={custom ?? (target ? trim(target) : '')}
          onChange={setCustom}
          step={unit === 'lb' ? 5 : 2.5}
          min={0}
        />

        <div className="flex items-center gap-2 my-4 flex-wrap" role="group" aria-label="Bar weight">
          <span className="text-sm font-semibold mr-1">Bar</span>
          {BAR_OPTIONS[unit].map((b) => (
            <Chip
              key={b}
              active={bar === b}
              aria-pressed={bar === b}
              onClick={() => void setSetting(`plateBar-${unit}`, b)}
            >
              {b} {unit}
            </Chip>
          ))}
        </div>

        {!load && <p className="text-sm text-faint">Enter a target weight.</p>}
        {load?.belowBar && (
          <p className="text-sm font-semibold">
            That’s lighter than the empty bar ({bar} {unit}).
          </p>
        )}
        {load && !load.belowBar && (
          <div>
            <p className="text-sm text-faint mb-1">Each side of the bar</p>
            <p className="text-xl font-display font-semibold mb-3" data-testid="plate-result">
              {describePlates(load.perSide)}
            </p>
            <PlateStack plates={load.perSide} unit={unit} />
            {load.shortBy > 0 && (
              <p className="text-xs text-faint mt-3">
                Closest with standard plates is {trim(load.achieved)} {unit} ({trim(load.shortBy)} {unit} short).
              </p>
            )}
          </div>
        )}
      </section>
    </Card>
  )
}
