const STORAGE_KEY = 'fyodor.libraryPins.v1'
const EVENT = 'fyodor-library-pins'

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as { ids?: unknown }
    const ids = Array.isArray(parsed.ids)
      ? parsed.ids.filter((id): id is string => typeof id === 'string')
      : []
    return new Set(ids)
  } catch {
    return new Set()
  }
}

function write(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: [...ids] }))
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* ignore */
  }
}

export function isTitlePinned(titleId: string): boolean {
  return Boolean(titleId) && read().has(titleId)
}

export function setTitlePinned(titleId: string, pinned: boolean): void {
  if (!titleId) return
  const ids = read()
  if (pinned) ids.add(titleId)
  else ids.delete(titleId)
  write(ids)
}

export function toggleTitlePinned(titleId: string): boolean {
  const next = !isTitlePinned(titleId)
  setTitlePinned(titleId, next)
  return next
}

export function listPinnedTitleIds(): string[] {
  return [...read()]
}

export function subscribeLibraryPins(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}
