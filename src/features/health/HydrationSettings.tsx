import { useState } from 'react'
import { NumberField, SegmentedControl } from '../../components/forms'
import { useToast } from '../../components/toastContext'
import { Button, Card } from '../../components/ui'
import { db } from '../../db/schema'
import type { Profile } from '../../db/types'
import {
  WATER_GOAL_MAX_ML,
  WATER_GOAL_MIN_ML,
  WATER_GOAL_STEP_ML,
  WATER_REMINDER_END_HOUR,
  WATER_REMINDER_START_HOUR,
} from '../../lib/health'
import { notificationsSupported, requestNotificationPermission } from '../../lib/notifications'
import { formatMl, useWater } from '../../lib/useWater'
import { isInRange } from '../../lib/validation'

const REMINDER_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: '2', label: 'Every 2 h' },
  { value: '3', label: 'Every 3 h' },
  { value: '4', label: 'Every 4 h' },
]

const GOAL_RANGE = { min: WATER_GOAL_MIN_ML, max: WATER_GOAL_MAX_ML }

/** Daily water goal and optional on-device nudges. Reminders only fire while StepUp is open. */
export function HydrationSettings({ profile }: { profile: Profile }) {
  const toast = useToast()
  const { data } = useWater()
  const [goal, setGoal] = useState(String(profile.waterGoalMl ?? ''))
  const [notice, setNotice] = useState('')

  const goalValue = goal.trim() === '' ? null : Number(goal)
  const goalError =
    goalValue !== null && !isInRange(goalValue, GOAL_RANGE)
      ? `Enter a value between ${WATER_GOAL_MIN_ML} and ${WATER_GOAL_MAX_ML} ml.`
      : null
  const reminder = profile.waterReminderHours ? String(profile.waterReminderHours) : 'off'

  async function saveGoal() {
    if (goalValue === null || goalError) return
    await db.profile.update(profile.id!, { waterGoalMl: Math.round(goalValue) })
    toast('Water goal saved.')
  }

  async function useWeightGoal() {
    await db.profile.update(profile.id!, { waterGoalMl: undefined })
    setGoal('')
    toast('Using a goal based on your weight.')
  }

  async function setReminder(value: string) {
    if (value === 'off') {
      await db.profile.update(profile.id!, { waterReminderHours: undefined })
      setNotice('')
      return
    }
    await db.profile.update(profile.id!, { waterReminderHours: Number(value) })
    if (!notificationsSupported()) {
      setNotice('This browser can’t show notifications, so reminders won’t appear.')
    } else if ((await requestNotificationPermission()) !== 'granted') {
      setNotice('Notifications are blocked. Allow them in your browser settings for reminders to appear.')
    } else {
      setNotice('')
    }
  }

  return (
    <Card className="md:col-span-2">
      <h2 className="label-eyebrow text-faint mb-1">Hydration</h2>
      <p className="text-sm text-faint mb-4">
        {data
          ? `Your goal is ${formatMl(data.goalMl)} a day${data.isCustomGoal ? ', set by you' : ', worked out from your weight (about 35 ml per kg)'}.`
          : 'Loading…'}
      </p>

      <div className="flex gap-3 items-end">
        <div className="flex-1 min-w-0">
          <NumberField
            label="Daily goal (ml)"
            inputMode="numeric"
            stepper
            step={WATER_GOAL_STEP_ML}
            value={goal}
            onChange={setGoal}
            error={goalError}
            min={WATER_GOAL_MIN_ML}
            max={WATER_GOAL_MAX_ML}
            hint="Leave empty to use your weight."
          />
        </div>
        <Button variant="secondary" disabled={goalValue === null || Boolean(goalError)} onClick={saveGoal}>
          Save
        </Button>
      </div>
      {profile.waterGoalMl !== undefined && (
        <button
          type="button"
          className="text-sm font-semibold text-accent min-h-11 underline underline-offset-2 mt-1"
          onClick={useWeightGoal}
        >
          Use a goal based on my weight
        </button>
      )}

      <div className="mt-5">
        <SegmentedControl label="Water reminders" options={REMINDER_OPTIONS} value={reminder} onChange={setReminder} />
        <p className="text-xs text-faint mt-2">
          A gentle nudge between {WATER_REMINDER_START_HOUR}:00 and {WATER_REMINDER_END_HOUR}:00 while StepUp is open, and
          only if you haven’t logged a drink lately. Nothing leaves your device.
        </p>
        {notice && (
          <p role="status" className="text-sm font-semibold mt-2">
            {notice}
          </p>
        )}
      </div>
    </Card>
  )
}
