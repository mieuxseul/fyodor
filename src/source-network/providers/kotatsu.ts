import { invoke } from '@tauri-apps/api/core'

import { isTauri } from '@/lib/api'

import type { MangaProvider, NormalizedSearchResult, ProviderHealth } from '../types'

interface KotatsuSearchHit {
  id: string
  source: string
  title: string
  alternateTitles?: string[]
  url: string
  publicUrl?: string
  coverUrl?: string | null
  description?: string | null
  authors?: string[]
  tags?: string[]
  state?: string | null
}

/**
 * Kotatsu-Redo parser catalog via the GPL kotatsu-bridge sidecar.
 * Discover searches only user-enabled Kotatsu sources (defaults to a popular set).
 * Title IDs are encoded as `${source}::${url}` so details/chapters can round-trip.
 */
export function createKotatsuProvider(): MangaProvider {
  return {
    info: {
      id: 'kotatsu',
      name: 'Kotatsu catalog',
      version: '1.0.0',
      description:
        '1,300+ manga sources from Kotatsu-Redo parsers (GPL sidecar). Enable individual sources under Sources. Not affiliated with the listed sites.',
      isMock: false,
      websiteUrl: 'https://github.com/Kotatsu-Redo/kotatsu-parsers-redo',
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
        throw new Error('Kotatsu search requires the Fyodor desktop runtime.')
      }
      const payload = await invoke<{ results?: KotatsuSearchHit[]; errors?: string[] }>(
        'kotatsu_search_enabled',
        { query, limitPerSource: 6 },
      )
      const hits = payload.results ?? []
      return hits.map(
        (item): NormalizedSearchResult => ({
          providerTitleId: `${item.source}::${item.url}`,
          providerId: 'kotatsu',
          providerName: `Kotatsu · ${item.source}`,
          title: item.title,
          alternateTitles: item.alternateTitles ?? [],
          description: item.description ?? undefined,
          coverUrl: item.coverUrl ?? undefined,
          contentType: 'manga',
          publicationStatus: item.state ?? undefined,
          genres: item.tags ?? [],
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
        await invoke('kotatsu_health')
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
