import type { ReadingMode } from '@/lib/types'

export type EdgePaddingPreset = 'none' | 'narrow' | 'medium' | 'wide'

export interface EdgePaddingStyle {
  maxWidth: string
  gapPx: number
  padXPx: number
}

const STORAGE_KEY = 'fyodor.readerLayout.v1'
const EVENT = 'fyodor-reader-layout'

interface Store {
  edgePadding: EdgePaddingPreset
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

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STORE }
    const parsed = JSON.parse(raw) as Partial<Store>
    return {
      edgePadding: isEdgePadding(parsed.edgePadding)
        ? parsed.edgePadding
        : DEFAULT_STORE.edgePadding,
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
  writeStore({ edgePadding: next })
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
