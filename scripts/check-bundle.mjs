// Fails the build when the first-load JavaScript or the offline precache grows past the budget.
// Run after `npm run build`. Budgets are deliberately a little above today's numbers.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const BUDGET = { mainGzipKB: 125, precacheKB: 1500, anyChunkGzipKB: 130 }
const dir = 'dist/assets'
const kb = (n) => Math.round((n / 1024) * 10) / 10

const js = readdirSync(dir).filter((f) => f.endsWith('.js'))
const sizes = js.map((f) => ({ f, gz: gzipSync(readFileSync(join(dir, f))).length }))
const main = sizes.find((s) => s.f.startsWith('index-'))
const sw = readFileSync('dist/sw.js', 'utf8')
const precache = [...sw.matchAll(/revision:"[^"]*"|url:"([^"]+)"/g)].map((m) => m[1]).filter(Boolean)
const precacheBytes = precache.reduce((n, u) => n + (statSync(join('dist', u.split('?')[0])).size ?? 0), 0)

const rows = [
  ['main chunk (gzip)', kb(main?.gz ?? 0), BUDGET.mainGzipKB],
  ['largest chunk (gzip)', kb(Math.max(...sizes.map((s) => s.gz))), BUDGET.anyChunkGzipKB],
  ['precache (raw)', kb(precacheBytes), BUDGET.precacheKB],
]
let failed = false
for (const [name, value, budget] of rows) {
  const ok = value <= budget
  failed ||= !ok
  console.log(`${ok ? 'ok  ' : 'OVER'} ${name}: ${value} kB (budget ${budget} kB)`)
}
process.exit(failed ? 1 : 0)
