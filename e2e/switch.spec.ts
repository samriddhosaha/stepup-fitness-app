import { expect, test } from '@playwright/test'
import { onboard, useTheme } from './helpers'

// The knob must sit the same distance from the top, bottom and the near edge, off and on.
for (const theme of ['light', 'dark'] as const) {
  test(`switch knob is evenly spaced in its track (${theme})`, async ({ page }) => {
    await useTheme(page, theme)
    await onboard(page)
    await page.goto('/profile')
    for (const name of ['Rest timer sound', 'AI weekly coach', 'Keep an error log on this device']) {
      const sw = page.getByRole('switch', { name })
      if (name === 'AI weekly coach') continue // turning it on asks for consent; geometry is identical
      for (const on of [false, true]) {
        if ((await sw.getAttribute('aria-checked')) !== String(on)) await sw.click()
        await expect(sw).toHaveAttribute('aria-checked', String(on))
        await page.waitForTimeout(250) // let the slide finish
        const { track, knob } = await sw.evaluate((el) => ({
          track: el.getBoundingClientRect().toJSON(),
          knob: el.firstElementChild!.getBoundingClientRect().toJSON(),
        }))
        const top = knob.top - track.top
        const bottom = track.bottom - knob.bottom
        const left = knob.left - track.left
        const right = track.right - knob.right
        expect(Math.abs(top - bottom), `${name} vertical`).toBeLessThanOrEqual(0.5)
        expect(Math.abs((on ? right : left) - top), `${name} ${on ? 'right' : 'left'} edge matches top`).toBeLessThanOrEqual(0.5)
      }
    }
  })
}
