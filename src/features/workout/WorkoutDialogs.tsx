import { ConfirmDialog, Dialog } from '../../components/overlays'
import { Button } from '../../components/ui'
import { SKIP_REASONS, type WorkoutPanel } from './constants'
import type { Exercise, SkipReason } from '../../db/types'

const optionClass =
  'w-full text-left font-semibold rounded-lg border border-line px-4 py-3 min-h-12 hover:bg-surface bg-elevated'

export function WorkoutDialogs({
  panel,
  close,
  substitutes,
  totalLogged,
  onSwap,
  onSkip,
  onSaveAndExit,
  onDiscard,
  onFinish,
}: {
  panel: WorkoutPanel
  close: () => void
  substitutes: Exercise[]
  totalLogged: number
  onSwap: (id: string) => void
  onSkip: (reason: SkipReason) => void
  onSaveAndExit: () => void
  onDiscard: () => void
  onFinish: () => void
}) {
  return (
    <>
      <Dialog open={panel === 'swap'} onClose={close} title="Same movement, kit you actually have">
        {substitutes.length === 0 ? (
          <p className="text-sm text-faint mb-4">There’s no close swap available with your equipment.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {substitutes.map((sub) => (
              <button key={sub.id} type="button" className={optionClass} onClick={() => onSwap(sub.id)}>
                {sub.name}
              </button>
            ))}
          </div>
        )}
        <Button variant="ghost" className="w-full" onClick={close}>
          Cancel
        </Button>
      </Dialog>

      <Dialog open={panel === 'skip'} onClose={close} title="Why skip this one?">
        <div className="space-y-2 mb-4">
          {SKIP_REASONS.map((r) => (
            <button key={r.value} type="button" className={optionClass} onClick={() => onSkip(r.value)}>
              {r.label}
            </button>
          ))}
          <button type="button" className="w-full text-left text-faint px-4 py-3 min-h-12" onClick={() => onSkip('unspecified')}>
            Skip without saying
          </button>
        </div>
        <Button variant="ghost" className="w-full" onClick={close}>
          Cancel
        </Button>
      </Dialog>

      <Dialog open={panel === 'leave'} onClose={close} title="Leave this workout?">
        <p className="text-sm text-faint mb-4">
          Save &amp; exit keeps everything logged so far. You can pick it up again from the dashboard.
        </p>
        <div className="flex flex-col gap-3">
          <Button onClick={onSaveAndExit}>Save &amp; exit</Button>
          <Button variant="danger" onClick={onDiscard}>
            Discard workout
          </Button>
          <Button variant="ghost" onClick={close}>
            Stay
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={panel === 'finish'}
        title="Finish now?"
        body={`${totalLogged} set${totalLogged === 1 ? '' : 's'} logged. Finishing early still counts.`}
        confirmLabel="Finish workout"
        cancelLabel="Keep going"
        onConfirm={onFinish}
        onCancel={close}
      />

      <ConfirmDialog
        open={panel === 'empty'}
        title="Nothing logged yet"
        body="A workout needs at least one set. Keep going, or discard this one."
        confirmLabel="Discard workout"
        cancelLabel="Keep going"
        danger
        onConfirm={onDiscard}
        onCancel={close}
      />
    </>
  )
}
