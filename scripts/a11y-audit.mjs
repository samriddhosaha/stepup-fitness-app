import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const BASE = 'http://localhost:5173'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 420, height: 860 } })
const page = await context.newPage()

async function onboard() {
  await page.goto(BASE)
  await page.waitForSelector('text=Get started')
  await page.click('text=Get started')
  await page.waitForSelector('text=What should we call you?')
  await page.fill('input:not([type])', 'Casey')
  await page.click('text=Continue')
  await page.waitForSelector('text=A few basics')
  await page.click('text=Continue')
  await page.click("text=I'm new to structured workouts")
  await page.click('text=Continue')
  await page.click('text=Continue')
  await page.click('text=Build muscle')
  await page.click('text=Continue')
  await page.click('text=Continue')
  await page.click('text=Dumbbells')
  await page.click('text=Continue')
  await page.click('text=Continue')
  await page.click('text=Build my plan')
  await page.waitForSelector('text=Your plan is ready.')
  await page.click('text=See my plan')
  await page.waitForURL('**/dashboard')
}

async function runAxe(label) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  const violations = results.violations
  console.log(`\n=== ${label} — ${violations.length} violation(s) ===`)
  for (const v of violations) {
    console.log(`[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`)
    for (const node of v.nodes.slice(0, 3)) {
      console.log('    target:', node.target.join(' '))
    }
  }
  return violations
}

const allViolations = {}

// Pre-onboarding routes
await page.goto(`${BASE}/welcome`)
await page.waitForSelector('text=Get started')
allViolations['/welcome'] = await runAxe('/welcome')

await page.click('text=Get started')
await page.waitForSelector('text=What should we call you?')
allViolations['/onboarding (step 1)'] = await runAxe('/onboarding (step 1)')

await onboard()

const routes = [
  '/dashboard',
  '/plan',
  '/progress',
  '/progress/xp',
  '/history',
  '/profile',
  '/profile/edit',
  '/guide',
  '/workout',
]
for (const route of routes) {
  await page.goto(`${BASE}${route}`)
  await page.waitForTimeout(600)
  allViolations[route] = await runAxe(route)
}

// Workout active screen
await page.goto(`${BASE}/dashboard`)
await page.waitForTimeout(300)
await page.locator('button:has-text("Start workout"), button:has-text("Train anyway")').first().click()
await page.waitForURL(/\/workout(\/active)?$/, { timeout: 5000 })
if (!page.url().includes('/workout/active')) {
  // Landed on the /workout overview (rest-day case) instead of straight
  // into the session — its own start button needs a second click.
  await page.locator('button:has-text("Start workout"), button:has-text("Train anyway")').first().click()
  await page.waitForURL('**/workout/active', { timeout: 5000 })
}
await page.waitForSelector('text=Exercise 1 /')
allViolations['/workout/active'] = await runAxe('/workout/active')

const totalCritical = Object.values(allViolations)
  .flat()
  .filter((v) => v.impact === 'critical' || v.impact === 'serious').length

console.log(`\nTOTAL critical+serious violations across all routes: ${totalCritical}`)

await browser.close()
process.exit(totalCritical > 0 ? 1 : 0)
