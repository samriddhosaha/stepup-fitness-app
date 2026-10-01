import { db } from '../db/schema'
import { getActivePlan } from '../db/schema'
import { getExerciseById, getSubstitutes } from '../db/exerciseLibrary'
import { daysAgoISO, parseISODateLocal } from './format'

const SKIP_REASON_LABELS: Record<string, string> = {
  'too-difficult': 'finding it too difficult',
  'equipment-not-free': 'equipment not being free',
  'discomfort-or-pain': 'discomfort',
  'running-out-of-time': 'running out of time',
  'another-reason': 'other reasons',
  unspecified: 'no stated reason',
}

export async function generateWeeklyRecap(): Promise<string> {
  const plan = await getActivePlan()
  const weekAgo = daysAgoISO(7)

  const sessions = await db.workoutSessions.where('date').aboveOrEqual(weekAgo).toArray()
  const completed = sessions.filter((s) => s.completedAt)
  const planned = plan?.sessions.length ?? completed.length

  const recentPRs = await db.personalRecords
    .filter((r) => !r.baseline && r.achievedAt >= parseISODateLocal(weekAgo).getTime())
    .toArray()

  const skipCounts = new Map<string, { count: number; reason: string }>()
  for (const s of sessions) {
    for (const skip of s.skips) {
      const key = skip.exerciseId
      const existing = skipCounts.get(key)
      skipCounts.set(key, { count: (existing?.count ?? 0) + 1, reason: skip.reason })
    }
  }

  let sentence = `This week you completed ${completed.length}/${planned} session${
    planned === 1 ? '' : 's'
  }`

  if (recentPRs.length > 0) {
    const names = recentPRs
      .map((pr) => getExerciseById(pr.exerciseId)?.name)
      .filter(Boolean)
      .join(', ')
    sentence += `, hit a PR on ${names}`
  }

  const topSkip = [...skipCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0]
  if (topSkip) {
    const [exerciseId, info] = topSkip
    const exercise = getExerciseById(exerciseId)
    const reasonLabel = SKIP_REASON_LABELS[info.reason] ?? info.reason
    sentence += `, and skipped ${exercise?.name ?? exerciseId} ${info.count} time${
      info.count === 1 ? '' : 's'
    } citing ${reasonLabel}`

    if (exercise) {
      const equipment = (await db.profile.orderBy('createdAt').last())?.equipment ?? []
      const substitute = getSubstitutes(exercise, equipment)[0]
      if (substitute) sentence += ` — consider swapping to ${substitute.name}`
    }
  }

  return sentence + '.'
}
