import { expect, type Page } from '@playwright/test'

export type Theme = 'light' | 'dark'

/** Pins the app theme before the first paint (the app reads this cache on load). */
export async function useTheme(page: Page, theme: Theme) {
  await page.addInitScript((t) => localStorage.setItem('stepup-appearance', t), theme)
}

/** The nine onboarding steps with sensible answers. `stopAt` lets a test inspect a given step. */
export async function onboard(page: Page, opts: { unit?: 'kg' | 'lb'; name?: string } = {}) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.getByLabel('Name').fill(opts.name ?? 'Jamie')
  await page.getByRole('button', { name: 'Continue' }).click()
  if (opts.unit) await page.getByRole('button', { name: opts.unit, exact: true }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: "I'm new to structured workouts" }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Build muscle' }).first().click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Dumbbells' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Build my plan' }).click()
  await expect(page.getByRole('heading', { name: 'Your plan is ready.' })).toBeVisible()
  await page.getByRole('button', { name: 'See my plan' }).click()
  await page.waitForURL('**/dashboard')
}

const startButton = (page: Page) => page.getByRole('button', { name: /^(Start workout|Train anyway)$/ }).first()

/** Starts a workout from the dashboard whether today is a training day or a rest day. */
export async function startWorkout(page: Page) {
  await startButton(page).click()
  if (page.url().endsWith('/workout')) await startButton(page).click()
  await expect(page.getByText(/Exercise 1 \//)).toBeVisible()
}

export async function logSet(page: Page, reps: string, opts: { weight?: string; rpe?: number } = {}) {
  if (opts.weight !== undefined) await page.getByLabel(/^Weight/).fill(opts.weight)
  await page.getByLabel('Reps', { exact: true }).fill(reps)
  if (opts.rpe) await page.getByRole('button', { name: new RegExp(`^RPE ${opts.rpe},`) }).click()
  await page.getByRole('button', { name: /^(Complete set|Add another set)$/ }).click()
}

/** Logs every planned set of the current exercise and moves on (or finishes). */
export async function completeExercise(page: Page, reps = '10') {
  for (let i = 0; i < 3; i += 1) {
    await logSet(page, reps, { rpe: 2 })
    await expect(page.getByRole('timer')).toBeVisible()
    await page.getByRole('button', { name: 'Skip rest' }).click()
  }
  await page.getByRole('button', { name: /^(Next exercise|Finish workout)$/ }).click()
}

export async function finishWorkoutThroughAllExercises(page: Page, reps = '10') {
  for (let i = 0; i < 8; i += 1) {
    if (await page.getByRole('heading', { name: 'Workout complete.' }).isVisible()) return
    await completeExercise(page, reps)
    await page.waitForTimeout(250)
  }
  await expect(page.getByRole('heading', { name: 'Workout complete.' })).toBeVisible()
}
