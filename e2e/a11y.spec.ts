import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { finishWorkoutThroughAllExercises, logSet, onboard, startWorkout, useTheme, type Theme } from './helpers'

async function expectNoSeriousViolations(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(
    serious.map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`),
    `axe on ${where}`,
  ).toEqual([])
}

for (const theme of ['light', 'dark'] as Theme[]) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await useTheme(page, theme)
    })

    test('welcome and every onboarding step', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'StepUp' })).toBeVisible()
      await expectNoSeriousViolations(page, 'welcome')

      await page.getByRole('button', { name: 'Get started' }).click()
      const answers: Record<number, () => Promise<void>> = {
        1: () => page.getByLabel('Name').fill('Casey'),
        2: () => page.getByLabel('Age').fill('30'),
        3: () => page.getByRole('radio', { name: "I'm new to structured workouts" }).click(),
        5: () => page.getByRole('radio', { name: 'Build muscle' }).click(),
        7: () => page.getByRole('button', { name: 'Dumbbells' }).click(),
      }
      for (let step = 1; step <= 11; step += 1) {
        await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(step))
        await answers[step]?.()
        await expectNoSeriousViolations(page, `onboarding step ${step}`)
        await page.getByRole('button', { name: step === 11 ? 'Build my plan' : 'Continue' }).click()
      }
      await expect(page.getByRole('heading', { name: 'Your plan is ready.' })).toBeVisible()
      await expectNoSeriousViolations(page, 'plan ready')
    })

    test('app screens, active workout, history and profile', async ({ page }) => {
      await onboard(page)
      for (const route of ['/dashboard', '/plan', '/progress', '/progress/xp', '/history', '/profile', '/profile/edit', '/guide']) {
        await page.goto(route)
        await expect(page.locator('main h1').first()).toBeVisible()
        await expectNoSeriousViolations(page, route)
      }

      await page.goto('/dashboard')
      await startWorkout(page)
      await expectNoSeriousViolations(page, 'active workout')

      await logSet(page, '10', { weight: '12', rpe: 2 })
      await expect(page.getByRole('timer')).toBeVisible()
      await expectNoSeriousViolations(page, 'active workout with rest timer')

      await page.getByRole('button', { name: 'Replace exercise' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expectNoSeriousViolations(page, 'swap dialog')
      await page.keyboard.press('Escape')

      await page.getByRole('button', { name: 'Finish early' }).click()
      await page.getByRole('button', { name: 'Finish workout' }).click()
      await expect(page.getByRole('heading', { name: 'Workout complete.' })).toBeVisible()
      await expectNoSeriousViolations(page, 'workout complete')

      await page.goto('/history')
      await page.locator('button[aria-current="date"]').click()
      await expectNoSeriousViolations(page, 'history with a day open')
    })

    test('charts with data (progress)', async ({ page }) => {
      await onboard(page)
      await startWorkout(page)
      await finishWorkoutThroughAllExercises(page)
      await page.goto('/progress')
      await expect(page.getByRole('heading', { name: 'Weekly training volume' })).toBeVisible()
      await expectNoSeriousViolations(page, 'progress with data')
    })
  })
}
