import { lazy, Suspense, type ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/schema'
import { ThemeProvider } from './lib/theme'
import { AppShell, FullScreenShell } from './components/AppShell'

import Welcome from './routes/Welcome'
import Onboarding from './routes/Onboarding'
import PlanReady from './routes/PlanReady'
import Plan from './routes/Plan'
import Dashboard from './routes/Dashboard'
import Workout from './routes/Workout'
import WorkoutActive from './routes/WorkoutActive'
import WorkoutComplete from './routes/WorkoutComplete'
import ProgressXP from './routes/ProgressXP'
import History from './routes/History'
import Profile from './routes/Profile'
import ProfileEdit from './routes/ProfileEdit'
import Guide from './routes/Guide'

// Recharts pulls in a meaningful chunk of its own — split it off the main
// bundle so the core logging loop stays fast to load.
const Progress = lazy(() => import('./routes/Progress'))

// useLiveQuery returns `undefined` both while the query is still loading and
// when it has legitimately resolved to "no rows" — which is exactly the
// fresh-install case here (no profile yet). Coercing the resolved value to
// `null` makes those two states distinguishable.
function useOnboarded(): boolean | undefined {
  const profile = useLiveQuery(async () => (await db.profile.orderBy('createdAt').last()) ?? null)
  if (profile === undefined) return undefined
  return Boolean(profile?.onboardingCompleted)
}

function RequireOnboarded({ children }: { children: ReactElement }) {
  const onboarded = useOnboarded()
  if (onboarded === undefined) return null
  if (!onboarded) return <Navigate to="/welcome" replace />
  return children
}

function RedirectIfOnboarded({ children }: { children: ReactElement }) {
  const onboarded = useOnboarded()
  if (onboarded === undefined) return null
  if (onboarded) return <Navigate to="/dashboard" replace />
  return children
}

function RootRedirect() {
  const onboarded = useOnboarded()
  if (onboarded === undefined) return null
  return <Navigate to={onboarded ? '/dashboard' : '/welcome'} replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          <Route
            path="/welcome"
            element={
              <RedirectIfOnboarded>
                <FullScreenShell>
                  <Welcome />
                </FullScreenShell>
              </RedirectIfOnboarded>
            }
          />
          <Route
            path="/onboarding"
            element={
              <RedirectIfOnboarded>
                <FullScreenShell>
                  <Onboarding />
                </FullScreenShell>
              </RedirectIfOnboarded>
            }
          />
          <Route
            path="/plan-ready"
            element={
              <RequireOnboarded>
                <FullScreenShell>
                  <PlanReady />
                </FullScreenShell>
              </RequireOnboarded>
            }
          />

          <Route
            path="/workout"
            element={
              <RequireOnboarded>
                <FullScreenShell>
                  <Workout />
                </FullScreenShell>
              </RequireOnboarded>
            }
          />
          <Route
            path="/workout/active"
            element={
              <RequireOnboarded>
                <FullScreenShell>
                  <WorkoutActive />
                </FullScreenShell>
              </RequireOnboarded>
            }
          />
          <Route
            path="/workout/complete"
            element={
              <RequireOnboarded>
                <FullScreenShell>
                  <WorkoutComplete />
                </FullScreenShell>
              </RequireOnboarded>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <RequireOnboarded>
                <FullScreenShell>
                  <ProfileEdit />
                </FullScreenShell>
              </RequireOnboarded>
            }
          />
          <Route
            path="/guide"
            element={
              <RequireOnboarded>
                <FullScreenShell>
                  <Guide />
                </FullScreenShell>
              </RequireOnboarded>
            }
          />

          <Route
            element={
              <RequireOnboarded>
                <AppShell />
              </RequireOnboarded>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/plan" element={<Plan />} />
            <Route
              path="/progress"
              element={
                <Suspense fallback={null}>
                  <Progress />
                </Suspense>
              }
            />
            <Route path="/progress/xp" element={<ProgressXP />} />
            <Route path="/history" element={<History />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
