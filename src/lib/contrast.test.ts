import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

function tokens(selector: string): Record<string, [number, number, number]> {
  const esc = selector.replace(/[[\]'.]/g, String.raw`\$&`)
  const block = css.match(new RegExp(esc + String.raw`\s*\{([^}]*)\}`))?.[1]
  if (!block) throw new Error(`no block for ${selector}`)
  const out: Record<string, [number, number, number]> = {}
  for (const m of block.matchAll(/--c-([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)/g)) {
    out[m[1]!] = [Number(m[2]), Number(m[3]), Number(m[4])]
  }
  return out
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function ratio(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

// Every text-on-background pair the UI uses (button/chip/nav fills, body text, captions, error text).
const PAIRS: [string, string][] = [
  ['on-accent', 'accent'],
  ['on-danger', 'danger'],
  ['ink', 'canvas'],
  ['ink', 'elevated'],
  ['ink', 'surface'],
  ['ink', 'accent-soft'],
  ['faint', 'canvas'],
  ['faint', 'elevated'],
  ['faint', 'surface'],
  ['faint', 'accent-soft'],
  ['accent', 'canvas'],
  ['accent', 'elevated'],
  ['danger', 'canvas'],
  ['danger', 'elevated'],
  ['danger', 'danger-soft'],
  ['warning', 'canvas'],
  ['warning', 'elevated'],
]

describe.each([
  ['light', ':root'],
  ['dark', "[data-theme='dark']"],
])('%s theme contrast', (_name, selector) => {
  const t = tokens(selector)
  it.each(PAIRS)('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(t[fg], `missing token ${fg}`).toBeDefined()
    expect(t[bg], `missing token ${bg}`).toBeDefined()
    expect(ratio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('explicit light override matches :root', () => {
  it('has identical tokens', () => {
    expect(tokens("[data-theme='light']")).toEqual(tokens(':root'))
  })
})
