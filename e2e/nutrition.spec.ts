import { expect, test } from '@playwright/test'
import { onboard } from './helpers'

test('log food, quick-add, favourite it and set a protein target', async ({ page }) => {
  await onboard(page)
  await page.getByRole('link', { name: 'Log', exact: true }).click()
  await page.getByRole('link', { name: 'Add food' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Nutrition' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Log', exact: true })).toHaveAttribute('aria-current', 'page')

  // Search the built-in (Indian-friendly) list, scale servings, add.
  await page.getByLabel('Search foods').fill('paneer')
  await page.getByRole('button', { name: /^Paneer 100 g/ }).click()
  await expect(page.getByTestId('scaled-macros')).toContainText('265 kcal')
  await page.getByRole('spinbutton', { name: 'Servings' }).fill('2')
  await expect(page.getByTestId('scaled-macros')).toContainText('530 kcal · P 36 g')
  await page.getByRole('button', { name: 'Add to today' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Paneer × 2' }).filter({ hasText: '36 g protein' })).toBeVisible()

  // Quick add with protein only: calories are worked out from the macros.
  await page.getByRole('radio', { name: 'Quick add' }).click()
  await page.getByLabel('Protein (g)').fill('20')
  await page.getByRole('button', { name: 'Add to today' }).click()
  await expect(page.getByRole('progressbar', { name: /^Protein/ })).toHaveAttribute('aria-valuenow', '56')

  // Favourite an entry, then find it under Favourites.
  await page.getByRole('button', { name: 'Save Paneer as a favourite' }).click()
  await page.getByRole('radio', { name: 'Favourites' }).click()
  await expect(page.getByRole('list', { name: 'Favourites' })).toContainText('Paneer × 2')

  // A protein target of your own shows up on the bar.
  await page.getByRole('spinbutton', { name: /^Protein target/ }).fill('150')
  await expect(page.getByRole('progressbar', { name: 'Protein toward 150 g' })).toBeVisible()
  await expect(page.getByText(/not medical or dietary advice/)).toBeVisible()
})

test('deleting an entry can be undone', async ({ page }) => {
  await onboard(page)
  await page.goto('/nutrition')
  await page.getByRole('radio', { name: 'Quick add' }).click()
  await page.getByLabel('Name (optional)').fill('Office lunch')
  await page.getByLabel('Protein (g)').fill('30')
  await page.getByRole('button', { name: 'Add to today' }).click()
  await expect(page.getByText('Office lunch')).toBeVisible()
  await page.getByRole('button', { name: 'Delete Office lunch' }).click()
  await expect(page.getByText('Nothing logged yet').first()).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('Office lunch')).toBeVisible()
})
