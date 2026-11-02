import type { MangaProvider, NormalizedSearchResult, ProviderHealth } from '../types'

/**
 * Explicit test/demo catalog. Results are synthetic and must never be treated
 * as a real online manga source.
 */
const MOCK_TITLES: Array<Omit<NormalizedSearchResult, 'providerId' | 'providerName' | 'isMock'>> = [
  {
    providerTitleId: 'mock-glass-garden',
    title: '[TEST] Glass Garden Chronicles',
    alternateTitles: ['Glass Garden'],
    description:
      'Synthetic sample title for Source Network testing. Not a real catalog entry.',
    contentType: 'manga',
    language: 'en',
    publicationStatus: 'ongoing',
    genres: ['Drama', 'Test Data'],
    chapterCount: 12,
  },
  {
    providerTitleId: 'mock-parchment-pulse',
    title: '[TEST] Parchment Pulse',
    alternateTitles: ['Pulse of Parchment'],
    description: 'Synthetic manhwa-style sample used only for discovery UI tests.',
    contentType: 'manhwa',
    language: 'en',
    publicationStatus: 'completed',
    genres: ['Slice of Life', 'Test Data'],
    chapterCount: 48,
  },
  {
    providerTitleId: 'mock-oxblood-archive',
    title: '[TEST] Oxblood Archive',
    alternateTitles: [],
    description: 'Another clearly labeled mock record for multi-provider grouping tests.',
    contentType: 'manga',
    language: 'ja',
    publicationStatus: 'hiatus',
    genres: ['Mystery', 'Test Data'],
    chapterCount: 5,
  },
]

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Search cancelled', 'AbortError'))
      return
    }
    const timer = window.setTimeout(() => resolve(), ms)
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(new DOMException('Search cancelled', 'AbortError'))
      },
      { once: true },
    )
  })
}

export function createMockCatalogProvider(): MangaProvider {
  return {
    info: {
      id: 'mock-catalog',
      name: 'Test Catalog (sample data)',
      version: '0.1.0',
      description:
        'Built-in mock provider for development and UI testing. All results are synthetic and prefixed with [TEST].',
      isMock: true,
      capabilities: {
        search: true,
        metadata: true,
        chapterList: true,
        onlineReading: false,
        downloads: false,
      },
    },
    async search(query, options) {
      await delay(180, options?.signal)
      const needle = query.toLowerCase()
      return MOCK_TITLES.filter(
        (item) =>
          item.title.toLowerCase().includes(needle) ||
          item.alternateTitles.some((alt) => alt.toLowerCase().includes(needle)) ||
          item.genres.some((genre) => genre.toLowerCase().includes(needle)),
      ).map((item) => ({
        ...item,
        providerId: 'mock-catalog',
        providerName: 'Test Catalog (sample data)',
        isMock: true,
      }))
    },
    async healthCheck(signal): Promise<ProviderHealth> {
      const started = performance.now()
      await delay(40, signal)
      return {
        status: 'available',
        checkedAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        latencyMs: Math.round(performance.now() - started),
      }
    },
  }
}
