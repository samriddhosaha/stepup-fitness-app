import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Dumbbell, LineChart, CalendarDays, UserRound } from 'lucide-react'
import { useReminderChecks } from '../lib/useReminderChecks'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/plan', label: 'Plan', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: LineChart },
  { to: '/history', label: 'History', icon: CalendarDays },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:border focus:border-line focus:bg-elevated focus:px-4 focus:py-3 focus:font-semibold"
    >
      Skip to content
    </a>
  )
}

export function AppShell() {
  useReminderChecks()

  return (
    <div className="min-h-dvh flex flex-col md:flex-row bg-canvas">
      <SkipLink />
      {/* Desktop/tablet: persistent sidebar. Hidden below md, where the
          bottom tab bar (below) takes over. */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:border-r md:border-line md:sticky md:top-0 md:h-dvh">
        <div className="px-6 py-7 border-b border-line">
          <span className="font-display font-semibold text-2xl leading-none">StepUp</span>
        </div>
        <nav aria-label="Primary" className="flex-1">
          <ul className="py-4">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <li key={to} className="px-3">
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 mb-1 rounded-lg text-sm font-semibold border ${
                      isActive ? 'bg-accent text-on-accent border-line' : 'border-transparent text-ink hover:border-line'
                    }`
                  }
                >
                  <Icon size={20} strokeWidth={2.25} aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main
        id="main"
        tabIndex={-1}
        className="flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-16 w-full max-w-lg md:max-w-5xl mx-auto px-4 md:px-12 pt-6 md:pt-12 outline-none"
      >
        <Outlet />
      </main>

      {/* Mobile: bottom tab bar. Hidden at md and above, where the sidebar
          (above) takes over. */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-elevated border-t border-line max-w-lg mx-auto w-full pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <ul className="flex justify-between px-2 py-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 min-h-12 justify-center mx-1 py-1.5 rounded-lg text-xs font-semibold border ${
                    isActive ? 'bg-accent text-on-accent border-line' : 'border-transparent text-faint'
                  }`
                }
              >
                <Icon size={22} strokeWidth={2} aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export function FullScreenShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <SkipLink />
      <main
        id="main"
        tabIndex={-1}
        className="max-w-lg md:max-w-2xl w-full mx-auto px-4 md:px-8 py-6 md:py-12 pb-[calc(1.5rem+env(safe-area-inset-bottom))] min-h-dvh flex flex-col outline-none"
      >
        {children}
      </main>
    </div>
  )
}
