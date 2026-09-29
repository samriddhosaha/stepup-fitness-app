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

export function AppShell() {
  useReminderChecks()

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-canvas">
      {/* Desktop/tablet: persistent sidebar. Hidden below md, where the
          bottom tab bar (below) takes over. */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:border-r-2 md:border-ink md:sticky md:top-0 md:h-screen">
        <div className="px-6 py-7 border-b-2 border-ink">
          <span className="font-display font-bold text-2xl leading-none">StepUp</span>
        </div>
        <ul className="flex-1 py-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to} className="px-3">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 mb-1 text-sm font-bold border-2 ${
                    isActive
                      ? 'bg-accent text-white border-ink'
                      : 'border-transparent text-ink hover:border-ink'
                  }`
                }
              >
                <Icon size={20} strokeWidth={2.25} aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex-1 pb-24 md:pb-16 w-full max-w-lg md:max-w-5xl mx-auto px-4 md:px-12 pt-6 md:pt-12">
        <Outlet />
      </main>

      {/* Mobile: bottom tab bar. Hidden at md and above, where the sidebar
          (above) takes over. */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-elevated border-t-2 border-ink max-w-lg mx-auto w-full"
        aria-label="Primary"
      >
        <ul className="flex justify-between px-2 py-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 min-h-12 justify-center mx-1 py-1.5 text-xs font-bold border-2 ${
                    isActive ? 'bg-accent text-white border-ink' : 'border-transparent text-faint'
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
    <div className="min-h-screen bg-canvas">
      <div className="max-w-lg md:max-w-2xl w-full mx-auto px-4 md:px-8 py-6 md:py-12 min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  )
}
