import { expect, test } from '@playwright/test'
import { finishWorkoutThroughAllExercises, onboard, startWorkout } from './helpers'

test('after a workout: a summary picture is drawn on the device, and milestones and the heatmap reflect it', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => {
    // blob: and data: URLs are the on-device preview, not network traffic
    if (/^https?:/.test(r.url()) && !r.url().startsWith('http://localhost')) external.push(r.url())
  })

  await onboard(page)
  await startWorkout(page)
  await finishWorkoutThroughAllExercises(page)

  await page.getByRole('button', { name: 'Share summary' }).click()
  const image = page.getByTestId('share-image')
  await expect(image).toBeVisible()
  expect(await image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1080)
  await expect(page.getByText(/no name on it/)).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/progress/xp')
  await expect(page.getByRole('listitem').filter({ hasText: 'First workout' })).toContainText('earned')
  await expect(page.getByRole('listitem').filter({ hasText: 'Ten workouts' })).not.toContainText('earned')

  await page.goto('/progress')
  await expect(page.getByRole('img', { name: /Training days, last 12 weeks\. 1 workout across 1 of the last 12 weeks/ })).toBeVisible()

  expect(external, 'nothing should leave the device').toEqual([])
})
