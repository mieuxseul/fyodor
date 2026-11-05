import type { ReadingDirection, ReadingMode } from '@/lib/types'

export type EdgePaddingPreset = 'none' | 'narrow' | 'medium' | 'wide'

export interface EdgePaddingStyle {
  maxWidth: string
  gapPx: number
  padXPx: number
}

const STORAGE_KEY = 'fyodor.readerLayout.v1'
const EVENT = 'fyodor-reader-layout'

interface TitlePrefs {
  mode?: ReadingMode
  direction?: ReadingDirection
}

interface Store {
  edgePadding: EdgePaddingPreset
  /** Last mode the user explicitly picked (any title). */
  readingMode?: ReadingMode
  readingDirection?: ReadingDirection
  /** Per title/edition overrides keyed by edition id or `provider:titleId`. */
  byKey?: Record<string, TitlePrefs>
}

export const EDGE_PADDING_PRESETS: Record<EdgePaddingPreset, EdgePaddingStyle> = {
  none: { maxWidth: '100%', gapPx: 0, padXPx: 0 },
  narrow: { maxWidth: '1100px', gapPx: 4, padXPx: 8 },
  medium: { maxWidth: '920px', gapPx: 8, padXPx: 16 },
  wide: { maxWidth: '720px', gapPx: 12, padXPx: 32 },
}

export const EDGE_PADDING_LABELS: Record<EdgePaddingPreset, string> = {
  none: 'None',
  narrow: 'Narrow',
  medium: 'Medium',
  wide: 'Wide',
}

const DEFAULT_STORE: Store = { edgePadding: 'medium' }

function isEdgePadding(value: unknown): value is EdgePaddingPreset {
  return value === 'none' || value === 'narrow' || value === 'medium' || value === 'wide'
}

function isReadingMode(value: unknown): value is ReadingMode {
  return value === 'page' || value === 'double' || value === 'vertical'
}

function isReadingDirection(value: unknown): value is ReadingDirection {
  return value === 'ltr' || value === 'rtl'
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STORE }
    const parsed = JSON.parse(raw) as Partial<Store>
    const byKey: Record<string, TitlePrefs> = {}
    if (parsed.byKey && typeof parsed.byKey === 'object') {
      for (const [key, prefs] of Object.entries(parsed.byKey)) {
        if (!prefs || typeof prefs !== 'object') continue
        byKey[key] = {
          mode: isReadingMode(prefs.mode) ? prefs.mode : undefined,
          direction: isReadingDirection(prefs.direction) ? prefs.direction : undefined,
        }
      }
    }
    return {
      edgePadding: isEdgePadding(parsed.edgePadding)
        ? parsed.edgePadding
        : DEFAULT_STORE.edgePadding,
      readingMode: isReadingMode(parsed.readingMode) ? parsed.readingMode : undefined,
      readingDirection: isReadingDirection(parsed.readingDirection)
        ? parsed.readingDirection
        : undefined,
      byKey,
    }
  } catch {
    return { ...DEFAULT_STORE }
  }
}

function writeStore(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* ignore quota */
  }
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* ignore */
  }
}

export function getEdgePaddingPreset(): EdgePaddingPreset {
  return readStore().edgePadding
}

export function setEdgePaddingPreset(preset: EdgePaddingPreset): EdgePaddingPreset {
  const next = isEdgePadding(preset) ? preset : DEFAULT_STORE.edgePadding
  writeStore({ ...readStore(), edgePadding: next })
  return next
}

export function readerPrefsKey(editionId: string): string {
  return editionId
}

export function resolveReadingMode(opts: {
  editionId: string
  editionMode?: string | null
  contentType?: string | null
}): ReadingMode {
  const store = readStore()
  const perTitle = store.byKey?.[opts.editionId]?.mode
  if (perTitle) return perTitle
  if (isReadingMode(opts.editionMode)) return opts.editionMode
  if (store.readingMode) return store.readingMode
  return opts.contentType === 'manhwa' ? 'vertical' : 'page'
}

export function resolveReadingDirection(opts: {
  editionId: string
  editionDirection?: string | null
}): ReadingDirection {
  const store = readStore()
  const perTitle = store.byKey?.[opts.editionId]?.direction
  if (perTitle) return perTitle
  if (isReadingDirection(opts.editionDirection)) return opts.editionDirection
  if (store.readingDirection) return store.readingDirection
  return 'ltr'
}

export function persistReadingMode(editionId: string, mode: ReadingMode): ReadingMode {
  const next = isReadingMode(mode) ? mode : 'page'
  const store = readStore()
  const byKey = { ...(store.byKey ?? {}) }
  byKey[editionId] = { ...byKey[editionId], mode: next }
  writeStore({ ...store, readingMode: next, byKey })
  return next
}

export function persistReadingDirection(
  editionId: string,
  direction: ReadingDirection,
): ReadingDirection {
  const next = isReadingDirection(direction) ? direction : 'ltr'
  const store = readStore()
  const byKey = { ...(store.byKey ?? {}) }
  byKey[editionId] = { ...byKey[editionId], direction: next }
  writeStore({ ...store, readingDirection: next, byKey })
  return next
}

export function edgePaddingStyle(preset: EdgePaddingPreset): EdgePaddingStyle {
  return EDGE_PADDING_PRESETS[isEdgePadding(preset) ? preset : DEFAULT_STORE.edgePadding]
}

export function pageStepForMode(mode: ReadingMode | string): number {
  return mode === 'double' ? 2 : 1
}

export function normalizeReadingMode(value: string | null | undefined): ReadingMode {
  if (value === 'double' || value === 'vertical' || value === 'page') return value
  return 'page'
}

export function pageRangeLabel(
  pageIndex: number,
  pageCount: number,
  mode: ReadingMode | string,
): string {
  if (pageCount <= 0) return '0 / 0'
  const start = pageIndex + 1
  if (mode === 'double' && pageIndex + 1 < pageCount) {
    return `${start}–${pageIndex + 2} / ${pageCount}`
  }
  return `${start} / ${pageCount}`
}

export function subscribeReaderLayout(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}
