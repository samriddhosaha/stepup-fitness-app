import { useEffect, useState } from 'react'
import { Button, Card } from '../../components/ui'
import { getExerciseById } from '../../db/exerciseLibrary'
import type { PersonalRecord, WorkoutSession } from '../../db/types'
import { deliverFile } from '../../lib/files'
import { buildSummaryCardData, CARD_HEIGHT, CARD_WIDTH, renderSummaryCard } from '../../lib/shareCard'
import { useUnit } from '../../lib/useUnit'

/**
 * "Share summary": draws a picture of the workout on a canvas, right here in the browser, shows
 * it, and only hands it to the share sheet (or downloads it) when asked. Nothing is uploaded and
 * no name is on the image.
 */
export function ShareCardPanel({
  session,
  records,
  streakLine,
}: {
  session: WorkoutSession
  records: PersonalRecord[]
  streakLine: string | null
}) {
  const unit = useUnit()
  const [open, setOpen] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let objectUrl: string | null = null
    renderSummaryCard(
      buildSummaryCardData({
        session,
        records,
        unit,
        streakLine,
        exerciseName: (id) => getExerciseById(id)?.name ?? id,
      }),
    )
      .then((result) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(result)
        setBlob(result)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setError('Couldn’t draw the picture on this device.')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, session, records, unit, streakLine])

  if (!open) {
    return (
      <Button
        variant="secondary"
        className="w-full mb-3"
        onClick={() => {
          // Start from a clean slate each time it's opened.
          setBlob(null)
          setUrl(null)
          setError(null)
          setMessage('')
          setOpen(true)
        }}
      >
        Share summary
      </Button>
    )
  }

  return (
    <Card className="mb-3">
      <section aria-label="Share your workout">
        <h2 className="label-eyebrow text-faint mb-3">Your summary</h2>
        {error && (
          <p role="alert" className="text-sm font-semibold text-danger mb-3">
            {error}
          </p>
        )}
        {url ? (
          <img
            src={url}
            alt={`Summary card for ${session.planSessionName}`}
            className="w-full rounded-lg border border-line mb-4"
            data-testid="share-image"
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
          />
        ) : (
          !error && <p className="text-sm text-faint mb-4">Drawing…</p>
        )}
        <p className="text-xs text-faint mb-3">
          Made on this device. It has no name on it, and nothing is uploaded unless you choose where to send it.
        </p>
        <div className="flex gap-3 flex-wrap">
          <Button
            className="flex-1"
            disabled={!blob}
            onClick={async () => {
              if (!blob) return
              try {
                const how = await deliverFile(blob, `stepup-${session.date}.png`, true)
                setMessage(how === 'shared' ? 'Shared.' : 'Saved to your downloads.')
              } catch {
                setMessage('') // the share sheet was dismissed
              }
            }}
          >
            Share or save
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
        <p role="status" className="text-sm text-faint mt-2 min-h-5">
          {message}
        </p>
      </section>
    </Card>
  )
}
