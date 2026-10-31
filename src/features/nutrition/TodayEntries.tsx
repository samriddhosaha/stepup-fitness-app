import { Star } from 'lucide-react'
import { useToast } from '../../components/toastContext'
import { Card, EmptyState } from '../../components/ui'
import { db } from '../../db/schema'
import { saveAsFavourite } from '../../lib/nutritionStore'
import { useNutritionToday } from '../../lib/useNutrition'

/** What was eaten today, oldest first. Delete is undoable; the star saves a favourite. */
export function TodayEntries() {
  const { data } = useNutritionToday()
  const toast = useToast()
  if (!data) return null

  return (
    <Card>
      <h2 className="label-eyebrow text-faint mb-3">Eaten today</h2>
      {data.logs.length === 0 ? (
        <EmptyState title="Nothing logged yet" body="Add what you eat. Protein first — it’s the number that matters most." />
      ) : (
        <ul>
          {data.logs.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 py-3 border-b border-dotted border-hairline last:border-0">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {entry.name}
                  {entry.servings !== 1 && entry.foodRef && <span className="text-faint font-normal"> × {entry.servings}</span>}
                </p>
                <p className="text-xs text-faint">
                  <span className="font-semibold text-ink">{entry.proteinG} g protein</span> · {entry.calories} kcal · C{' '}
                  {entry.carbsG} g · F {entry.fatG} g
                </p>
              </div>
              <button
                type="button"
                className="min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-line"
                aria-label={`Save ${entry.name} as a favourite`}
                onClick={async () => {
                  const id = await saveAsFavourite(entry)
                  toast('Saved to favourites', { label: 'Undo', onClick: () => void db.savedMeals.delete(id) })
                }}
              >
                <Star size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="text-sm font-semibold text-danger min-h-11 px-2"
                aria-label={`Delete ${entry.name}`}
                onClick={async () => {
                  await db.mealLogs.delete(entry.id!)
                  toast(`${entry.name} deleted`, { label: 'Undo', onClick: () => void db.mealLogs.put(entry) })
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
