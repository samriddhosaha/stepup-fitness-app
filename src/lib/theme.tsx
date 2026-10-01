import {
  useCallback,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Appearance } from '../db/types'
import { ThemeContext } from './useTheme'

const STORAGE_KEY = 'stepup-appearance'

function readCachedAppearance(): Appearance {
  if (typeof localStorage === 'undefined') return 'system'
  const cached = localStorage.getItem(STORAGE_KEY)
  return cached === 'light' || cached === 'dark' || cached === 'system'
    ? cached
    : 'system'
}

const THEME_COLORS = { light: '#F3F3F3', dark: '#0C0C0C' } as const

/** Keeps the browser chrome colour in step with an explicit light/dark choice (the OS setting rules otherwise). */
function applyThemeColor(appearance: Appearance) {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = /dark/.test(meta.media) ? 'dark' : 'light'
    meta.content = THEME_COLORS[appearance === 'system' ? scheme : appearance]
  }
}

function applyToDocument(appearance: Appearance) {
  applyThemeColor(appearance)
  const root = document.documentElement
  if (appearance === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', appearance)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>(
    readCachedAppearance,
  )

  // Runs before paint so there is no light/dark flash on load.
  useLayoutEffect(() => {
    applyToDocument(appearance)
  }, [appearance])

  const setAppearance = useCallback((next: Appearance) => {
    localStorage.setItem(STORAGE_KEY, next)
    setAppearanceState(next)
  }, [])

  return (
    <ThemeContext.Provider value={{ appearance, setAppearance }}>
      {children}
    </ThemeContext.Provider>
  )
}
