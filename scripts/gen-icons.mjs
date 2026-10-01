import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'fs'

const ACCENT = '#10162F'
const INK_ON_ACCENT = '#EAFDC6'

// A geometric "S" built from an explicit stroked path (not a text glyph) so
// it renders identically regardless of which fonts happen to be installed
// wherever this script runs.
function monogramSvg({ size, padding }) {
  const s = size
  const p = padding
  const inner = s - p * 2
  const strokeW = inner * 0.24

  // S-curve drawn in a 0-100 box, then scaled/translated into the padded
  // inner square via the path transform below.
  const sPath =
    'M 78 18 C 62 6, 30 6, 22 24 C 14 42, 40 46, 50 48 C 62 50, 88 54, 80 74 C 72 92, 36 92, 20 80'
  const scale = inner / 100

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${ACCENT}"/>
  <path
    d="${sPath}"
    transform="translate(${p} ${p}) scale(${scale})"
    fill="none"
    stroke="${INK_ON_ACCENT}"
    stroke-width="${strokeW / scale}"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>`
}

mkdirSync('public/icons', { recursive: true })

const targets = [
  { file: 'icon-192.png', size: 192, padding: 192 * 0.22 },
  { file: 'icon-512.png', size: 512, padding: 512 * 0.22 },
  { file: 'icon-maskable-512.png', size: 512, padding: 512 * 0.32 },
]

for (const t of targets) {
  const svg = monogramSvg({ size: t.size, padding: t.padding })
  await sharp(Buffer.from(svg)).png().toFile(`public/icons/${t.file}`)
  console.log('wrote', t.file)
}

// Also write a favicon-sized svg for the browser tab + apple-touch-icon png
writeFileSync('public/favicon.svg', monogramSvg({ size: 64, padding: 64 * 0.18 }))
await sharp(Buffer.from(monogramSvg({ size: 180, padding: 180 * 0.2 })))
  .png()
  .toFile('public/icons/apple-touch-icon.png')
console.log('wrote favicon.svg + apple-touch-icon.png')
