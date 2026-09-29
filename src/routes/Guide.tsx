import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

const SECTIONS = [
  {
    title: 'XP',
    body: 'You earn XP for logging sets, finishing exercises, completing workouts, and hitting personal records. Skipping an exercise or missing a workout costs a small, capped amount — never enough to wipe out a good week.',
  },
  {
    title: 'Levels and rank',
    body: 'XP adds up into levels, and levels roll up into a rank. Each level takes a bit more than the last. There’s no ceiling — just steady progress.',
  },
  {
    title: 'Rest days',
    body: 'Rest is part of the plan, not a break from it. Days with nothing scheduled are exactly that — nothing you’re behind on.',
  },
  {
    title: 'How your plan works',
    body: 'Your plan is built from what you told us: goal, days available, equipment, and experience. It adjusts your suggested load after every set based on how it actually went, using both what you lifted and how hard it felt.',
  },
  {
    title: 'Streaks',
    body: 'A streak counts consecutive scheduled workouts completed. Missing one changes nothing. Skipping the next one does.',
  },
]

export default function Guide() {
  const navigate = useNavigate()
  return (
    <div className="flex-1">
      <button
        className="flex items-center gap-1 text-sm text-faint mb-6 min-h-12"
        onClick={() => navigate(-1)}
      >
        <ChevronLeft size={18} /> Back
      </button>
      <h1 className="font-display text-2xl mb-6">How StepUp works</h1>
      <div className="space-y-6">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <p className="font-medium mb-1">{s.title}</p>
            <p className="text-sm text-faint">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
