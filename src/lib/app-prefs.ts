export interface AppPrefs {
  showProgressIndicators: boolean
  showListBadges: boolean
  showQuickFilters: boolean
  amoledBlack: boolean
  relatedManga: boolean
  readingStatistics: boolean
  estimatedReadingTime: boolean
  exitConfirmation: boolean
  floatingContinue: boolean
  collapseLongDescription: boolean
  preloadPages: 'never' | 'wifi' | 'always'
  contentPreloading: 'never' | 'wifi' | 'always'
  periodicBackups: boolean
}

const STORAGE_KEY = 'fyodor.appPrefs.v1'
const EVENT = 'fyodor-app-prefs'

const DEFAULTS: AppPrefs = {
  showProgressIndicators: true,
  showListBadges: true,
  showQuickFilters: true,
  amoledBlack: false,
  relatedManga: false,
  readingStatistics: false,
  estimatedReadingTime: false,
  exitConfirmation: false,
  floatingContinue: true,
  collapseLongDescription: false,
  preloadPages: 'wifi',
  contentPreloading: 'never',
  periodicBackups: false,
}

function read(): AppPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<AppPrefs>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

function write(prefs: AppPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* ignore */
  }
  applyAmoled(prefs.amoledBlack)
}

function applyAmoled(enabled: boolean): void {
  try {
    document.documentElement.setAttribute('data-amoled', enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function getAppPrefs(): AppPrefs {
  return read()
}

export function setAppPrefs(patch: Partial<AppPrefs>): AppPrefs {
  const next = { ...read(), ...patch }
  write(next)
  return next
}

export function subscribeAppPrefs(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}

/** Call once on app boot so AMOLED class applies before first paint settles. */
export function hydrateAppPrefs(): AppPrefs {
  const prefs = read()
  applyAmoled(prefs.amoledBlack)
  return prefs
}
