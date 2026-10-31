import { expect, test, type Page } from '@playwright/test'
import { onboard } from './helpers'

async function turnOnCoach(page: Page) {
  await page.getByRole('link', { name: 'Profile', exact: true }).click()
  await page.getByRole('switch', { name: 'AI weekly coach' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Turn on' }).click()
  await expect(page.getByRole('switch', { name: 'AI weekly coach' })).toHaveAttribute('aria-checked', 'true')
}

test('nutrition and recovery are a separate, previewable opt-in, and turning the coach off resets it', async ({ page }) => {
  await onboard(page)
  await page.goto('/nutrition')
  await page.getByRole('radio', { name: 'Quick add' }).click()
  await page.getByLabel('Name (optional)').fill('Secret lunch')
  await page.getByLabel('Protein (g)').fill('30')
  await page.getByRole('button', { name: 'Add to today' }).click()
  await expect(page.getByText('Secret lunch')).toBeVisible()

  await turnOnCoach(page)
  const include = page.getByRole('switch', { name: 'Include nutrition and recovery in the AI coach' })
  await expect(include).toHaveAttribute('aria-checked', 'false')

  // Default: nothing about food in what is sent.
  await page.getByRole('button', { name: 'Preview what will be sent' }).click()
  const sent = page.getByLabel('Exact data sent to the AI coach')
  await expect(sent).toBeVisible()
  await expect(sent).not.toContainText('wellbeing')

  // Opting in needs its own consent, then the preview shows averages only (never the food name).
  await include.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Include' }).click()
  await expect(include).toHaveAttribute('aria-checked', 'true')
  await expect(sent).toContainText('"avgProteinG": 30')
  await expect(sent).not.toContainText('Secret lunch')

  // Off and on again must not quietly bring the extra data back.
  await page.getByRole('switch', { name: 'AI weekly coach' }).click()
  await page.getByRole('switch', { name: 'AI weekly coach' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Turn on' }).click()
  await expect(page.getByRole('switch', { name: 'Include nutrition and recovery in the AI coach' })).toHaveAttribute('aria-checked', 'false')
})

test('plan next week asks the server for the next-week focus', async ({ page }) => {
  const bodies: Record<string, unknown>[] = []
  await page.route('**/api/weekly-review', async (route) => {
    const body = route.request().postDataJSON() as { focus?: string }
    bodies.push(body)
    return route.fulfill({ json: { review: body.focus === 'next-week' ? 'Next week: hold the squat and add a rep.' : 'A steady week.' } })
  })

  await onboard(page)
  await turnOnCoach(page)
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await page.getByRole('button', { name: 'AI review' }).click()
  await expect(page.getByText('A steady week.')).toBeVisible()

  await page.getByRole('button', { name: 'Plan next week' }).click()
  await expect(page.getByText('Next week: hold the squat and add a rep.')).toBeVisible()
  expect(bodies.some((b) => b.focus === 'next-week')).toBe(true)
  expect(bodies.some((b) => b.focus === undefined)).toBe(true) // the usual review is unchanged
})

test('when the server is down, the local recap stays and both sections say so quietly', async ({ page }) => {
  await page.route('**/api/weekly-review', (route) => route.fulfill({ status: 502, json: { error: 'AI review unavailable' } }))

  await onboard(page)
  await turnOnCoach(page)
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await expect(page.getByText(/This week you completed/)).toBeVisible()
  await page.getByRole('button', { name: 'AI review' }).click()
  await expect(page.getByText(/AI review isn’t available right now/)).toBeVisible()
  await page.getByRole('button', { name: 'Plan next week' }).click()
  await expect(page.getByText(/plan for next week isn’t available right now/)).toBeVisible()
  await expect(page.getByText(/This week you completed/)).toBeVisible()
})
