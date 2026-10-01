import { expect, type Page } from '@playwright/test'

export type Theme = 'light' | 'dark'

/** Pins the app theme before the first paint (the app reads this cache on load). */
export async function useTheme(page: Page, theme: Theme) {
  await page.addInitScript((t) => localStorage.setItem('stepup-appearance', t), theme)
}

/** The full onboarding with sensible answers (defaults: Mon/Wed/Fri, 45 minutes, dumbbells, no injuries). */
export async function onboard(page: Page, opts: { unit?: 'kg' | 'lb'; name?: string } = {}) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.getByLabel('Name').fill(opts.name ?? 'Jamie')
  await page.getByRole('button', { name: 'Continue' }).click()
  if (opts.unit) await page.getByRole('radio', { name: opts.unit, exact: true }).click()
  await page.getByLabel('Age').fill('30')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('radio', { name: "I'm new to structured workouts" }).click()
  await page.getByRole('button', { name: 'Continue' }).click() // level
  await page.getByRole('button', { name: 'Continue' }).click() // activity
  await page.getByRole('radio', { name: 'Build muscle' }).click()
  await page.getByRole('button', { name: 'Continue' }).click() // goals
  await page.getByRole('button', { name: 'Continue' }).click() // schedule
  await page.getByRole('button', { name: 'Dumbbells' }).click()
  await page.getByRole('button', { name: 'Continue' }).click() // equipment
  await page.getByRole('button', { name: 'Continue' }).click() // preferences
  await page.getByRole('button', { name: 'Continue' }).click() // health
  await page.getByRole('button', { name: 'Continue' }).click() // readiness
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
  // the form follows the exercise: weight + reps, reps only, seconds, or minutes
  const weight = page.getByLabel(/^Weight/)
  if ((await weight.count()) > 0) {
    if (opts.weight !== undefined) await weight.fill(opts.weight)
    else if ((await weight.inputValue()) === '') await weight.fill('10') // first time with a lift: calibrate
  }
  const repsField = page.getByLabel('Reps', { exact: true })
  const secondsField = page.getByLabel('Seconds', { exact: true })
  const minutesField = page.getByLabel('Minutes', { exact: true })
  if ((await repsField.count()) > 0) await repsField.fill(reps)
  else if ((await secondsField.count()) > 0) await secondsField.fill('40')
  else await minutesField.fill('15')
  if (opts.rpe) await page.getByRole('button', { name: new RegExp(`^RPE ${opts.rpe},`) }).click()
  await page.getByRole('button', { name: /^(Complete set|Add another set)$/ }).click()
}

const advanceButton = (page: Page) => page.getByRole('button', { name: /^(Next exercise|Done with this exercise|Finish workout)$/ })

/** Logs a set for the current exercise and moves on (or finishes). */
export async function completeExercise(page: Page, reps = '10') {
  await logSet(page, reps, { rpe: 2 })
  await expect(advanceButton(page)).toBeVisible()
  const skipRest = page.getByRole('button', { name: 'Skip rest' })
  if (await skipRest.isVisible()) await skipRest.click()
  await advanceButton(page).click()
}

export async function finishWorkoutThroughAllExercises(page: Page, reps = '10') {
  for (let i = 0; i < 12; i += 1) {
    if (await page.getByRole('heading', { name: 'Workout complete.' }).isVisible()) return
    await completeExercise(page, reps)
    await page.waitForTimeout(250)
  }
  await expect(page.getByRole('heading', { name: 'Workout complete.' })).toBeVisible()
}
