import { invoke } from '@tauri-apps/api/core'

import { isTauri } from '@/lib/api'

import type { MangaProvider, NormalizedSearchResult, ProviderHealth } from '../types'

interface AtsuSearchItem {
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
  isAdult: boolean
}

/**
 * Atsumaru (atsu.moe) — unofficial site JSON used by their own frontend
 * (same approach as Kotatsu / Harbor extensions). Not an official public API;
 * endpoints may change. Search + metadata only for now; reading opens atsu.moe.
 */
export function createAtsuProvider(): MangaProvider {
  return {
    info: {
      id: 'atsu',
      name: 'Atsumaru',
      version: '1.0.0',
      description:
        'Unofficial atsu.moe JSON (site frontend endpoints). Search, chapter list, and in-app online reading. Not affiliated with Atsumaru. Downloads remain disabled.',
      isMock: false,
      websiteUrl: 'https://atsu.moe',
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
        throw new Error('Atsumaru search requires the Fyodor desktop runtime.')
      }
      const items = await invoke<AtsuSearchItem[]>('atsu_search', {
        query,
        limit: 12,
      })
      return items.map(
        (item): NormalizedSearchResult => ({
          providerTitleId: item.id,
          providerId: 'atsu',
          providerName: 'Atsumaru',
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
        await invoke('atsu_health')
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
