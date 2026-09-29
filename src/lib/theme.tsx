import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Appearance } from '../db/types'

const STORAGE_KEY = 'stepup-appearance'

function readCachedAppearance(): Appearance {
  if (typeof localStorage === 'undefined') return 'system'
  const cached = localStorage.getItem(STORAGE_KEY)
  return cached === 'light' || cached === 'dark' || cached === 'system'
    ? cached
    : 'system'
}

function applyToDocument(appearance: Appearance) {
  const root = document.documentElement
  if (appearance === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', appearance)
  }
}

interface ThemeContextValue {
  appearance: Appearance
  setAppearance: (appearance: Appearance) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

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

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
