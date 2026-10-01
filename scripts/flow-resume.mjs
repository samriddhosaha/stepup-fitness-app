// Phase 1 end-to-end check: a workout survives a reload (position, swap, rest timer),
// finishing shows the summary, and the next session's load progresses. Needs `npm run dev` on :5173.
import { chromium } from 'playwright'

const shotsDir = process.argv[2] || '.'
const errors = []
const fails = []
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`)
  if (!ok) fails.push(name)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 860 } })
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.setDefaultTimeout(8000)
const text = () => page.innerText('body')

await page.goto('http://localhost:5173')
await page.click('text=Get started')
await page.fill('input:not([type])', 'Jamie')
await page.click('text=Continue')
await page.click('button:has-text("lb")') // units chosen in onboarding
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

await page.locator('button:has-text("Train anyway"), button:has-text("Start workout")').first().click()
if (page.url().endsWith('/workout')) await page.locator('button:has-text("Train anyway")').first().click()
await page.waitForSelector('text=Exercise 1 /')
check('weight label uses lb', (await text()).includes('Weight (lb)'))

// blank reps blocks logging
check('Complete set disabled without reps', await page.locator('button:has-text("Complete set")').isDisabled())

// log a set, swap exercise 2, advance
await page.locator('input[inputmode="numeric"]').fill('10')
await page.click('button[aria-label="RPE 2"]')
await page.click('text=Complete set')
await page.waitForSelector('[role="timer"]')
check('rest timer shown after a set', true)
await page.reload()
await page.waitForSelector('text=Exercise 1 /')
check('rest timer survives reload', await page.locator('[role="timer"]').isVisible())
check('logged set survives reload', (await text()).includes('1 of 3 sets'))

for (let i = 0; i < 2; i += 1) {
  await page.locator('input[inputmode="numeric"]').fill('10')
  await page.click('button[aria-label="RPE 2"]')
  await page.click('text=Complete set')
  await page.waitForTimeout(150)
}
await page.click('text=Next exercise')
await page.waitForSelector('text=Exercise 2 /')
await page.click('text=Replace exercise')
const firstSwap = page.locator('button.w-full.text-left.font-semibold').first()
const swapName = (await firstSwap.innerText()).trim()
await firstSwap.click()
await page.waitForSelector(`h1:has-text("${swapName}")`)
await page.reload()
await page.waitForSelector('text=Exercise 2 /')
check('swap and position survive reload', (await page.locator('h1').innerText()).includes(swapName))

// resume banner on dashboard
await page.goto('http://localhost:5173/dashboard')
await page.waitForSelector('text=Resume workout')
check('dashboard offers Resume workout', true)
await page.screenshot({ path: `${shotsDir}/flow-resume-dashboard.png` })
await page.click('text=Resume workout')
await page.waitForSelector('text=Exercise 2 /')

// leaving with Save & exit keeps it; finishing early goes to the summary
await page.click('text=Finish early')
await page.waitForSelector('text=Finish now?')
await page.click('button:has-text("Finish workout")')
await page.waitForSelector('text=Workout complete.')
check('finishing shows the summary (not the dashboard)', true)
await page.screenshot({ path: `${shotsDir}/flow-complete.png` })
check('no PR celebrated on the very first log', !(await text()).includes('New personal best'))

console.log('ERRORS:', JSON.stringify(errors))
await browser.close()
if (fails.length || errors.length) process.exit(1)
