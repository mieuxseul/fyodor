export type LibraryDisplayMode = 'compact' | 'details' | 'grid'

export interface LibraryDisplayPrefs {
  mode: LibraryDisplayMode
  /** 2–8 columns on wide layouts; used for grid mode */
  gridSize: number
  sort: 'recent' | 'added' | 'title' | 'progress'
}

const STORAGE_KEY = 'fyodor.libraryDisplay.v2'
const EVENT = 'fyodor-library-display'
export const LIBRARY_OPENED_EVENT = 'fyodor-library-opened'

const DEFAULTS: LibraryDisplayPrefs = {
  mode: 'grid',
  gridSize: 5,
  sort: 'recent',
}

function normalizeMode(value: unknown): LibraryDisplayMode {
  if (value === 'compact' || value === 'details' || value === 'grid') return value
  if (value === 'list') return 'details'
  return DEFAULTS.mode
}

function normalizeSort(value: unknown): LibraryDisplayPrefs['sort'] {
  if (value === 'recent' || value === 'added' || value === 'title' || value === 'progress') {
    return value
  }
  return DEFAULTS.sort
}

export function getLibraryDisplayPrefs(): LibraryDisplayPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<LibraryDisplayPrefs>
    const gridSize = Math.min(8, Math.max(2, Number(parsed.gridSize) || DEFAULTS.gridSize))
    return {
      mode: normalizeMode(parsed.mode),
      gridSize,
      sort: normalizeSort(parsed.sort),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function setLibraryDisplayPrefs(
  patch: Partial<LibraryDisplayPrefs>,
): LibraryDisplayPrefs {
  const next = { ...getLibraryDisplayPrefs(), ...patch }
  next.mode = normalizeMode(next.mode)
  next.sort = normalizeSort(next.sort)
  next.gridSize = Math.min(8, Math.max(2, Number(next.gridSize) || DEFAULTS.gridSize))
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* ignore */
  }
  return next
}

export function subscribeLibraryDisplay(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}

export function gridColsClass(size: number): string {
  switch (Math.min(8, Math.max(2, size))) {
    case 2:
      return 'grid-cols-2'
    case 3:
      return 'grid-cols-2 sm:grid-cols-3'
    case 4:
      return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
    case 5:
      return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5'
    case 6:
      return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6'
    case 7:
      return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7'
    default:
      return 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8'
  }
}
