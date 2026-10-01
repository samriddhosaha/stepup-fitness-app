import { lazy, Suspense, type ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/schema'
import { ThemeProvider } from './lib/theme'
import { ToastProvider } from './components/overlays'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RouteA11y } from './components/RouteA11y'
import { UpdatePrompt } from './components/UpdatePrompt'
import { PageSkeleton } from './components/ui'
import { AppShell, FullScreenShell } from './components/AppShell'

import Welcome from './routes/Welcome'
import Dashboard from './routes/Dashboard'
import Workout from './routes/Workout'
import WorkoutActive from './routes/WorkoutActive'
import WorkoutComplete from './routes/WorkoutComplete'
import NotFound from './routes/NotFound'

// Secondary screens load on demand so the first paint ships less JavaScript.
const Onboarding = lazy(() => import('./routes/Onboarding'))
const PlanReady = lazy(() => import('./routes/PlanReady'))
const Plan = lazy(() => import('./routes/Plan'))
const ProgressXP = lazy(() => import('./routes/ProgressXP'))
const History = lazy(() => import('./routes/History'))
const Profile = lazy(() => import('./routes/Profile'))
const ProfileEdit = lazy(() => import('./routes/ProfileEdit'))
const Guide = lazy(() => import('./routes/Guide'))
const ExerciseHistory = lazy(() => import('./routes/ExerciseHistory'))

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
  if (onboarded === undefined) return <PageSkeleton label="Loading StepUp" />
  if (!onboarded) return <Navigate to="/welcome" replace />
  return children
}

function RedirectIfOnboarded({ children }: { children: ReactElement }) {
  const onboarded = useOnboarded()
  if (onboarded === undefined) return <PageSkeleton label="Loading StepUp" />
  if (onboarded) return <Navigate to="/dashboard" replace />
  return children
}

function RootRedirect() {
  const onboarded = useOnboarded()
  if (onboarded === undefined) return <PageSkeleton label="Loading StepUp" />
  return <Navigate to={onboarded ? '/dashboard' : '/welcome'} replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
      <ErrorBoundary>
      <BrowserRouter>
        <RouteA11y />
        <UpdatePrompt />
        <Suspense fallback={<PageSkeleton label="Loading" />}>
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
            <Route path="/progress" element={<Progress />} />
            <Route path="/progress/xp" element={<ProgressXP />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/exercise/:id" element={<ExerciseHistory />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      </ErrorBoundary>
      </ToastProvider>
    </ThemeProvider>
  )
}
