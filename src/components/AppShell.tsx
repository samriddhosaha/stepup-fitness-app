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
    <div className="min-h-screen flex flex-col bg-canvas">
      <main className="flex-1 pb-24 max-w-lg w-full mx-auto px-4 pt-6">
        <Outlet />
      </main>
      <nav
        className="fixed bottom-0 inset-x-0 bg-elevated border-t border-hairline max-w-lg mx-auto w-full"
        aria-label="Primary"
      >
        <ul className="flex justify-between px-2 py-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 min-h-12 justify-center rounded-xl mx-1 py-1.5 text-xs font-medium ${
                    isActive ? 'text-accent' : 'text-faint'
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
      <div className="max-w-lg w-full mx-auto px-4 py-6 min-h-screen flex flex-col">{children}</div>
    </div>
  )
}
