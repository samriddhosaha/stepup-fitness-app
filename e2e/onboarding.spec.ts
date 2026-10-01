import { expect, test, type Page } from '@playwright/test'

const next = (page: Page) => page.getByRole('button', { name: 'Continue' }).click()

/** Answers name, age and level, leaving the person on the "activity" step. */
async function startFull(page: Page, name: string, age: string, level: string) {
  await page.goto('/onboarding')
  await page.getByLabel('Name').fill(name)
  await next(page)
  await page.getByLabel('Age').fill(age)
  await next(page)
  await page.getByRole('radio', { name: level }).click()
  await next(page)
}

test('a refresh in the middle of onboarding keeps your answers and your place', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.getByLabel('Name').fill('Riley')
  await next(page)
  await page.getByLabel('Age').fill('34')
  await next(page)
  await page.getByRole('radio', { name: "I've trained consistently for a while" }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
  await page.waitForTimeout(400) // the draft is saved as you go

  await page.reload()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
  await expect(page.getByRole('radio', { name: "I've trained consistently for a while" })).toBeChecked()
  await page.getByRole('button', { name: 'Previous step' }).click()
  await expect(page.getByLabel('Age')).toHaveValue('34')
  await page.getByRole('button', { name: 'Previous step' }).click()
  await expect(page.getByLabel('Name')).toHaveValue('Riley')
})

test('quick start asks three things and builds a plan', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^Quick start/ }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '3')
  await page.getByLabel('Name').fill('Quinn')
  await next(page)
  await page.getByRole('button', { name: 'Resistance bands' }).click()
  await next(page)
  await expect(page.getByText(/you confirm you.re 16 or older/)).toBeVisible()
  await page.getByRole('button', { name: 'Build my plan' }).click()
  await expect(page.getByRole('heading', { name: 'Your plan is ready.' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Your sessions' }).getByRole('listitem')).toHaveCount(3)
})

test('the age gate: under 13 is blocked, 13-15 need a guardian note, 16+ continue', async ({ page }) => {
  await page.goto('/onboarding')
  await page.getByLabel('Name').fill('Teen')
  await next(page)
  await page.getByLabel('Age').fill('12')
  await expect(page.getByText('StepUp is for ages 13 and up.').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()

  await page.getByLabel('Age').fill('14')
  await expect(page.getByText(/parent or guardian/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  await page.getByLabel(/A parent or guardian knows/).check()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()

  await page.getByLabel('Age').fill('16')
  await expect(page.getByLabel(/A parent or guardian knows/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
})

test('injuries, exclusions and chosen days really shape the plan', async ({ page }) => {
  await startFull(page, 'Sam', '45', 'I already work out regularly')
  await next(page) // activity
  await page.getByRole('radio', { name: 'Build muscle' }).click()
  await next(page) // goals
  // pick Tue/Thu/Sat instead of the default Mon/Wed/Fri
  for (const d of ['Monday', 'Wednesday', 'Friday', 'Tuesday', 'Thursday', 'Saturday']) await page.getByRole('button', { name: d }).click()
  await next(page) // schedule
  await page.getByRole('button', { name: 'Full gym' }).click()
  await next(page) // equipment
  await next(page) // preferences
  await page.getByRole('button', { name: 'Knees' }).click()
  await page.getByLabel(/rather not do/).fill('no pull ups')
  await next(page) // health
  await next(page) // readiness
  await expect(page.getByText(/Movements that commonly aggravate your knees are left out/)).toBeVisible()
  await expect(page.getByText(/Tuesday, Thursday, Saturday/)).toBeVisible()
  await page.getByRole('button', { name: 'Build my plan' }).click()
  await page.getByRole('button', { name: 'See my plan' }).click()

  await page.goto('/plan')
  await expect(page.getByRole('heading', { name: 'Your plan' })).toBeVisible()
  const text = await page.locator('main').innerText()
  expect(text).not.toMatch(/squat|lunge|leg press|pull-up|chin-up/i)
  for (const day of ['Tuesday', 'Thursday', 'Saturday']) expect(text).toContain(day)
})

test('a "yes" on a readiness question starts gently and says so', async ({ page }) => {
  await startFull(page, 'Alex', '50', "I've trained consistently for a while")
  await next(page) // activity
  await page.getByRole('radio', { name: 'Lift heavier over time' }).click()
  await next(page) // goals
  await next(page) // schedule
  await page.getByRole('button', { name: 'Full gym' }).click()
  await next(page) // equipment
  await next(page) // preferences
  await next(page) // health
  await page.getByRole('radiogroup', { name: /feel faint or dizzy/ }).getByRole('radio', { name: 'Yes' }).click()
  await expect(page.getByText('Thanks for telling us.')).toBeVisible()
  await next(page)
  await expect(page.getByText(/starts gently/)).toBeVisible()
})

async function buildBeginnerDumbbellPlan(page: Page, name: string) {
  await startFull(page, name, '30', "I'm new to structured workouts")
  await next(page) // activity
  await page.getByRole('radio', { name: 'Build muscle' }).click()
  await next(page) // goals
  await next(page) // schedule
  await page.getByRole('button', { name: 'Dumbbells' }).click()
  await next(page) // equipment
  for (let i = 0; i < 3; i += 1) await next(page) // preferences, health, readiness
  await page.getByRole('button', { name: 'Build my plan' }).click()
  await page.getByRole('button', { name: 'See my plan' }).click()
}

test('plan editing: swap, adjust and add an exercise of your own', async ({ page }) => {
  await buildBeginnerDumbbellPlan(page, 'Edit')
  await page.goto('/plan')
  await page.getByRole('button', { name: 'Edit plan' }).click()
  await expect(page.locator('main li').filter({ hasText: /Goblet Squat/ }).first()).toBeVisible()

  // swap
  await page.getByRole('button', { name: 'Swap Goblet Squat' }).first().click()
  const dialog = page.getByRole('dialog', { name: /Swap Goblet Squat/ })
  const option = dialog.getByRole('button').first()
  const swapped = (await option.innerText()).trim()
  await option.click()
  await expect(page.locator('main')).toContainText(swapped)

  // adjust sets
  await page.getByRole('button', { name: `Adjust ${swapped}` }).first().click()
  await page.getByLabel('Sets', { exact: true }).fill('4')
  await page.getByRole('button', { name: /^Save sets/ }).click()
  await expect(page.locator('main li').filter({ hasText: swapped }).first()).toContainText('4 ×')

  // create and add a custom exercise
  await page.getByRole('button', { name: 'Add an exercise' }).first().click()
  await page.getByRole('button', { name: 'Create your own' }).click()
  await page.getByRole('dialog', { name: /Create your own/ }).getByLabel('Name').fill('Sled Push')
  await page.getByRole('button', { name: 'Create and add' }).click()
  await expect(page.locator('main')).toContainText('Sled Push')
})

test('skipping for discomfort offers to stop suggesting that exercise', async ({ page }) => {
  await buildBeginnerDumbbellPlan(page, 'Ouch')

  await page.getByRole('button', { name: /^(Start workout|Train anyway)$/ }).first().click()
  if (page.url().endsWith('/workout')) await page.getByRole('button', { name: /^(Start workout|Train anyway)$/ }).first().click()
  await expect(page.getByText(/Exercise 1 \//)).toBeVisible()
  const name = (await page.getByRole('heading', { level: 1 }).innerText()).trim()

  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('button', { name: 'Discomfort or pain' }).click()
  await expect(page.getByRole('dialog', { name: new RegExp(`Stop suggesting ${name}`) })).toBeVisible()
  await page.getByRole('button', { name: /^Replace it with/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(name)

  await page.goto('/profile/edit')
  await expect(page.getByText(name, { exact: true })).toBeVisible() // listed under "Exercises you asked not to see"
  await page.goto('/plan')
  await expect(page.locator('main')).not.toContainText(name)
})
