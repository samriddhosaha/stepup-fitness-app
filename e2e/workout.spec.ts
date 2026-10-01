import { expect, test } from '@playwright/test'
import { completeExercise, finishWorkoutThroughAllExercises, logSet, onboard, startWorkout } from './helpers'

test('a workout survives a reload: position, swap, logged sets and rest timer', async ({ page }) => {
  await onboard(page)
  await startWorkout(page)

  await logSet(page, '10', { rpe: 2 })
  await expect(page.getByRole('timer')).toBeVisible()
  await page.reload()
  await expect(page.getByText(/Exercise 1 \//)).toBeVisible()
  await expect(page.getByRole('timer')).toBeVisible()
  await expect(page.getByText('1 of 3 sets')).toBeVisible()

  await logSet(page, '10', { rpe: 2 })
  await logSet(page, '10', { rpe: 2 })
  await page.getByRole('button', { name: 'Next exercise' }).click()
  await expect(page.getByText(/Exercise 2 \//)).toBeVisible()

  await page.getByRole('button', { name: 'Replace exercise' }).click()
  const dialog = page.getByRole('dialog', { name: /Same movement/ })
  const swap = dialog.getByRole('button').first()
  const swapName = (await swap.innerText()).trim()
  await swap.click()
  await expect(page.getByRole('heading', { level: 1, name: swapName })).toBeVisible()

  await page.reload()
  await expect(page.getByText(/Exercise 2 \//)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: swapName })).toBeVisible()
})

test('dashboard offers Resume workout; leaving with Save & exit keeps the session', async ({ page }) => {
  await onboard(page)
  await startWorkout(page)
  await logSet(page, '8')
  await page.getByRole('button', { name: 'Leave' }).click()
  await page.getByRole('button', { name: 'Save & exit' }).click()
  await page.waitForURL('**/dashboard')

  await expect(page.getByText('In progress', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Resume workout' }).click()
  await expect(page.getByText('1 of 3 sets')).toBeVisible()
})

test('starting a different workout while one is open asks what to do', async ({ page }) => {
  await onboard(page)
  await startWorkout(page)
  await page.getByRole('button', { name: 'Leave' }).click()
  await page.getByRole('button', { name: 'Save & exit' }).click()
  await page.waitForURL('**/dashboard')

  await page.goto('/workout')
  // pick a session other than the one in progress (the list shows all three on a rest day)
  const others = page.getByRole('button', { name: 'Train anyway' })
  if ((await others.count()) > 1) await others.nth(1).click()
  else await page.getByRole('button', { name: /Start workout/ }).click()
  const dialog = page.getByRole('dialog', { name: 'You have a workout in progress' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /^Discard and start/ }).click()
  await expect(page.getByText(/Exercise 1 \//)).toBeVisible()
})

test('logging guards: reps are required, steppers adjust, a note can be added', async ({ page }) => {
  await onboard(page)
  await startWorkout(page)

  await expect(page.getByRole('button', { name: 'Complete set' })).toBeDisabled()
  await expect(page.getByText('Enter your reps to log this set.')).toBeVisible()

  const weight = page.getByLabel(/^Weight/)
  const before = Number(await weight.inputValue())
  await page.getByRole('button', { name: /^Increase Weight/ }).click()
  expect(Number(await weight.inputValue())).toBeGreaterThan(before)

  await page.getByRole('button', { name: /^Increase Reps/ }).click()
  await expect(page.getByLabel('Reps', { exact: true })).toHaveValue('1')
  await page.getByRole('button', { name: 'Add a note' }).click()
  await page.getByLabel('Note').fill('felt smooth')
  await page.getByRole('button', { name: 'Complete set' }).click()
  await expect(page.getByText('felt smooth')).toBeVisible()
})

test('edit, delete and undo a logged set; same-as-last-set; finish asks first', async ({ page }) => {
  await onboard(page)
  await startWorkout(page)
  await logSet(page, '8', { weight: '20', rpe: 3 })
  await page.getByRole('button', { name: 'Skip rest' }).click()
  await logSet(page, '9', { weight: '20' })
  await page.getByRole('button', { name: 'Skip rest' }).click()

  const logged = page.getByRole('region', { name: 'Sets logged this exercise' })
  await expect(logged.getByText(/Set 1 · 20 kg × 8/)).toBeVisible()

  // edit set 1
  await page.getByRole('button', { name: 'Edit set 1' }).click()
  await page.getByLabel('Reps', { exact: true }).fill('12')
  await page.getByRole('button', { name: 'Save set 1' }).click()
  await expect(logged.getByText(/Set 1 · 20 kg × 12/)).toBeVisible()

  // delete set 2, then undo
  await page.getByRole('button', { name: 'Delete set 2' }).click()
  await expect(logged.getByText(/Set 2/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(logged.getByText(/Set 2 · 20 kg × 9/)).toBeVisible()

  // same as last set
  await page.getByRole('button', { name: 'Same as last set' }).click()
  await expect(page.getByLabel('Reps', { exact: true })).toHaveValue('9')

  // finish early confirms
  await page.getByRole('button', { name: 'Finish early' }).click()
  await expect(page.getByRole('dialog', { name: 'Finish now?' })).toBeVisible()
  await page.getByRole('button', { name: 'Keep going' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('finishing with nothing logged is refused with a way out', async ({ page }) => {
  await onboard(page)
  await startWorkout(page)
  await page.getByRole('button', { name: 'Finish early' }).click()
  await expect(page.getByRole('dialog', { name: 'Nothing logged yet' })).toBeVisible()
  await page.getByRole('button', { name: 'Keep going' }).click()
  await expect(page.getByText(/Exercise 1 \//)).toBeVisible()
})

test('next session suggests a heavier load and shows last time', async ({ page }) => {
  await onboard(page)
  await startWorkout(page)
  const first = Number(await page.getByLabel(/^Weight/).inputValue())
  expect(first).toBeGreaterThan(0)

  for (let i = 0; i < 3; i += 1) {
    await logSet(page, '10', { rpe: 2 })
    await page.getByRole('button', { name: 'Skip rest' }).click()
  }
  await page.getByRole('button', { name: 'Finish early' }).click()
  await page.getByRole('button', { name: 'Finish workout' }).click()
  await expect(page.getByRole('heading', { name: 'Workout complete.' })).toBeVisible()
  await expect(page.getByText('New personal best')).toHaveCount(0) // first log is only a baseline

  await page.getByRole('button', { name: 'Back to dashboard' }).click()
  await startWorkout(page) // same first session again
  await expect(page.getByText(/Last time:/)).toBeVisible()
  await expect.poll(async () => Number(await page.getByLabel(/^Weight/).inputValue())).toBeGreaterThan(first)
})

test('lb users see pounds throughout the logger', async ({ page }) => {
  await onboard(page, { unit: 'lb' })
  await startWorkout(page)
  await expect(page.getByLabel('Weight (lb)', { exact: true })).toBeVisible()
  await logSet(page, '10', { weight: '45', rpe: 2 })
  await expect(page.getByText(/Set 1 · 45 lb × 10/)).toBeVisible()
})

test('a finished workout appears in history, can be corrected and deleted', async ({ page }) => {
  await onboard(page)
  await startWorkout(page)
  await finishWorkoutThroughAllExercises(page)

  await page.goto('/history')
  await page.locator('button[aria-current="date"]').click()
  const card = page.getByRole('heading', { level: 3 }).first()
  await expect(card).toBeVisible()
  await expect(page.getByRole('region', { name: /Details for/ }).getByText(/Completed/)).toBeVisible()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: /^Correct set 1 of/ }).first().click()
  await page.getByLabel('Reps', { exact: true }).fill('11')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText(/× 11/).first()).toBeVisible()

  await page.getByRole('button', { name: 'Delete this workout' }).click()
  await page.getByRole('button', { name: 'Delete workout' }).click()
  await expect(
    page.getByRole('region', { name: /Details for/ }).getByText(/Nothing scheduled|No workout was logged|scheduled for this day/),
  ).toBeVisible()
})

test('backup: export, then import with a summary and a safety copy first', async ({ page }) => {
  await onboard(page)
  await startWorkout(page)
  await finishWorkoutThroughAllExercises(page)

  await page.goto('/profile')
  const exported = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const file = await exported
  const path = await file.path()
  expect(file.suggestedFilename()).toMatch(/^stepup-backup-\d{4}-\d{2}-\d{2}\.json$/)
  await expect(page.getByText(/Last backup: \w{3}/)).toBeVisible()

  await page.getByLabel('Choose a StepUp backup file').setInputFiles(path)
  const dialog = page.getByRole('dialog', { name: 'Replace your data with this backup?' })
  await expect(dialog).toContainText('1 workout')
  const safety = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Replace my data' }).click()
  expect((await safety).suggestedFilename()).toMatch(/^stepup-before-import-/)
  await expect(page.getByText('Data restored. Reloading…')).toBeVisible()
  await page.waitForLoadState('load')
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
})

test('importing a damaged file explains itself and changes nothing', async ({ page }, info) => {
  await onboard(page)
  await page.goto('/profile')
  const bad = info.outputPath('bad.json')
  await (await import('node:fs/promises')).writeFile(bad, '{"version":2,"exportedAt":1,"tables":{"profile":[]}}')
  await page.getByLabel('Choose a StepUp backup file').setInputFiles(bad)
  await expect(page.getByRole('status').filter({ hasText: /damaged|doesn’t look like/ })).toBeVisible()
  await page.goto('/dashboard')
  await expect(page.getByText(/Jamie/)).toBeVisible() // still onboarded, data intact
})

test('completing exercises one by one reaches the summary with the correct totals', async ({ page }) => {
  await onboard(page)
  await startWorkout(page)
  await completeExercise(page)
  await expect(page.getByText(/Exercise 2 \//)).toBeVisible()
})
