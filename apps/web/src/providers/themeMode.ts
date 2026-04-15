import { createContext, useContext } from 'react'

export type ThemeMode = 'light' | 'dark'

type ThemeContextValue = {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  themeMode: 'light',
  setThemeMode: () => undefined,
})

export function useThemeMode() {
  return useContext(ThemeContext)
}
