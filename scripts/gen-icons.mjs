import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'fs'

const ACCENT = 'rgb(79,70,229)'
const INK_ON_ACCENT = 'rgb(255,255,255)'

function monogramSvg({ size, padding }) {
  const s = size
  const p = padding
  const inner = s - p * 2
  const barW = inner * 0.22
  const barH = inner * 0.78
  const x0 = p + inner * 0.12
  const y0 = p + (s - barH) / 2 - p
  const topW = inner * 0.62
  const midW = inner * 0.5
  const armH = barW

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${ACCENT}"/>
  <g fill="${INK_ON_ACCENT}">
    <rect x="${x0}" y="${y0}" width="${barW}" height="${barH}" rx="${barW * 0.18}"/>
    <rect x="${x0}" y="${y0}" width="${topW}" height="${armH}" rx="${armH * 0.18}"/>
    <rect x="${x0}" y="${y0 + barH * 0.42}" width="${midW}" height="${armH}" rx="${armH * 0.18}"/>
  </g>
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
