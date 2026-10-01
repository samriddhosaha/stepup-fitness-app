import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getActivePlan } from '../db/schema'
import { getExerciseById } from '../db/exerciseLibrary'
import { discardSession, findTodaysSession, getInProgressSession, todayWeekdayIndex } from '../lib/workout'
import { activeWeeksInARow, completedThisWeek } from '../lib/consistency'
import { estimateSessionMinutes } from '../lib/plan'
import { isRealPR } from '../lib/records'
import { greetingForNow, todayISODate } from '../lib/format'
import { Button, Card, PageSkeleton, WeekDots } from '../components/ui'
import { WeeklyReviewCard } from '../components/WeeklyReviewCard'
import { useStartWorkout } from '../components/StartWorkout'
import type { PlanSession } from '../db/types'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** The next scheduled session after today (wrapping into next week), for a preview. */
function nextSessionAfterToday(sessions: PlanSession[], todayIndex: number): PlanSession | undefined {
  return [...sessions]
    .sort((a, b) => ((a.dayIndex - todayIndex + 6) % 7) - ((b.dayIndex - todayIndex + 6) % 7))
    .find((s) => s.dayIndex !== todayIndex)
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { begin, dialog } = useStartWorkout()
  const profile = useLiveQuery(() => db.profile.orderBy('createdAt').last())
  const plan = useLiveQuery(getActivePlan)
  const sessions = useLiveQuery(() => db.workoutSessions.toArray())
  const inProgress = useLiveQuery(async () => (await getInProgressSession()) ?? null)
  const recentPR = useLiveQuery(async () => {
    const rows = await db.personalRecords.filter((r) => isRealPR(r) && r.achievedAt >= Date.now() - WEEK_MS).toArray()
    return rows.sort((a, b) => a.achievedAt - b.achievedAt)
  })

  if (!plan || !sessions || inProgress === undefined) return <PageSkeleton label="Loading your dashboard" />

  const activePlan = plan
  const today = todayISODate()
  const todays = findTodaysSession(activePlan.sessions)
  const todayDone = Boolean(todays && sessions.some((s) => s.completedAt && s.date === today && s.planSessionName === todays.name))
  const weeksInARow = activeWeeksInARow(sessions, today)
  const doneThisWeek = completedThisWeek(sessions, today)
  const latestPR = recentPR?.[recentPR.length - 1]
  const upNext = todays ? undefined : nextSessionAfterToday(activePlan.sessions, todayWeekdayIndex())

  return (
    <div>
      <p className="text-sm text-faint mb-6">
        {greetingForNow()}
        {profile?.name ? `, ${profile.name}` : ''}
      </p>

      {dialog}

      {inProgress && (
        <Card className="mb-6 bg-accent-soft">
          <p className="label-eyebrow text-faint mb-1">In progress</p>
          <p className="font-display font-semibold text-xl mb-3">{inProgress.planSessionName}</p>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => navigate('/workout/active')}>Resume workout</Button>
            <Button variant="ghost" onClick={() => discardSession(inProgress.id!)}>
              Discard
            </Button>
          </div>
        </Card>
      )}

      <div className="md:grid md:grid-cols-3 md:gap-8 space-y-6 md:space-y-0">
        {/* Main column */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            {todays && !todayDone ? (
              <>
                <p className="font-display font-semibold text-2xl mb-1">{todays.name}</p>
                <p className="text-sm text-faint mb-1">Nothing to prove today. Just begin.</p>
                <p className="text-xs text-faint mb-4">
                  {todays.exercises.length} exercises · about {estimateSessionMinutes(todays)} min
                </p>
                <Button className="w-full md:w-auto" onClick={() => begin(todays)} disabled={Boolean(inProgress)}>
                  Start workout
                </Button>
              </>
            ) : todays ? (
              <>
                <p className="font-display font-semibold text-2xl mb-1">{todays.name} is done.</p>
                <p className="text-sm text-faint mb-4">That’s today taken care of.</p>
                <Button variant="secondary" className="w-full md:w-auto" onClick={() => navigate('/workout')}>
                  Train anyway
                </Button>
              </>
            ) : (
              <>
                <p className="font-display font-semibold text-2xl mb-1">Nothing scheduled.</p>
                <p className="text-sm text-faint mb-4">A rest day.</p>
                {upNext && (
                  <p className="text-xs text-faint mb-4">
                    Next up: {upNext.name} · {upNext.exercises.length} exercises · about{' '}
                    {estimateSessionMinutes(upNext)} min
                  </p>
                )}
                <Button variant="secondary" className="w-full md:w-auto" onClick={() => navigate('/workout')}>
                  Train anyway
                </Button>
              </>
            )}
          </Card>

          <WeeklyReviewCard aiEnabled={Boolean(profile?.aiCoachEnabled)} />
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {weeksInARow > 0 && (
            <Card>
              <p className="label-eyebrow text-faint mb-1">Consistency</p>
              <p className="font-display font-semibold text-3xl">
                {weeksInARow} {weeksInARow === 1 ? 'week' : 'weeks'}
              </p>
              <p className="text-xs text-faint mt-1">of showing up. One quiet week never counts against you.</p>
            </Card>
          )}

          <Card>
            <p className="label-eyebrow text-faint mb-3">This week</p>
            <WeekDots done={doneThisWeek} planned={activePlan.sessions.length} />
          </Card>

          {latestPR && (
            <Card className="bg-accent-soft">
              <p className="label-eyebrow text-faint mb-1">New personal best</p>
              <p className="text-sm font-semibold">{getExerciseById(latestPR.exerciseId)?.name}</p>
            </Card>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Link to="/progress/xp" className="text-sm font-semibold text-accent">
              XP & level →
            </Link>
            <Link to="/history" className="text-sm font-semibold text-accent">
              Full history →
            </Link>
            <Link to="/guide" className="text-sm font-semibold text-accent">
              How StepUp works →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
