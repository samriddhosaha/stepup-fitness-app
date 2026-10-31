import { Link, useLocation } from 'react-router-dom'

const TABS = [
  { to: '/progress', label: 'Overview', match: (p: string) => p.startsWith('/progress') },
  { to: '/history', label: 'History', match: (p: string) => p.startsWith('/history') },
]

/** Progress and History are one area: History lives here rather than taking a nav slot. */
export function ProgressTabs() {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Progress sections" className="flex gap-2 mb-6">
      {TABS.map((t) => {
        const active = t.match(pathname)
        return (
          <Link
            key={t.to}
            to={t.to}
            aria-current={active ? 'page' : undefined}
            className={`rounded-lg px-4 min-h-12 text-sm font-semibold border border-line flex items-center justify-center ${
              active ? 'bg-accent text-on-accent' : 'bg-elevated text-ink hover:bg-surface'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
