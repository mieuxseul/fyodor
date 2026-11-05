/** Local reading history — covers remotes (Discover) that never hit SQLite history. */

export interface ReadingHistoryEntry {
  id: string
  openedAt: string
  titleId: string
  editionId: string
  primaryTitle: string
  coverPath?: string | null
  chapterId?: string | null
  chapterTitle?: string | null
  /** When set, resume via remote reader path. */
  providerId?: string | null
  providerTitleId?: string | null
}

const STORAGE_KEY = 'fyodor.readingHistory.v1'
const EVENT = 'fyodor-reading-history'
const MAX_ENTRIES = 200

function readAll(): ReadingHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ReadingHistoryEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        typeof item.editionId === 'string' &&
        typeof item.primaryTitle === 'string' &&
        typeof item.openedAt === 'string',
    )
  } catch {
    return []
  }
}

function writeAll(entries: ReadingHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    /* ignore quota */
  }
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* ignore */
  }
}

function entryKey(entry: Pick<ReadingHistoryEntry, 'editionId' | 'providerId' | 'providerTitleId'>): string {
  if (entry.providerId && entry.providerTitleId) {
    return `remote:${entry.providerId}:${entry.providerTitleId}`
  }
  return `edition:${entry.editionId}`
}

export function listReadingHistory(limit = 100): ReadingHistoryEntry[] {
  return readAll()
    .slice()
    .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))
    .slice(0, Math.max(1, limit))
}

export function recordReadingOpen(
  input: Omit<ReadingHistoryEntry, 'id' | 'openedAt'> & { openedAt?: string },
): ReadingHistoryEntry {
  const openedAt = input.openedAt ?? new Date().toISOString()
  const next: ReadingHistoryEntry = {
    id: crypto.randomUUID(),
    openedAt,
    titleId: input.titleId,
    editionId: input.editionId,
    primaryTitle: input.primaryTitle,
    coverPath: input.coverPath ?? null,
    chapterId: input.chapterId ?? null,
    chapterTitle: input.chapterTitle ?? null,
    providerId: input.providerId ?? null,
    providerTitleId: input.providerTitleId ?? null,
  }
  mergeReadingHistory([next])
  return next
}

/** Merge entries by title key, keeping the newest open for each. */
export function mergeReadingHistory(incoming: ReadingHistoryEntry[]): void {
  const map = new Map<string, ReadingHistoryEntry>()
  for (const item of [...readAll(), ...incoming]) {
    const key = entryKey(item)
    const prev = map.get(key)
    if (!prev || prev.openedAt < item.openedAt) map.set(key, item)
  }
  writeAll(
    [...map.values()].sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1)),
  )
}

/** Keep the latest open entry's chapter in sync while reading. */
export function touchReadingHistoryChapter(
  editionId: string,
  chapter: { id: string; title?: string | null },
  remote?: { providerId: string; providerTitleId: string } | null,
): void {
  const all = readAll()
  if (all.length === 0) return
  const key = entryKey({
    editionId,
    providerId: remote?.providerId,
    providerTitleId: remote?.providerTitleId,
  })
  const index = all.findIndex((item) => entryKey(item) === key)
  if (index < 0) return
  all[index] = {
    ...all[index],
    chapterId: chapter.id,
    chapterTitle: chapter.title ?? all[index].chapterTitle ?? null,
    openedAt: new Date().toISOString(),
  }
  const [updated] = all.splice(index, 1)
  writeAll([updated, ...all])
}

export function clearReadingHistory(): void {
  writeAll([])
}

export function clearReadingHistoryForTitle(titleId: string): void {
  writeAll(readAll().filter((item) => item.titleId !== titleId))
}

export function historyResumePath(entry: ReadingHistoryEntry): string {
  const chapter = entry.chapterId
    ? `?chapter=${encodeURIComponent(entry.chapterId)}`
    : ''
  if (entry.providerId && entry.providerTitleId) {
    return `/reader/${entry.providerId}:${entry.providerTitleId}${chapter}`
  }
  return `/reader/${entry.editionId}${chapter}`
}

export function historyTitlePath(entry: ReadingHistoryEntry): string {
  if (entry.providerId && entry.providerTitleId) {
    return `/remote/${entry.providerId}/${encodeURIComponent(entry.providerTitleId)}`
  }
  return `/title/${entry.titleId}`
}

export function subscribeReadingHistory(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}
