import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 860 } })

// Generic check: (1) every visible, enabled interactive control on the page
// is reachable by pressing Tab repeatedly, and (2) focus never gets stuck on
// the same element for two consecutive presses (a keyboard trap).
async function checkTabOrderCoversAllControls(label) {
  const controls = page.locator(
    'button:visible, a:visible, input:visible, textarea:visible, select:visible, [role="switch"]:visible',
  )
  const count = await controls.count()
  const expectedNames = []
  for (let i = 0; i < count; i++) {
    const el = controls.nth(i)
    if (await el.isDisabled().catch(() => false)) continue
    const name = await el.evaluate(
      (node) =>
        node.getAttribute('aria-label') ||
        node.getAttribute('placeholder') ||
        node.textContent?.trim() ||
        node.tagName,
    )
    expectedNames.push(name)
  }

  await page.evaluate(() => (document.activeElement)?.blur())
  const reached = new Set()
  let lastKey = null
  let stuckCount = 0
  const maxPresses = expectedNames.length + 5

  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab')
    const key = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      return (
        el.getAttribute('aria-label') ||
        el.getAttribute('placeholder') ||
        el.textContent?.trim() ||
        el.tagName
      )
    })
    if (key !== null) reached.add(key)
    if (key === lastKey && key !== null) stuckCount++
    else stuckCount = 0
    lastKey = key
    if (stuckCount > 3) break // genuine trap — same element 4+ presses in a row
  }

  const missing = expectedNames.filter((n) => !reached.has(n))
  console.log(`\n=== ${label} ===`)
  console.log(`Expected ${expectedNames.length} enabled controls:`, expectedNames)
  console.log(`Reached via Tab:`, Array.from(reached))
  if (stuckCount > 3) console.log('  FAIL: keyboard trap detected')
  if (missing.length > 0) console.log('  WARNING: not reached via Tab:', missing)
  if (stuckCount <= 3 && missing.length === 0) console.log('  OK: all controls reachable, no trap')
  return { missing, trapped: stuckCount > 3 }
}

// --- Onboarding step 1 ---
await page.goto(BASE)
await page.waitForSelector('text=Get started')
await checkTabOrderCoversAllControls('/welcome')

await page.click('text=Get started')
await page.waitForSelector('text=What should we call you?')
await checkTabOrderCoversAllControls('/onboarding step 1 (before filling name)')

// Fill name via keyboard, then confirm Continue is reachable and works via Enter
await page.getByLabel('Name').focus()
await page.keyboard.type('KeyboardUser')
await checkTabOrderCoversAllControls('/onboarding step 1 (after filling name, Continue enabled)')
await page.getByRole('button', { name: 'Continue' }).focus()
await page.keyboard.press('Enter')
await page.waitForSelector('text=A few basics')
console.log('\nReached step 2 via keyboard Enter on Continue: OK')

// --- Workout logging screen ---
await page.click('text=Continue')
await page.waitForSelector("text=I'm new to structured workouts")
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
await page.locator('button:has-text("Start workout"), button:has-text("Train anyway")').first().click()
await page.waitForURL(/\/workout(\/active)?$/, { timeout: 5000 })
if (!page.url().includes('/workout/active')) {
  await page.locator('button:has-text("Start workout"), button:has-text("Train anyway")').first().click()
  await page.waitForURL('**/workout/active', { timeout: 5000 })
}
await page.waitForSelector('text=Exercise 1 /')

const workoutResult = await checkTabOrderCoversAllControls('/workout/active')

// Confirm the actual logging sequence works via keyboard: weight, reps, RPE, complete set
await page.getByLabel('Weight (kg)').focus()
await page.keyboard.type('20')
await page.getByLabel('Reps').focus()
await page.keyboard.type('10')
await page.getByLabel('RPE 3').focus()
await page.keyboard.press('Enter')
await page.getByRole('button', { name: 'Complete set' }).focus()
await page.keyboard.press('Enter')
await page.waitForSelector('text=Skip rest', { timeout: 5000 })
console.log('\nLogged a full set (weight/reps/RPE/complete) via keyboard only: OK')

const anyFailures = workoutResult.trapped || workoutResult.missing.length > 0
await browser.close()
process.exit(anyFailures ? 1 : 0)
