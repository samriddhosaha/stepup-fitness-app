import { chromium } from 'playwright'

const errors = []
const shotsDir = process.argv[2] || '.'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 860 } })
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push('pageerror: ' + err.message))

async function shot(name) {
  await page.screenshot({ path: `${shotsDir}/${name}.png` })
}

await page.goto('http://localhost:5173')
await page.waitForSelector('text=Get started', { timeout: 15000 })
await page.waitForTimeout(700); await shot('01-welcome')

await page.click('text=Get started')
await page.waitForSelector('text=What should we call you?')

// Step 1: name
await page.fill('input[type="text"], input:not([type])', 'Alex')
await page.click('text=Continue')

// Step 2: age/sex/height/weight - skip, just continue
await page.waitForSelector('text=A few basics')
await page.click('text=Continue')

// Step 3: fitness level
await page.waitForSelector("text=I'm new to structured workouts")
await page.click("text=I'm new to structured workouts")
await page.click('text=Continue')

// Step 4: current activity - skip
await page.waitForSelector('text=I already lift weights')
await page.click('text=Continue')

// Step 5: goals
await page.waitForSelector('text=Build muscle')
await page.click('text=Build muscle')
await page.click('text=Continue')

// Step 6: days/session length - defaults fine
await page.waitForSelector('text=Days per week')
await page.click('text=Continue')

// Step 7: equipment
await page.waitForSelector('text=Dumbbells')
await page.click('text=Dumbbells')
await page.click('text=Continue')

// Step 8: preferences - skip
await page.waitForSelector('text=Anything you enjoy?')
await page.click('text=Continue')

// Step 9: exclusions/injuries + disclaimer
await page.waitForSelector('text=Anything to work around?')
await page.waitForTimeout(700); await shot('02-onboarding-step9')
await page.click('text=Build my plan')

await page.waitForSelector('text=Your plan is ready.', { timeout: 15000 })
await page.waitForTimeout(700); await shot('03-plan-ready')
await page.click('text=See my plan')

await page.waitForURL('**/dashboard', { timeout: 15000 })
await page.waitForTimeout(700); await shot('04-dashboard')

// Start workout from dashboard. If today is a rest day, the dashboard's
// "Train anyway" goes to the /workout overview first, which needs a second
// click on a specific session's own "Train anyway"/"Start workout" button.
const dashboardStart = page.locator(
  'button:has-text("Start workout"), button:has-text("Train anyway")',
)
await dashboardStart.first().click()
await page.waitForTimeout(500)

if (!(await page.locator('text=Exercise 1 /').isVisible().catch(() => false))) {
  await page.waitForTimeout(700); await shot('04b-workout-overview')
  const sessionStart = page.locator(
    'button:has-text("Start workout"), button:has-text("Train anyway")',
  )
  await sessionStart.first().click()
}

await page.waitForSelector('text=Exercise 1 /', { timeout: 15000 })
await page.waitForTimeout(700); await shot('05-workout-active')

// Log a set
await page.fill('input[inputmode="decimal"]', '20')
await page.fill('input[inputmode="numeric"]', '10')
await page.click('button[aria-label="RPE 3"]')
await page.click('text=Complete set')
await page.waitForSelector('text=Skip rest', { timeout: 5000 })
await page.waitForTimeout(700); await shot('06-rest-timer')

await browser_close_check()

async function browser_close_check() {}

// Navigate to other main screens directly
for (const [path, , name] of [
  ['/progress', 'Progress', '07-progress'],
  ['/history', 'long', null],
  ['/profile', 'Profile', '09-profile'],
]) {
  await page.goto(`http://localhost:5173${path}`)
  await page.waitForTimeout(1000)
  if (name) await page.waitForTimeout(700); await shot(name)
}
await page.waitForTimeout(700); await shot('08-history')

console.log('CONSOLE_ERRORS:', JSON.stringify(errors))

await browser.close()
