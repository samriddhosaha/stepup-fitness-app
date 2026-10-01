import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * On every navigation: set the document title from the page's <h1> and move focus to it,
 * so screen-reader and keyboard users land at the top of the new page instead of nowhere.
 * Lazy pages render a skeleton first, so we wait (briefly) for the real heading.
 * Skipped on the first load (the browser handles that) so nothing steals initial focus.
 */
export function RouteA11y() {
  const { pathname } = useLocation()
  const first = useRef(true)

  useEffect(() => {
    let attempts = 0
    let timer: ReturnType<typeof setTimeout>
    const isFirst = first.current
    first.current = false

    const settle = () => {
      const h1 = document.querySelector<HTMLElement>('main h1')
      if (!h1 && attempts < 40) {
        attempts += 1
        timer = setTimeout(settle, 50)
        return
      }
      const name = h1?.textContent?.trim()
      document.title = name ? `${name} · StepUp` : 'StepUp'
      if (h1 && !isFirst) {
        h1.setAttribute('tabindex', '-1')
        h1.focus()
      }
    }
    timer = setTimeout(settle, 0)
    return () => clearTimeout(timer)
    // the dependency is a trigger (re-run on change), not a value the effect reads
    // oxlint-disable-next-line react/exhaustive-deps
  }, [pathname])

  return null
}
