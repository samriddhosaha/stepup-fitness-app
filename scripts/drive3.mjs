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

await page.goto('http://localhost:5173')
await page.waitForSelector('text=Get started')
await page.click('text=Get started')
await page.waitForSelector('text=What should we call you?')
await page.fill('input:not([type])', 'Robin')
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

await page.goto('http://localhost:5173/profile')
await page.waitForSelector('text=AI weekly coach')
await page.waitForTimeout(700); await shot('18-profile-ai-toggle-off')

await page.click('role=switch')
await page.waitForSelector('text=Nothing else is sent')
await page.waitForTimeout(700); await shot('19-ai-consent')
await page.click('text=Turn on')
await page.waitForTimeout(300)
await page.waitForTimeout(700); await shot('20-ai-toggle-on')

await page.goto('http://localhost:5173/dashboard')
await page.waitForTimeout(1500)
await page.waitForTimeout(700); await shot('21-dashboard-ai-fallback')

console.log('ERRORS:', JSON.stringify(errors))
await browser.close()
