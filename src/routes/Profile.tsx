import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, wipeAllData } from '../db/schema'
import { useTheme } from '../lib/theme'
import { exportAllData, importAllData } from '../lib/backup'
import { track } from '../lib/analytics'
import { Button, Card, PillChip } from '../components/ui'
import type { Appearance, WeightUnit } from '../db/types'

const AI_COACH_CONSENT_COPY =
  'Your last 7 days of workout data will be sent to generate this review. Nothing else is sent, and it isn’t stored.'

export default function Profile() {
  const profile = useLiveQuery(() => db.profile.orderBy('createdAt').last())
  const { appearance, setAppearance } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingAICoach, setConfirmingAICoach] = useState(false)

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
  }

  async function handleExport() {
    await exportAllData()
    await track('data_exported')
  }

  async function handleImportFile(file: File) {
    try {
      await importAllData(file)
      await track('data_imported')
      setImportMessage('Data restored. Reloading…')
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : 'Import failed.')
    }
  }

  async function handleDeleteAll() {
    await track('delete_all_data_invoked')
    await wipeAllData()
    window.location.href = '/welcome'
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Profile</h1>

      <Card>
        <p className="font-medium mb-1">{profile.name}</p>
        <p className="text-sm text-faint mb-3">
          {profile.daysPerWeek} days a week · {profile.sessionLengthMinutes} min sessions
        </p>
        <Link to="/profile/edit">
          <Button variant="secondary">Edit preferences</Button>
        </Link>
      </Card>

      <Card>
        <p className="font-medium mb-3">Units</p>
        <div className="flex gap-2">
          {(['kg', 'lb'] as WeightUnit[]).map((u) => (
            <PillChip key={u} active={profile.weightUnit === u} onClick={() => updateWeightUnit(u)}>
              {u}
            </PillChip>
          ))}
        </div>
      </Card>

      <Card>
        <p className="font-medium mb-3">Appearance</p>
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as Appearance[]).map((a) => (
            <PillChip key={a} active={appearance === a} onClick={() => updateAppearance(a)}>
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </PillChip>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-1">
          <p className="font-medium">AI weekly coach</p>
          <button
            role="switch"
            aria-label="AI weekly coach"
            aria-checked={Boolean(activeProfile.aiCoachEnabled)}
            onClick={() =>
              activeProfile.aiCoachEnabled ? setAICoachEnabled(false) : setConfirmingAICoach(true)
            }
            className={`w-12 h-7 rounded-pill relative transition-colors ${
              activeProfile.aiCoachEnabled ? 'bg-accent' : 'bg-hairline'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-elevated transition-transform ${
                activeProfile.aiCoachEnabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
        <p className="text-sm text-faint">
          Sends your last 7 days of training data to generate a written
          review. Off by default.
        </p>
        {confirmingAICoach && (
          <div className="mt-4 pt-4 border-t border-hairline">
            <p className="text-sm mb-3">{AI_COACH_CONSENT_COPY}</p>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirmingAICoach(false)}>
                Cancel
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setAICoachEnabled(true)}>
                Turn on
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <p className="font-medium mb-2">Your data</p>
        <p className="text-sm text-faint mb-4">
          Everything lives on this device only. Back it up so a lost or reset
          device doesn't mean losing your history.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleExport}>
            Export data
          </Button>
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
            Import data
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])}
          />
        </div>
        {importMessage && <p className="text-sm text-faint mt-3">{importMessage}</p>}
      </Card>

      <Link to="/guide" className="block text-sm text-accent">
        How Forge works
      </Link>

      <Card className="border-danger/30">
        <p className="font-medium mb-2">Reset all data</p>
        <p className="text-sm text-faint mb-4">
          Consider exporting your data first. Deleting removes your profile,
          plan, history, and progress. This cannot be undone.
        </p>
        {!confirmingDelete ? (
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
            Delete everything
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteAll}>
              Yes, delete everything
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
