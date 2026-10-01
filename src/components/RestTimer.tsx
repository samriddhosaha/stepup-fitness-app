import { useEffect, useRef, useState } from 'react'
import { formatDuration } from '../lib/format'
import { Button, Card } from './ui'

/** Soft two-tone chime; silent where WebAudio is unavailable. */
function chime() {
  try {
    const Ctx = window.AudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime
    for (const [i, freq] of [660, 880].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + i * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.15, now + i * 0.18 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.3)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.18)
      osc.stop(now + i * 0.18 + 0.32)
    }
    setTimeout(() => void ctx.close(), 800)
  } catch {
    /* no audio */
  }
}

/**
 * Countdown derived from an absolute end time, so it survives reloads, backgrounding and
 * a locked screen (a per-second setTimeout chain would drift or pause).
 */
export function RestTimer({
  endsAt,
  sound,
  onAdjust,
  onFinished,
  onSkip,
}: {
  endsAt: number
  sound: boolean
  onAdjust: (deltaSeconds: number) => void
  onFinished: () => void
  onSkip: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  const firedFor = useRef<number | null>(null)
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000))

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (remaining > 0 || firedFor.current === endsAt) return
    firedFor.current = endsAt
    // Only buzz/chime if the rest actually ended just now, not when reopening a long-expired one.
    if (Date.now() - endsAt < 5000) {
      navigator.vibrate?.([200, 100, 200])
      if (sound) chime()
    }
    onFinished()
  }, [remaining, endsAt, sound, onFinished])

  return (
    <Card className="mb-4">
      <p
        role="timer"
        aria-label="Rest timer"
        className="text-center text-3xl font-display font-semibold mb-3"
      >
        {formatDuration(remaining)}
      </p>
      <p className="sr-only" aria-live="polite">
        {remaining === 0 ? 'Rest over' : ''}
      </p>
      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={() => onAdjust(-15)}>
          −15s
        </Button>
        <Button variant="ghost" className="flex-1" onClick={() => onAdjust(15)}>
          +15s
        </Button>
        <Button variant="ghost" className="flex-1" onClick={onSkip}>
          Skip rest
        </Button>
      </div>
    </Card>
  )
}
