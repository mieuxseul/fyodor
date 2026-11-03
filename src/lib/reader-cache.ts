/** In-memory chapter page URL cache + image warm helpers for the reader. */

const MAX_CHAPTERS = 12

type CacheEntry = {
  pages: string[]
  cachedAt: number
}

const chapterPages = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<string[]>>()

export function chapterCacheKey(
  provider: string,
  mangaId: string,
  chapterId: string,
): string {
  return `${provider}::${mangaId}::${chapterId}`
}

export function getCachedChapterPages(key: string): string[] | null {
  const hit = chapterPages.get(key)
  if (!hit) return null
  // Refresh LRU order
  chapterPages.delete(key)
  chapterPages.set(key, hit)
  return hit.pages
}

export function setCachedChapterPages(key: string, pages: string[]): void {
  if (chapterPages.has(key)) chapterPages.delete(key)
  chapterPages.set(key, { pages, cachedAt: Date.now() })
  while (chapterPages.size > MAX_CHAPTERS) {
    const oldest = chapterPages.keys().next().value
    if (oldest == null) break
    chapterPages.delete(oldest)
  }
}

/** Deduplicate concurrent fetches for the same chapter. */
export async function loadChapterPagesCached(
  key: string,
  fetcher: () => Promise<string[]>,
): Promise<string[]> {
  const cached = getCachedChapterPages(key)
  if (cached) return cached

  const existing = inflight.get(key)
  if (existing) return existing

  const pending = (async () => {
    try {
      const pages = await fetcher()
      setCachedChapterPages(key, pages)
      return pages
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, pending)
  return pending
}

/** Warm browser HTTP cache for upcoming page URLs (best-effort). */
export function prefetchImageUrls(urls: string[], limit = 4): void {
  if (typeof window === 'undefined') return
  for (const url of urls.slice(0, limit)) {
    if (!url || url.startsWith('data:')) continue
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  }
}

export function formatReaderError(error: unknown): { message: string; rateLimited: boolean } {
  const raw = error instanceof Error ? error.message : String(error)
  const lower = raw.toLowerCase()
  const rateLimited =
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many') ||
    lower.includes('retry-after')

  if (rateLimited) {
    return {
      message:
        'This source is rate-limiting requests right now. Wait a few seconds and try again.',
      rateLimited: true,
    }
  }

  return { message: raw || 'Failed to load chapter pages.', rateLimited: false }
}
