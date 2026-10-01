import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useProfile } from '../db/repo'
import { db, getSetting, setSetting, wipeAllData } from '../db/schema'
import { getExerciseById } from '../db/exerciseLibrary'
import { useTheme } from '../lib/useTheme'
import { track } from '../lib/analytics'
import { buildWeeklyReviewPayload } from '../lib/aiCoach'
import {
  isStoragePersisted,
  requestPersistentStorage,
  shouldNudgeBackup,
  workoutsSinceBackup,
} from '../lib/storage'
import { Button, Card, Switch } from '../components/ui'
import { SegmentedControl } from '../components/forms'
import { ConfirmDialog } from '../components/overlays'
import { InstallCard } from '../components/InstallCard'
import { clearErrorLog, errorLogToText, isErrorLogEnabled, readErrorLog, setErrorLogEnabled } from '../lib/errorLog'
import { deliverFile } from '../lib/files'
import { APPEARANCE_OPTIONS, UNIT_OPTIONS, withLabel } from '../lib/options'
import type { Appearance, WeightUnit } from '../db/types'
import type { WeeklyReviewPayload } from '../lib/aiCoach'

const AI_COACH_CONSENT_COPY =
  'Your last 7 days of workout data (exercises, sets, skips and their reasons, personal bests and your body-weight trend) is sent to this app’s server, which passes it to Google’s Gemini API to write the review. StepUp doesn’t store it. Google and the hosting provider process it under their own policies. You can turn this off at any time.'

type ImportState =
  | { step: 'idle' }
  | { step: 'confirm'; backup: import('../lib/backup').Backup; summary: import('../lib/backup').BackupSummary }
  | { step: 'working' }

export default function Profile() {
  const profile = useProfile()
  const { appearance, setAppearance } = useTheme()
  const restSound = useLiveQuery(async () => Boolean((await db.settings.get('restSound'))?.value), [])
  const lastBackupAt = useLiveQuery(async () => (await getSetting<number>('lastBackupAt')) ?? null, [])
  const sinceBackup = useLiveQuery(workoutsSinceBackup, [])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [importState, setImportState] = useState<ImportState>({ step: 'idle' })
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingAICoach, setConfirmingAICoach] = useState(false)
  const [preview, setPreview] = useState<WeeklyReviewPayload | null>(null)
  const [persisted, setPersisted] = useState<boolean | undefined>(undefined)
  const [logOn, setLogOn] = useState(false)

  useEffect(() => {
    void isStoragePersisted().then(setPersisted)
    void isErrorLogEnabled().then(setLogOn)
  }, [])

  if (!profile) return null
  const activeProfile = profile

  async function updateAppearance(value: Appearance) {
    setAppearance(value)
    await db.profile.update(activeProfile.id!, { appearance: value })
  }

  async function updateWeightUnit(value: WeightUnit) {
    await db.profile.update(activeProfile.id!, { weightUnit: value })
  }

  async function setAICoachEnabled(enabled: boolean) {
    await db.profile.update(activeProfile.id!, { aiCoachEnabled: enabled })
    setConfirmingAICoach(false)
    if (!enabled) setPreview(null)
  }

  async function handleExport() {
    try {
      const { exportAllData } = await import('../lib/backup')
      const how = await exportAllData()
      await track('data_exported')
      setMessage(how === 'shared' ? 'Backup shared.' : 'Backup downloaded.')
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') setMessage('The export didn’t work. Please try again.')
    }
  }

  async function handleCsv() {
    try {
      const { exportSessionsCsv } = await import('../lib/backup')
      await exportSessionsCsv((id) => getExerciseById(id)?.name ?? id)
      setMessage('Workout history exported.')
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') setMessage('The export didn’t work. Please try again.')
    }
  }

  async function handlePickedFile(file: File) {
    const { importBackupFile } = await import('../lib/backup')
    const result = await importBackupFile(file)
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    setMessage(null)
    setImportState({ step: 'confirm', backup: result.backup, summary: result.summary })
  }

  async function confirmImport() {
    if (importState.step !== 'confirm') return
    const { backup } = importState
    setImportState({ step: 'working' })
    try {
      const { downloadSafetyCopy, applyBackup } = await import('../lib/backup')
      await downloadSafetyCopy() // a copy of what's here now, in case this isn't what they meant
      await applyBackup(backup)
      await track('data_imported')
      setMessage('Data restored. Reloading…')
      setTimeout(() => window.location.reload(), 800)
    } catch {
      setImportState({ step: 'idle' })
      setMessage('The import didn’t work, and your current data is unchanged.')
    }
  }

  async function showPreview() {
    setPreview(await buildWeeklyReviewPayload())
  }

  async function keepDataSafe() {
    setPersisted(await requestPersistentStorage())
  }

  async function handleDeleteAll() {
    await track('delete_all_data_invoked')
    try {
      const regs = await navigator.serviceWorker?.getRegistrations()
      await Promise.all((regs ?? []).map((r) => r.unregister()))
      const keys = await caches?.keys()
      await Promise.all((keys ?? []).map((k) => caches.delete(k)))
    } catch {
      /* best effort */
    }
    await wipeAllData()
    window.location.href = '/welcome'
  }

  const nudge = sinceBackup && shouldNudgeBackup(sinceBackup.count)

  return (
    <div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl mb-6">Profile</h1>

      <div className="space-y-6 md:space-y-0 md:grid md:grid-cols-2 md:gap-6 md:items-start">
        <Card className="md:col-span-2">
          <p className="font-semibold mb-1">{profile.name}</p>
          <p className="text-sm text-faint mb-3">
            {profile.daysPerWeek} days a week · {profile.sessionLengthMinutes} min sessions
          </p>
          <Link to="/profile/edit">
            <Button variant="secondary">Edit preferences</Button>
          </Link>
        </Card>

        <Card>
          <p className="label-eyebrow text-faint mb-3">Units</p>
          <SegmentedControl
            label="Weight unit"
            options={withLabel(UNIT_OPTIONS, 'short')}
            value={profile.weightUnit}
            onChange={updateWeightUnit}
          />
        </Card>

        <Card>
          <p className="label-eyebrow text-faint mb-3">Appearance</p>
          <SegmentedControl
            label="Appearance"
            options={withLabel(APPEARANCE_OPTIONS, 'short')}
            value={appearance}
            onChange={updateAppearance}
          />
        </Card>

        <Card className="md:col-span-2">
          <div className="flex items-center justify-between">
            <p className="label-eyebrow text-faint">Rest timer sound</p>
            <Switch label="Rest timer sound" checked={Boolean(restSound)} onChange={() => setSetting('restSound', !restSound)} />
          </div>
          <p className="text-sm text-faint mt-2">A soft chime when a rest ends. Your phone also buzzes where it can.</p>
        </Card>

        <Card className="md:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <p className="label-eyebrow text-faint">AI weekly coach</p>
            <Switch label="AI weekly coach" checked={Boolean(activeProfile.aiCoachEnabled)} onChange={() => (activeProfile.aiCoachEnabled ? setAICoachEnabled(false) : setConfirmingAICoach(true))} />
          </div>
          <p className="text-sm text-faint mt-2">
            Sends your last 7 days of training data to generate a written review. Off by default.
          </p>
          {(confirmingAICoach || activeProfile.aiCoachEnabled) && (
            <div className="mt-3">
              <Button variant="ghost" onClick={showPreview}>
                Preview what will be sent
              </Button>
              {preview && (
                <pre
                  aria-label="Exact data sent to the AI coach"
                  className="mt-3 max-h-64 overflow-auto rounded-lg border border-line bg-surface p-3 text-xs"
                >
                  {JSON.stringify(preview, null, 2)}
                </pre>
              )}
            </div>
          )}
          <ConfirmDialog
            open={confirmingAICoach}
            title="Turn on the AI weekly coach?"
            body={AI_COACH_CONSENT_COPY}
            confirmLabel="Turn on"
            onConfirm={() => setAICoachEnabled(true)}
            onCancel={() => setConfirmingAICoach(false)}
          />
        </Card>

        <Card className="md:col-span-2">
          <p className="label-eyebrow text-faint mb-2">Your data</p>
          <p className="text-sm text-faint mb-2">
            Everything lives on this device only. Back it up so a lost or reset device doesn't mean losing your history.
          </p>
          <p className="text-sm mb-1">
            Last backup:{' '}
            {lastBackupAt ? new Date(lastBackupAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'not yet'}
          </p>
          {nudge && (
            <p className="text-sm text-faint mb-2">
              You’ve done {sinceBackup.count} workouts since your last backup. A copy takes a few seconds.
            </p>
          )}
          <p className="text-sm text-faint mb-4">
            Storage:{' '}
            {persisted === undefined
              ? 'managed by your browser.'
              : persisted
                ? 'protected from automatic clean-up.'
                : 'your browser may clear it if the device runs low on space.'}{' '}
            {persisted === false && (
              <button className="font-semibold text-accent underline" onClick={keepDataSafe}>
                Ask to keep it
              </button>
            )}
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button variant="secondary" onClick={handleExport}>
              Export backup
            </Button>
            <Button variant="ghost" onClick={handleCsv}>
              Export history (CSV)
            </Button>
            <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
              Import backup
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="Choose a StepUp backup file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = '' // lets the same file be chosen again
                if (file) void handlePickedFile(file)
              }}
            />
          </div>

          <ConfirmDialog
            open={importState.step === 'confirm'}
            title="Replace your data with this backup?"
            body={
              importState.step === 'confirm' && (
                <>
                  {importState.summary.workouts} workout{importState.summary.workouts === 1 ? '' : 's'}
                  {importState.summary.firstDate && importState.summary.lastDate
                    ? `, ${importState.summary.firstDate} to ${importState.summary.lastDate}`
                    : ''}
                  {importState.summary.profileName ? ` · ${importState.summary.profileName}` : ''}. Exported{' '}
                  {new Date(importState.summary.exportedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}. A copy of
                  what’s here now downloads first.
                </>
              )
            }
            confirmLabel="Replace my data"
            onConfirm={confirmImport}
            onCancel={() => setImportState({ step: 'idle' })}
          />
          {importState.step === 'working' && <p className="text-sm text-faint mt-3">Restoring…</p>}
          {message && (
            <p role="status" className="text-sm text-faint mt-3">
              {message}
            </p>
          )}
        </Card>

        <InstallCard />

        <Card className="md:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <p className="label-eyebrow text-faint">Error log</p>
            <Switch label="Keep an error log on this device" checked={logOn} onChange={async () => {
                await setErrorLogEnabled(!logOn)
                setLogOn(!logOn)
              }} />
          </div>
          <p className="text-sm text-faint">
            Off by default. When on, technical errors are kept on this device only, so you can share them if you report a problem. Nothing is sent anywhere.
          </p>
          {logOn && (
            <div className="flex gap-3 mt-3">
              <Button
                variant="ghost"
                onClick={async () => {
                  await deliverFile(new Blob([errorLogToText(await readErrorLog())], { type: 'text/plain' }), 'stepup-error-log.txt', false)
                }}
              >
                Export log
              </Button>
              <Button variant="ghost" onClick={() => void clearErrorLog().then(() => setMessage('Error log cleared.'))}>
                Clear
              </Button>
            </div>
          )}
        </Card>

        <Link to="/guide" className="md:col-span-2 block text-sm font-semibold text-accent">
          How StepUp works
        </Link>

        <Card className="md:col-span-2 border-danger">
          <p className="label-eyebrow text-danger mb-2">Reset all data</p>
          <p className="text-sm text-faint mb-4">
            Consider exporting your data first. Deleting removes your profile, plan, history, and progress. This cannot be
            undone.
          </p>
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
            Delete everything
          </Button>
          <ConfirmDialog
            open={confirmingDelete}
            title="Delete everything?"
            body="This removes your profile, plan, history and progress from this device. It cannot be undone."
            confirmLabel="Yes, delete everything"
            danger
            onConfirm={handleDeleteAll}
            onCancel={() => setConfirmingDelete(false)}
          />
        </Card>
      </div>
    </div>
  )
}
