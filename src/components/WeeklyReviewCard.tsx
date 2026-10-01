import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { generateWeeklyRecap } from '../lib/recap'
import { buildWeeklyReviewPayload, requestAIWeeklyReview } from '../lib/aiCoach'
import { canRefreshReview, currentWeekKey, getWeeklyReview } from '../lib/weeklyReview'
import { Button, Card, Skeleton } from './ui'

/**
 * Always shows the local, rules-based recap. When the AI coach is on, an explicit
 * "AI review" disclosure fetches (at most once per 6 h) instead of calling the model
 * on every dashboard visit. Failures fall back to the local recap with a clear note.
 */
export function WeeklyReviewCard({ aiEnabled }: { aiEnabled: boolean }) {
  const completedCount = useLiveQuery(() => db.workoutSessions.where('completedAt').above(0).count(), [])
  const cached = useLiveQuery(() => db.weeklyReviews.get(currentWeekKey()), [])
  const [recap, setRecap] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    generateWeeklyRecap().then((r) => {
      if (!cancelled) setRecap(r)
    })
    return () => {
      cancelled = true
    }
    // the dependency is a trigger (re-run on change), not a value the effect reads
    // oxlint-disable-next-line react/exhaustive-deps
  }, [completedCount])

  async function load(force: boolean) {
    setLoading(true)
    setFailed(false)
    try {
      await getWeeklyReview({
        buildPayload: buildWeeklyReviewPayload,
        fetchReview: requestAIWeeklyReview,
        force,
      })
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) void load(false)
  }

  if (!recap && !aiEnabled) return null

  const canRefresh = canRefreshReview(cached)

  return (
    <Card>
      <p className="label-eyebrow text-faint mb-2">This week, in short</p>
      {recap && <p className="text-sm">{recap}</p>}

      {aiEnabled && (
        <div className="mt-4 pt-4 border-t border-dotted border-hairline">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="ai-review"
            onClick={toggle}
            className="text-sm font-semibold text-accent min-h-12"
          >
            {open ? 'Hide AI review' : 'AI review'}
          </button>
          {open && (
            <div id="ai-review" className="mt-2" aria-live="polite">
              {loading && !cached ? (
                <div role="status" aria-label="Loading AI review" className="space-y-2">
                  <Skeleton className="h-4" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              ) : cached ? (
                <>
                  <p className="text-sm">{cached.text}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <Button variant="ghost" onClick={() => load(true)} disabled={!canRefresh || loading}>
                      {loading ? 'Refreshing…' : 'Refresh'}
                    </Button>
                    {!canRefresh && <span className="text-xs text-faint">Updated recently. Refresh opens up later.</span>}
                  </div>
                </>
              ) : null}
              {failed && (
                <p className="text-xs text-faint mt-2">
                  The AI review isn’t available right now, so your local recap above is all you’ll see.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
