import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getActivePlan } from '../db/schema'
import { getExerciseById } from '../db/exerciseLibrary'
import { findTodaysSession, startSession } from '../lib/workout'
import { computeStreak } from '../lib/streak'
import { generateWeeklyRecap } from '../lib/recap'
import { buildWeeklyReviewPayload, requestAIWeeklyReview } from '../lib/aiCoach'
import { track } from '../lib/analytics'
import { greetingForNow, startOfWeekISO } from '../lib/format'
import { Button, Card, WeekDots } from '../components/ui'

export default function Dashboard() {
  const navigate = useNavigate()
  const profile = useLiveQuery(() => db.profile.orderBy('createdAt').last())
  const plan = useLiveQuery(getActivePlan)
  const sessions = useLiveQuery(() => db.workoutSessions.toArray())
  const recentPR = useLiveQuery(async () => {
    const rows = await db.personalRecords
      .filter((r) => r.achievedAt >= Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toArray()
    return rows.sort((a, b) => a.achievedAt - b.achievedAt)
  })
  const [recap, setRecap] = useState<string | null>(null)
  const [recapIsFallback, setRecapIsFallback] = useState(false)
  const aiCoachEnabled = Boolean(profile?.aiCoachEnabled)

  useEffect(() => {
    let cancelled = false

    async function loadRecap() {
      if (aiCoachEnabled) {
        try {
          const payload = await buildWeeklyReviewPayload()
          const review = await requestAIWeeklyReview(payload)
          if (!cancelled) {
            setRecap(review)
            setRecapIsFallback(false)
          }
          return
        } catch {
          // Falls through to the rules-based recap below — network issues,
          // a missing/invalid key, or rate limits should never leave the
          // user with no recap at all.
        }
      }
      const ruleBased = await generateWeeklyRecap()
      if (!cancelled) {
        setRecap(ruleBased)
        setRecapIsFallback(aiCoachEnabled)
      }
    }

    loadRecap()
    return () => {
      cancelled = true
    }
  }, [sessions, aiCoachEnabled])

  if (!plan || !sessions) return null

  const activePlan = plan
  const todays = findTodaysSession(activePlan.sessions)
  const streak = computeStreak(activePlan, sessions)
  const doneThisWeek = sessions.filter(
    (s) => s.completedAt && s.date >= startOfWeekISO(),
  ).length
  const latestPR = recentPR?.[recentPR.length - 1]

  async function begin() {
    const target = todays ?? activePlan.sessions[0]
    await startSession(target)
    await track('workout_started', { session: target.name })
    navigate('/workout/active')
  }

  return (
    <div>
      <p className="text-sm text-faint mb-6">
        {greetingForNow()}
        {profile?.name ? `, ${profile.name}` : ''}
      </p>

      <div className="md:grid md:grid-cols-3 md:gap-8 space-y-6 md:space-y-0">
        {/* Main column */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            {todays ? (
              <>
                <p className="font-display font-bold text-2xl mb-1">{todays.name}</p>
                <p className="text-sm text-faint mb-4">Nothing to prove today. Just begin.</p>
                <Button className="w-full md:w-auto" onClick={begin}>
                  Start workout
                </Button>
              </>
            ) : (
              <>
                <p className="font-display font-bold text-2xl mb-1">Nothing scheduled.</p>
                <p className="text-sm text-faint mb-4">A rest day.</p>
                <Button
                  variant="secondary"
                  className="w-full md:w-auto"
                  onClick={() => navigate('/workout')}
                >
                  Train anyway
                </Button>
              </>
            )}
          </Card>

          {recap && (
            <Card>
              <p className="label-eyebrow text-faint mb-2">This week, in short</p>
              {recapIsFallback && (
                <p className="text-xs text-faint mb-2">
                  AI review unavailable this week — here's your recap instead.
                </p>
              )}
              <p className="text-sm">{recap}</p>
            </Card>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {streak > 0 && (
            <Card>
              <p className="label-eyebrow text-faint mb-1">Streak</p>
              <p className="font-display font-bold text-3xl">{streak}</p>
            </Card>
          )}

          <Card>
            <p className="label-eyebrow text-faint mb-3">This week</p>
            <WeekDots done={doneThisWeek} planned={activePlan.sessions.length} />
          </Card>

          {latestPR && (
            <Card className="bg-accent-soft">
              <p className="label-eyebrow text-faint mb-1">New personal best</p>
              <p className="text-sm font-bold">{getExerciseById(latestPR.exerciseId)?.name}</p>
            </Card>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Link to="/progress/xp" className="text-sm font-bold text-accent">
              XP & level →
            </Link>
            <Link to="/history" className="text-sm font-bold text-accent">
              Full history →
            </Link>
            <Link to="/guide" className="text-sm font-bold text-accent">
              How StepUp works →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
