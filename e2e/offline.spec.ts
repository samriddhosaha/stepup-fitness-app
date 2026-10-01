import { expect, test } from '@playwright/test'
import { onboard } from './helpers'

// The one spec that needs the real service worker.
test.use({ serviceWorkers: 'allow' })

test('the app loads and works offline after the first visit', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), undefined, { timeout: 20_000 })

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()

  await onboard(page) // a full onboarding with no network at all
  await expect(page.getByText(/Jamie/)).toBeVisible()
})
