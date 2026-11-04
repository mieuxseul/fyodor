export interface ChapterSeenSnapshot {
  lastSeenCount: number
  lastKnownCount: number
  updatedAt: string
}

const EVENT = 'fyodor-chapter-seen'

function storageKey(providerId: string, titleId: string): string {
  return `fyodor.chapterSeen.v1.${providerId}:${titleId}`
}

function read(providerId: string, titleId: string): ChapterSeenSnapshot | null {
  try {
    const raw = localStorage.getItem(storageKey(providerId, titleId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ChapterSeenSnapshot
    const lastSeenCount = Math.max(0, Number(parsed.lastSeenCount) || 0)
    const lastKnownCount = Math.max(0, Number(parsed.lastKnownCount) || 0)
    return {
      lastSeenCount,
      lastKnownCount,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function write(
  providerId: string,
  titleId: string,
  next: ChapterSeenSnapshot,
): ChapterSeenSnapshot {
  try {
    localStorage.setItem(storageKey(providerId, titleId), JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* ignore */
  }
  return next
}

/** Seed or raise known chapter count. First sighting seeds without a badge. */
export function recordKnownChapterCount(
  providerId: string,
  titleId: string,
  count: number,
): void {
  if (!providerId || !titleId || !Number.isFinite(count) || count < 0) return
  const rounded = Math.floor(count)
  const prev = read(providerId, titleId)
  if (!prev) {
    write(providerId, titleId, {
      lastSeenCount: rounded,
      lastKnownCount: rounded,
      updatedAt: new Date().toISOString(),
    })
    return
  }
  if (rounded <= prev.lastKnownCount) return
  write(providerId, titleId, {
    ...prev,
    lastKnownCount: rounded,
    updatedAt: new Date().toISOString(),
  })
}

/** Mark the catalog as seen (clears New badge). */
export function markChaptersSeen(
  providerId: string,
  titleId: string,
  count?: number,
): void {
  if (!providerId || !titleId) return
  const prev = read(providerId, titleId)
  const known = Math.max(
    0,
    Math.floor(count ?? prev?.lastKnownCount ?? 0),
  )
  write(providerId, titleId, {
    lastSeenCount: known,
    lastKnownCount: Math.max(known, prev?.lastKnownCount ?? 0),
    updatedAt: new Date().toISOString(),
  })
}

export function hasNewChapters(providerId: string, titleId: string): boolean {
  const snap = read(providerId, titleId)
  if (!snap) return false
  return snap.lastKnownCount > snap.lastSeenCount
}

export function newChapterDelta(providerId: string, titleId: string): number {
  const snap = read(providerId, titleId)
  if (!snap) return 0
  return Math.max(0, snap.lastKnownCount - snap.lastSeenCount)
}

export function subscribeChapterSeen(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}
