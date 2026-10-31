/**
 * Milestones: a handful of meaningful, non-competitive markers. Each is a plain threshold on a
 * number we already track, so they're easy to explain and can never be "lost".
 */

export interface AchievementStats {
  completedWorkouts: number
  bestStreakWeeks: number
  recordCount: number
  lifetimeVolumeKg: number
  daysWithMeals: number
  checkIns: number
  hasBackedUp: boolean
}

export type BadgeGroup = 'Training' | 'Consistency' | 'Strength' | 'Health' | 'Safety'

export interface Badge {
  id: string
  group: BadgeGroup
  title: string
  description: string
  earned: boolean
  /** How far along, in the badge's own units. */
  current: number
  target: number
  /** 0..1 */
  progress: number
}

interface Definition {
  id: string
  group: BadgeGroup
  title: string
  description: string
  target: number
  value: (s: AchievementStats) => number
}

const TONNE = 1000

const DEFINITIONS: Definition[] = [
  { id: 'workouts-1', group: 'Training', title: 'First workout', description: 'Finish your first workout.', target: 1, value: (s) => s.completedWorkouts },
  { id: 'workouts-10', group: 'Training', title: 'Ten workouts', description: 'Finish 10 workouts.', target: 10, value: (s) => s.completedWorkouts },
  { id: 'workouts-25', group: 'Training', title: 'Twenty-five workouts', description: 'Finish 25 workouts.', target: 25, value: (s) => s.completedWorkouts },
  { id: 'workouts-50', group: 'Training', title: 'Fifty workouts', description: 'Finish 50 workouts.', target: 50, value: (s) => s.completedWorkouts },
  { id: 'workouts-100', group: 'Training', title: 'One hundred workouts', description: 'Finish 100 workouts.', target: 100, value: (s) => s.completedWorkouts },

  { id: 'streak-4', group: 'Consistency', title: 'Four steady weeks', description: 'Train in four weeks in a row. One quiet week is forgiven.', target: 4, value: (s) => s.bestStreakWeeks },
  { id: 'streak-8', group: 'Consistency', title: 'Eight steady weeks', description: 'Train in eight weeks in a row.', target: 8, value: (s) => s.bestStreakWeeks },
  { id: 'streak-12', group: 'Consistency', title: 'Twelve steady weeks', description: 'A full quarter of steady weeks.', target: 12, value: (s) => s.bestStreakWeeks },
  { id: 'streak-26', group: 'Consistency', title: 'Half a year steady', description: 'Twenty-six weeks in a row.', target: 26, value: (s) => s.bestStreakWeeks },

  { id: 'record-1', group: 'Strength', title: 'First personal best', description: 'Beat what you did in an earlier workout.', target: 1, value: (s) => s.recordCount },
  { id: 'record-10', group: 'Strength', title: 'Ten personal bests', description: 'Set 10 personal bests.', target: 10, value: (s) => s.recordCount },
  { id: 'volume-10t', group: 'Strength', title: 'Ten tonnes lifted', description: 'Add up 10 tonnes of weight lifted.', target: 10 * TONNE, value: (s) => s.lifetimeVolumeKg },
  { id: 'volume-50t', group: 'Strength', title: 'Fifty tonnes lifted', description: 'Add up 50 tonnes of weight lifted.', target: 50 * TONNE, value: (s) => s.lifetimeVolumeKg },
  { id: 'volume-100t', group: 'Strength', title: 'One hundred tonnes lifted', description: 'Add up 100 tonnes of weight lifted.', target: 100 * TONNE, value: (s) => s.lifetimeVolumeKg },

  { id: 'meals-7', group: 'Health', title: 'A week of meals', description: 'Log food on 7 different days.', target: 7, value: (s) => s.daysWithMeals },
  { id: 'checkins-7', group: 'Health', title: 'Seven check-ins', description: 'Do the daily recovery check-in 7 times.', target: 7, value: (s) => s.checkIns },

  { id: 'backup-1', group: 'Safety', title: 'Backed up', description: 'Export a backup of your data.', target: 1, value: (s) => (s.hasBackedUp ? 1 : 0) },
]

export function computeBadges(stats: AchievementStats): Badge[] {
  return DEFINITIONS.map((d) => {
    const current = d.value(stats)
    return {
      id: d.id,
      group: d.group,
      title: d.title,
      description: d.description,
      earned: current >= d.target,
      current,
      target: d.target,
      progress: Math.min(1, Math.max(0, current / d.target)),
    }
  })
}

export const BADGE_GROUPS: BadgeGroup[] = ['Training', 'Consistency', 'Strength', 'Health', 'Safety']
