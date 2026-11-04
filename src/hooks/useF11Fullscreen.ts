import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

import { isTauri } from '@/lib/api'

export const FULLSCREEN_EVENT = 'fyodor-fullscreen'

/** App-wide F11 / Fn+F11 toggles the native window fullscreen. */
export function useF11Fullscreen() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'F11') return
      event.preventDefault()
      if (!isTauri()) return
      void (async () => {
        try {
          const win = getCurrentWindow()
          const next = !(await win.isFullscreen())
          await win.setFullscreen(next)
          window.dispatchEvent(
            new CustomEvent(FULLSCREEN_EVENT, { detail: { fullscreen: next } }),
          )
        } catch {
          /* ignore */
        }
      })()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
