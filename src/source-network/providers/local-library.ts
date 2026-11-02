import { api } from '@/lib/api'

import type { MangaProvider, NormalizedSearchResult, ProviderHealth } from '../types'

export function createLocalLibraryProvider(): MangaProvider {
  return {
    info: {
      id: 'local-library',
      name: 'Local Library',
      version: '1.0.0',
      description: 'Search titles already imported into your FYODOR library.',
      isMock: false,
      capabilities: {
        search: true,
        metadata: true,
        chapterList: true,
        onlineReading: false,
        downloads: false,
      },
    },
    async search(query) {
      const items = await api.searchLibrary(query)
      return items.map(
        (item): NormalizedSearchResult => ({
          providerTitleId: item.title.id,
          providerId: 'local-library',
          providerName: 'Local Library',
          title: item.title.primaryTitle,
          alternateTitles: item.title.alternateTitles,
          description: item.title.description ?? undefined,
          coverUrl: item.title.coverPath ?? undefined,
          contentType:
            item.title.contentType === 'manhwa'
              ? 'manhwa'
              : item.title.contentType === 'comic'
                ? 'comic'
                : 'manga',
          language: item.title.originalLanguage ?? undefined,
          publicationStatus: item.title.publicationStatus ?? undefined,
          genres: item.title.genres,
          chapterCount: item.chapterCount,
          isMock: false,
        }),
      )
    },
    async healthCheck(): Promise<ProviderHealth> {
      const started = performance.now()
      try {
        await api.listLibrary({ status: 'all', sort: 'title' })
        return {
          status: 'available',
          checkedAt: new Date().toISOString(),
          lastSuccessAt: new Date().toISOString(),
          latencyMs: Math.round(performance.now() - started),
        }
      } catch (error) {
        return {
          status: 'unavailable',
          checkedAt: new Date().toISOString(),
          lastError: error instanceof Error ? error.message : String(error),
          latencyMs: Math.round(performance.now() - started),
        }
      }
    },
  }
}
