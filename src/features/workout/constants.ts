import type { SkipReason } from '../../db/types'

export const RPE_LABELS = ['Easy', 'Solid', 'Hard', 'Very hard', 'Max'] as const

export const SKIP_REASONS: { value: SkipReason; label: string }[] = [
  { value: 'too-difficult', label: 'Too difficult today' },
  { value: 'equipment-not-free', label: 'Equipment not free' },
  { value: 'discomfort-or-pain', label: 'Discomfort or pain' },
  { value: 'running-out-of-time', label: 'Running out of time' },
  { value: 'another-reason', label: 'Another reason' },
]

export type WorkoutPanel = null | 'swap' | 'skip' | 'leave' | 'finish' | 'empty' | 'pain'
