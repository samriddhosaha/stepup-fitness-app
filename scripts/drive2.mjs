import { chromium } from 'playwright'

const shotsDir = process.argv[2] || '.'
const errors = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 860 } })
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
page.on('pageerror', (err) => errors.push('pageerror: ' + err.message))

async function shot(name) {
  await page.screenshot({ path: `${shotsDir}/${name}.png` })
}

async function onboard() {
  await page.goto('http://localhost:5173')
  await page.waitForSelector('text=Get started')
  await page.click('text=Get started')
  await page.waitForSelector('text=What should we call you?')
  await page.fill('input:not([type])', 'Jamie')
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

async function beginWorkout() {
  await page.locator('button:has-text("Start workout"), button:has-text("Train anyway")').first().click()
  await page.waitForTimeout(400)
  if (!(await page.locator('text=Exercise 1 /').isVisible().catch(() => false))) {
    await page.locator('button:has-text("Start workout"), button:has-text("Train anyway")').first().click()
  }
  await page.waitForSelector('text=Exercise 1 /')
}

async function completeExercise() {
  // Log 3 sets for the current exercise
  for (let i = 0; i < 3; i++) {
    await page.locator('input[inputmode="decimal"]').fill('25')
    await page.locator('input[inputmode="numeric"]').fill('10')
    await page.click('button[aria-label="RPE 2"]')
    await page.click('text=Complete set')
    await page.waitForTimeout(200)
    // skip rest immediately to move fast
    const skipRest = page.locator('text=Skip rest')
    if (await skipRest.isVisible().catch(() => false)) await skipRest.click()
  }
  const nextBtn = page.locator('button:has-text("Next exercise"), button:has-text("Finish workout")')
  await nextBtn.first().click()
}

await onboard()
await beginWorkout()
await page.waitForTimeout(700); await shot('11-first-exercise')

// Drive through all exercises until we land on the complete screen
for (let guard = 0; guard < 10; guard++) {
  const onComplete = await page.locator('text=Workout complete.').isVisible().catch(() => false)
  if (onComplete) break
  await completeExercise()
  await page.waitForTimeout(300)
}

await page.waitForSelector('text=Workout complete.', { timeout: 10000 })
await page.waitForTimeout(700); await shot('12-workout-complete')

await page.click('text=Back to dashboard')
await page.waitForURL('**/dashboard')
await page.waitForTimeout(700); await shot('13-dashboard-after')

await page.goto('http://localhost:5173/progress/xp')
await page.waitForTimeout(500)
await page.waitForTimeout(700); await shot('14-xp')

// Dark mode
await page.goto('http://localhost:5173/profile')
await page.waitForTimeout(300)
await page.click('text=Dark')
await page.waitForTimeout(300)
await page.waitForTimeout(700); await shot('15-profile-dark')
await page.goto('http://localhost:5173/dashboard')
await page.waitForTimeout(300)
await page.waitForTimeout(700); await shot('16-dashboard-dark')

console.log('ERRORS:', JSON.stringify(errors))
await browser.close()
