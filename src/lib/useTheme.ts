import { createContext, useContext } from 'react'
import type { Appearance } from '../db/types'

export interface ThemeContextValue {
  appearance: Appearance
  setAppearance: (appearance: Appearance) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
