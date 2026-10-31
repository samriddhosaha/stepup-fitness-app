import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NumberField, SegmentedControl } from '../../components/forms'
import { useToast } from '../../components/toastContext'
import { Button, Card, Chip, TextField } from '../../components/ui'
import { db } from '../../db/schema'
import { CATEGORY_LABELS, FOOD_LIBRARY, type FoodItem } from '../../db/foodLibrary'
import {
  CALORIES_RANGE,
  FOOD_APPROX_NOTE,
  MACRO_G_RANGE,
  SERVINGS_RANGE,
  foodFromCustom,
  resolveQuickAdd,
  scaleMacros,
  searchFoods,
} from '../../lib/nutrition'
import { createCustomFood, listFavourites, logFood, logQuickAdd, logSavedMeal } from '../../lib/nutritionStore'
import { rangeErrorMessage } from '../../lib/validation'

type Tab = 'foods' | 'quick' | 'favourites'

const TABS: { value: Tab; label: string }[] = [
  { value: 'foods', label: 'Foods' },
  { value: 'quick', label: 'Quick add' },
  { value: 'favourites', label: 'Favourites' },
]

type MacroFields = { calories: string; proteinG: string; carbsG: string; fatG: string }
const EMPTY_FIELDS: MacroFields = { calories: '', proteinG: '', carbsG: '', fatG: '' }

const macroLine = (m: { calories: number; proteinG: number; carbsG: number; fatG: number }) =>
  `${m.calories} kcal · P ${m.proteinG} g · C ${m.carbsG} g · F ${m.fatG} g`

/** The four macro inputs, protein first. Leaving calories blank works them out from the rest. */
function MacroInputs({ fields, onChange }: { fields: MacroFields; onChange: (next: MacroFields) => void }) {
  const set = (key: keyof MacroFields) => (value: string) => onChange({ ...fields, [key]: value })
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField label="Protein (g)" value={fields.proteinG} onChange={set('proteinG')} error={rangeErrorMessage(fields.proteinG, MACRO_G_RANGE, 'g')} />
      <NumberField label="Calories" value={fields.calories} onChange={set('calories')} error={rangeErrorMessage(fields.calories, CALORIES_RANGE, 'kcal')} />
      <NumberField label="Carbs (g)" value={fields.carbsG} onChange={set('carbsG')} error={rangeErrorMessage(fields.carbsG, MACRO_G_RANGE, 'g')} />
      <NumberField label="Fat (g)" value={fields.fatG} onChange={set('fatG')} error={rangeErrorMessage(fields.fatG, MACRO_G_RANGE, 'g')} />
    </div>
  )
}

function CustomFoodForm({ onCreated, onCancel }: { onCreated: (f: FoodItem) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [serving, setServing] = useState('')
  const [fields, setFields] = useState<MacroFields>(EMPTY_FIELDS)
  const resolved = resolveQuickAdd(fields)
  const canSave = name.trim() !== '' && resolved.ok

  return (
    <Card className="mb-4 bg-surface">
      <h3 className="font-semibold mb-3">New food</h3>
      <div className="space-y-3">
        <TextField label="Name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="One serving is…"
          maxLength={40}
          placeholder="e.g. 1 bowl (200 g)"
          value={serving}
          onChange={(e) => setServing(e.target.value)}
          hint="Enter the numbers for one serving. Leave calories blank to work them out from the macros."
        />
        <MacroInputs fields={fields} onChange={setFields} />
      </div>
      <div className="flex gap-3 mt-4">
        <Button
          className="flex-1"
          disabled={!canSave}
          onClick={async () => {
            if (!resolved.ok) return
            const created = await createCustomFood({ name, servingLabel: serving, ...resolved.macros })
            onCreated(foodFromCustom(created))
          }}
        >
          Save food
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  )
}

function FoodsTab({ onAdded }: { onAdded: (message: string) => void }) {
  const toast = useToast()
  const customFoods = useLiveQuery(() => db.foods.toArray(), [])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<FoodItem | null>(null)
  const [servings, setServings] = useState('1')
  const [creating, setCreating] = useState(false)

  const allFoods = useMemo(() => [...(customFoods ?? []).map(foodFromCustom), ...FOOD_LIBRARY], [customFoods])
  const results = useMemo(() => searchFoods(query, allFoods), [query, allFoods])
  const servingsNumber = Number(servings)
  const servingsError = rangeErrorMessage(servings, SERVINGS_RANGE, 'servings')
  const validServings = servings.trim() !== '' && !servingsError && Number.isFinite(servingsNumber)

  function pick(food: FoodItem) {
    setSelected(food)
    setServings('1')
    setCreating(false)
  }

  return (
    <div>
      <TextField
        label="Search foods"
        type="search"
        placeholder="Try “paneer”, “dal”, “egg”"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex gap-2 flex-wrap my-4">
        {Object.values(CATEGORY_LABELS).map((label) => (
          <Chip
            key={label}
            className="px-3"
            active={query === label}
            aria-pressed={query === label}
            onClick={() => setQuery(query === label ? '' : label)}
          >
            {label}
          </Chip>
        ))}
      </div>

      {creating && (
        <CustomFoodForm
          onCancel={() => setCreating(false)}
          onCreated={(food) => {
            setCreating(false)
            pick(food)
          }}
        />
      )}

      {selected && (
        <Card className="mb-4 bg-accent-soft" data-testid="selected-food">
          <p className="font-semibold">{selected.name}</p>
          <p className="text-xs text-faint mb-3">
            Per {selected.serving} — {macroLine(selected)}
          </p>
          <NumberField label="Servings" stepper centered step={0.5} min={SERVINGS_RANGE.min} max={SERVINGS_RANGE.max} value={servings} onChange={setServings} error={servingsError} />
          {validServings && (
            <p className="text-sm font-semibold mt-3" data-testid="scaled-macros">
              = {macroLine(scaleMacros(selected, servingsNumber))}
            </p>
          )}
          <div className="flex gap-3 mt-4 flex-wrap">
            <Button
              className="flex-1"
              disabled={!validServings}
              onClick={async () => {
                await logFood(selected, servingsNumber)
                onAdded(`Added ${selected.name}${servingsNumber !== 1 ? ` × ${servingsNumber}` : ''}.`)
                setSelected(null)
              }}
            >
              Add to today
            </Button>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            {selected.id.startsWith('custom:') && (
              <Button
                variant="ghost"
                onClick={async () => {
                  const id = Number(selected.id.slice('custom:'.length))
                  const row = await db.foods.get(id)
                  await db.foods.delete(id)
                  setSelected(null)
                  if (row) toast(`${row.name} deleted`, { label: 'Undo', onClick: () => void db.foods.put(row) })
                }}
              >
                Delete food
              </Button>
            )}
          </div>
        </Card>
      )}

      <ul className="space-y-2" aria-label="Foods">
        {results.map((food) => (
          <li key={food.id}>
            <button
              type="button"
              onClick={() => pick(food)}
              aria-pressed={selected?.id === food.id}
              className="w-full text-left min-h-14 rounded-lg border border-line px-3 py-2 bg-elevated hover:bg-surface aria-pressed:bg-accent-soft"
            >
              <span className="font-semibold block">
                {food.name}
                {food.id.startsWith('custom:') && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider border border-line rounded px-1.5 py-0.5 align-middle">mine</span>
                )}
              </span>
              <span className="text-xs text-faint">
                {food.serving} · {food.calories} kcal · {food.proteinG} g protein
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && (
          <li className="text-sm text-faint py-4">
            Nothing matches “{query}”. Try another word, create your own food, or use Quick add.
          </li>
        )}
      </ul>

      <div className="mt-4">
        <Button variant="ghost" onClick={() => setCreating(true)} disabled={creating}>
          Create a custom food
        </Button>
      </div>
      <p className="text-xs text-faint mt-3">{FOOD_APPROX_NOTE}</p>
    </div>
  )
}

function QuickAddTab({ onAdded }: { onAdded: (message: string) => void }) {
  const [name, setName] = useState('')
  const [fields, setFields] = useState<MacroFields>(EMPTY_FIELDS)
  const resolved = resolveQuickAdd(fields)
  const empty = Object.values(fields).every((v) => v.trim() === '')

  return (
    <div className="space-y-3">
      <p className="text-sm text-faint">Know the numbers but not the food? Type what you have. Protein alone is fine.</p>
      <TextField label="Name (optional)" maxLength={60} placeholder="e.g. Office lunch" value={name} onChange={(e) => setName(e.target.value)} />
      <MacroInputs fields={fields} onChange={setFields} />
      <p className="text-xs text-faint">Leave calories blank and they’ll be worked out from the macros.</p>
      <Button
        className="w-full"
        disabled={empty || !resolved.ok}
        onClick={async () => {
          if (!resolved.ok) return
          await logQuickAdd(resolved.macros, name)
          onAdded(
            resolved.caloriesEstimated
              ? `Added ${resolved.macros.calories} kcal (worked out from your macros).`
              : `Added ${resolved.macros.calories} kcal.`,
          )
          setName('')
          setFields(EMPTY_FIELDS)
        }}
      >
        Add to today
      </Button>
      {!empty && !resolved.ok && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {resolved.error}
        </p>
      )}
    </div>
  )
}

function FavouritesTab({ onAdded }: { onAdded: (message: string) => void }) {
  const toast = useToast()
  const meals = useLiveQuery(() => listFavourites(), [])
  if (!meals) return null

  if (meals.length === 0) {
    return (
      <p className="text-sm text-faint">
        No favourites yet. Tap the star beside anything you’ve logged to save it here for one-tap logging next time.
      </p>
    )
  }

  return (
    <ul className="space-y-2" aria-label="Favourites">
      {meals.map((meal) => (
        <li key={meal.id} className="rounded-lg border border-line bg-elevated p-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{meal.name}</p>
            <p className="text-xs text-faint">{macroLine(meal)}</p>
          </div>
          <Button
            variant="secondary"
            className="px-4"
            onClick={async () => {
              await logSavedMeal(meal)
              onAdded(`Added ${meal.name}.`)
            }}
          >
            Add
          </Button>
          <button
            type="button"
            className="text-sm font-semibold text-danger min-h-11 px-2"
            aria-label={`Delete favourite ${meal.name}`}
            onClick={async () => {
              await db.savedMeals.delete(meal.id!)
              toast(`${meal.name} removed`, { label: 'Undo', onClick: () => void db.savedMeals.put(meal) })
            }}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Add food to today: search the built-in and custom foods, type raw numbers, or tap a favourite. */
export function AddFoodPanel() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('foods')

  return (
    <Card>
      <h2 className="label-eyebrow text-faint mb-3">Add food</h2>
      <SegmentedControl label="How to add food" options={TABS} value={tab} onChange={setTab} className="mb-4" />

      {tab === 'foods' && <FoodsTab onAdded={toast} />}
      {tab === 'quick' && <QuickAddTab onAdded={toast} />}
      {tab === 'favourites' && <FavouritesTab onAdded={toast} />}
    </Card>
  )
}
