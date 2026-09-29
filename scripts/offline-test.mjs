import { chromium } from 'playwright'

const shotsDir = process.argv[2] || '.'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 860 } })
const errors = []
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
page.on('pageerror', (err) => errors.push('pageerror: ' + err.message))

await page.goto('http://localhost:4174')
await page.waitForSelector('text=Get started', { timeout: 15000 })

// Wait for the service worker to actually finish installing + activating
// and take control of this page (autoUpdate + clientsClaim).
await page.waitForFunction(
  () => navigator.serviceWorker?.controller !== null && navigator.serviceWorker.controller !== undefined,
  { timeout: 20000 },
)
console.log('SW controller present')

await page.context().setOffline(true)
await page.reload()
await page.waitForSelector('text=Get started', { timeout: 15000 })
await page.screenshot({ path: `${shotsDir}/17-offline-reload.png` })
console.log('Offline reload succeeded')

console.log('ERRORS:', JSON.stringify(errors))
await browser.close()
