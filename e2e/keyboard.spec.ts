import { expect, test } from '@playwright/test'
import { logSet, onboard, startWorkout } from './helpers'

test('skip link, route focus and a global focus ring', async ({ page }) => {
  await onboard(page)
  await page.goto('/dashboard')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()

  // moving to another route announces it: title from the h1 and focus on the heading
  await page.getByRole('link', { name: 'Progress' }).last().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeFocused()
  await expect(page).toHaveTitle('Progress · StepUp')

  // visible focus ring on a button
  await page.getByRole('link', { name: 'Profile' }).last().focus()
  const outline = await page.getByRole('link', { name: 'Profile' }).last().evaluate((el) => getComputedStyle(el).outlineWidth)
  expect(parseFloat(outline)).toBeGreaterThanOrEqual(3)
})

test('every control on the dashboard is reachable by Tab, with no trap', async ({ page }) => {
  await onboard(page)
  await page.goto('/dashboard')
  const reached = new Set<string>()
  let last = ''
  let repeats = 0
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab')
    const id = await page.evaluate(() => {
      const el = document.activeElement
      return el && el !== document.body ? `${el.tagName}:${el.getAttribute('aria-label') ?? el.textContent?.trim()}` : ''
    })
    if (id) reached.add(id)
    repeats = id === last ? repeats + 1 : 0
    last = id
    expect(repeats, `keyboard trap on ${id}`).toBeLessThan(3)
  }
  for (const name of ['Home', 'Plan', 'Progress', 'History', 'Profile']) {
    expect([...reached].some((r) => r.includes(name)), `${name} reachable`).toBe(true)
  }
})

test('dialogs trap focus, close with Escape and return focus to the opener', async ({ page }) => {
  await onboard(page)
  await startWorkout(page)
  await logSet(page, '8')
  const opener = page.getByRole('button', { name: 'Replace exercise' })
  await opener.focus()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: /Same movement/ })
  await expect(dialog).toBeVisible()
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab')
    // a modal dialog makes the rest of the page inert: focus is inside it, or has left the page entirely
    const ok = await page.evaluate(() => {
      const el = document.activeElement
      return el === document.body || Boolean(el?.closest('dialog'))
    })
    expect(ok, 'focus never reaches page content behind the dialog').toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})

test('a whole set can be logged with the keyboard alone', async ({ page }) => {
  await onboard(page)
  await startWorkout(page)
  await page.getByLabel('Reps', { exact: true }).focus()
  await page.keyboard.type('9')
  await page.keyboard.press('Enter') // submits the form
  await expect(page.getByText(/Set 1 ·/)).toBeVisible()
})

test('single-choice groups are radiogroups with arrow-key navigation', async ({ page }) => {
  await onboard(page)
  await page.goto('/profile')
  const units = page.getByRole('radiogroup', { name: 'Weight unit' })
  await expect(units.getByRole('radio', { name: 'kg' })).toBeChecked()
  await units.getByRole('radio', { name: 'kg' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(units.getByRole('radio', { name: 'lb' })).toBeChecked()
})

test('an unknown address shows a calm 404', async ({ page }) => {
  await page.goto('/definitely/not/here')
  await expect(page.getByRole('heading', { name: 'Page not found.' })).toBeVisible()
})
