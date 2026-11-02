import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { api, isTauri } from '@/lib/api'
import type { ThemePreference } from '@/lib/types'

interface ThemeContextValue {
  preference: ThemePreference
  resolved: 'dark' | 'light'
  setPreference: (value: ThemePreference) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function resolveTheme(preference: ThemePreference): 'dark' | 'light' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return preference
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('light')
  const [resolved, setResolved] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (!isTauri()) {
          const stored = localStorage.getItem('fyodor.theme') as ThemePreference | null
          if (!cancelled && stored) setPreferenceState(stored)
          return
        }
        const value = await api.getSetting('theme')
        if (!cancelled && value && ['dark', 'light', 'system'].includes(value)) {
          setPreferenceState(value as ThemePreference)
        } else if (!cancelled && !value) {
          setPreferenceState('light')
          await api.setSetting('theme', 'light')
        }
      } catch {
        // Keep default monochrome light theme if settings are unavailable.
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const next = resolveTheme(preference)
    setResolved(next)
    document.documentElement.setAttribute('data-theme', next)

    if (preference !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setResolved(resolveTheme('system'))
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  const setPreference = useCallback(async (value: ThemePreference) => {
    setPreferenceState(value)
    if (!isTauri()) {
      localStorage.setItem('fyodor.theme', value)
      return
    }
    await api.setSetting('theme', value)
  }, [])

  const contextValue = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  )

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
