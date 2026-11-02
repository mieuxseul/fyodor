import { invoke } from '@tauri-apps/api/core'

import { isTauri } from '@/lib/api'

import type { MangaProvider, NormalizedSearchResult, ProviderHealth } from '../types'

interface MangaDexSearchItem {
  id: string
  title: string
  alternateTitles: string[]
  description?: string | null
  coverUrl?: string | null
  contentType: string
  language?: string | null
  publicationStatus?: string | null
  genres: string[]
  author?: string | null
  websiteUrl: string
}

/**
 * Official MangaDex API integration.
 * Capabilities are limited to what the public API and AUP allow without
 * inventing endpoints: search + metadata. Chapter image reading/downloads
 * are not enabled here; users can open the official title page instead.
 *
 * Credits: MangaDex (https://mangadex.org) — required by their API AUP.
 */
export function createMangaDexProvider(): MangaProvider {
  return {
    info: {
      id: 'mangadex',
      name: 'MangaDex',
      version: '1.0.0',
      description:
        'Official MangaDex API (api.mangadex.org). Search, chapters, and in-app reading via at-home. Credit: MangaDex. Downloads remain disabled.',
      isMock: false,
      websiteUrl: 'https://mangadex.org',
      capabilities: {
        search: true,
        metadata: true,
        chapterList: true,
        onlineReading: true,
        downloads: false,
      },
    },
    async search(query) {
      if (!isTauri()) {
        throw new Error('MangaDex search requires the FYODOR desktop runtime.')
      }
      const items = await invoke<MangaDexSearchItem[]>('mangadex_search', {
        query,
        limit: 12,
      })
      return items.map(
        (item): NormalizedSearchResult => ({
          providerTitleId: item.id,
          providerId: 'mangadex',
          providerName: 'MangaDex',
          title: item.title,
          alternateTitles: item.alternateTitles,
          description: item.description ?? undefined,
          coverUrl: item.coverUrl ?? undefined,
          contentType:
            item.contentType === 'manhwa'
              ? 'manhwa'
              : item.contentType === 'comic'
                ? 'comic'
                : 'manga',
          language: item.language ?? undefined,
          publicationStatus: item.publicationStatus ?? undefined,
          genres: item.genres,
          isMock: false,
          raw: item,
        }),
      )
    },
    async healthCheck(): Promise<ProviderHealth> {
      const started = performance.now()
      if (!isTauri()) {
        return {
          status: 'unavailable',
          checkedAt: new Date().toISOString(),
          lastError: 'Desktop runtime required',
          latencyMs: Math.round(performance.now() - started),
        }
      }
      try {
        await invoke('mangadex_health')
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
