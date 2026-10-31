import { useLiveQuery } from 'dexie-react-hooks'
import { Check } from 'lucide-react'
import { Card } from '../../components/ui'
import { BADGE_GROUPS, computeBadges } from '../../lib/badges'
import { loadAchievementStats } from '../../lib/badgesStore'

/**
 * Milestones, grouped. Earned ones are marked with a tick and a word (not colour alone); the rest
 * show how far along they are. Nothing here can be lost.
 */
export function MilestonesCard() {
  const stats = useLiveQuery(loadAchievementStats, [])
  if (!stats) return null

  const badges = computeBadges(stats)
  const earned = badges.filter((b) => b.earned).length

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="label-eyebrow text-faint">Milestones</h2>
        <span className="text-sm font-semibold">
          {earned} of {badges.length}
        </span>
      </div>
      <div className="space-y-5">
        {BADGE_GROUPS.map((group) => (
          <section key={group} aria-label={group}>
            <h3 className="text-xs font-semibold text-faint mb-1">{group}</h3>
            <ul>
              {badges
                .filter((b) => b.group === group)
                .map((b) => (
                  <li key={b.id} className="py-2 border-b border-dotted border-hairline last:border-0">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={`shrink-0 w-7 h-7 rounded-full border border-line flex items-center justify-center ${
                          b.earned ? 'bg-accent text-on-accent' : 'bg-elevated'
                        }`}
                      >
                        {b.earned && <Check size={16} strokeWidth={3} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {b.title}
                          <span className="sr-only">{b.earned ? ', earned' : `, ${Math.round(b.progress * 100)} percent`}</span>
                        </p>
                        <p className="text-xs text-faint">{b.description}</p>
                      </div>
                    </div>
                    {!b.earned && b.progress > 0 && (
                      <div className="ml-10 mt-1.5 h-1.5 rounded-full border border-line overflow-hidden" aria-hidden="true">
                        <div className="h-full bg-accent" style={{ width: `${b.progress * 100}%` }} />
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  )
}
