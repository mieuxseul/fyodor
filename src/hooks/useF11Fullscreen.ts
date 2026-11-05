import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

import { isTauri } from '@/lib/api'

export const FULLSCREEN_EVENT = 'fyodor-fullscreen'

/** Synced so Esc can stop other handlers before async window APIs resolve. */
let fullscreenCache = false

function emitFullscreen(next: boolean) {
  fullscreenCache = next
  window.dispatchEvent(
    new CustomEvent(FULLSCREEN_EVENT, { detail: { fullscreen: next } }),
  )
}

export async function setWindowFullscreen(next: boolean) {
  if (!isTauri()) return
  const win = getCurrentWindow()
  await win.setFullscreen(next)
  emitFullscreen(next)
}

export function isFullscreenCached() {
  return fullscreenCache
}

/** App-wide F11 / Fn+F11 toggles fullscreen; Esc exits when fullscreen. */
export function useF11Fullscreen() {
  useEffect(() => {
    if (!isTauri()) return

    void getCurrentWindow()
      .isFullscreen()
      .then((value) => {
        fullscreenCache = value
      })
      .catch(() => undefined)

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        event.preventDefault()
        void (async () => {
          try {
            const win = getCurrentWindow()
            const next = !(await win.isFullscreen())
            await win.setFullscreen(next)
            emitFullscreen(next)
          } catch {
            /* ignore */
          }
        })()
        return
      }

      if (event.key === 'Escape' && fullscreenCache) {
        // Capture before reader navigation / other Esc handlers.
        event.preventDefault()
        event.stopImmediatePropagation()
        void setWindowFullscreen(false)
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
}
