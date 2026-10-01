import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

const SECTIONS = [
  {
    title: 'XP',
    body: 'You earn XP for logging sets, finishing exercises, completing workouts, and hitting personal records. Skipping an exercise or missing a workout never costs you XP.',
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
    body: 'Your plan is built from what you told us: goal, days available, equipment, and experience. The loads it suggests are a starting point — pick the weight that feels right for the rep range, and log what you actually lift.',
  },
  {
    title: 'Streaks',
    body: 'A streak counts consecutive scheduled workouts completed. Rest days never break it; a missed scheduled day ends it.',
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
      <h1 className="font-display font-semibold text-2xl md:text-3xl mb-8">How StepUp works</h1>
      <div>
        {SECTIONS.map((s) => (
          <div key={s.title} className="border-t-2 border-line py-5 first:pt-0">
            <p className="font-semibold mb-1">{s.title}</p>
            <p className="text-sm text-faint">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
