import { expect, test } from '@playwright/test'
import { onboard } from './helpers'

test('the Log tab: water, check-in, habits and weight, then Home reflects them', async ({ page }) => {
  await onboard(page)
  await page.getByRole('link', { name: 'Log', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Log' })).toBeVisible()

  // Water: one tap adds, the ring text follows, undo takes it back out.
  await page.getByRole('button', { name: '+250 ml' }).click()
  await expect(page.getByRole('button', { name: 'Undo last entry (250 ml)' })).toBeVisible()
  await page.getByRole('button', { name: '+500 ml' }).click()
  await expect(page.getByRole('button', { name: 'Undo last entry (500 ml)' })).toBeVisible()
  await page.getByRole('button', { name: 'Undo last entry (500 ml)' }).click()
  await expect(page.getByRole('button', { name: 'Undo last entry (250 ml)' })).toBeVisible()

  // Check-in: the third answer saves it and shows a readiness hint.
  await page.getByRole('radio', { name: '8h', exact: true }).click()
  await page.getByRole('radio', { name: 'Fresh', exact: true }).click()
  await page.getByRole('radio', { name: 'High', exact: true }).click()
  await expect(page.getByTestId('readiness')).toContainText('Ready to push')

  // Habits: starters exist, toggling is reflected in the accessible name.
  await page.getByRole('checkbox', { name: 'Creatine, not done today' }).click()
  await expect(page.getByRole('checkbox', { name: 'Creatine, done today' })).toBeVisible()

  // Weight: one reading a day.
  await page.getByLabel(/Today.s weight/).fill('80.5')
  await page.getByRole('button', { name: 'Log', exact: true }).click()
  await expect(page.getByText(/Last: 80\.5 kg/)).toBeVisible()

  // Home shows the same data in its compact cards.
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Today’s readiness' })).toBeVisible()
  await expect(page.getByText('250 ml').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Habits today' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Creatine/ })).toHaveAttribute('aria-pressed', 'true')
})

test('History is reachable from Progress, and Progress stays lit in the nav', async ({ page }) => {
  await onboard(page)
  await page.getByRole('link', { name: 'Progress', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Progress sections' }).getByRole('link', { name: 'History' }).click()
  await page.waitForURL('**/history')
  await expect(page.getByRole('link', { name: 'Progress', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('water goal and reminders can be set in Profile', async ({ page }) => {
  await onboard(page)
  await page.getByRole('link', { name: 'Profile', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Daily goal (ml)' }).fill('3000')
  await page.getByRole('button', { name: 'Save', exact: true }).first().click()
  await expect(page.getByText(/Your goal is 3 L a day, set by you/)).toBeVisible()
  await page.getByRole('radio', { name: 'Every 3 h' }).click()
  await expect(page.getByRole('radio', { name: 'Every 3 h' })).toHaveAttribute('aria-checked', 'true')
})
