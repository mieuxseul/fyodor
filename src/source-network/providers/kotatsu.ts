import { invoke } from '@tauri-apps/api/core'

import { api, isTauri } from '@/lib/api'

import type { MangaProvider, NormalizedSearchResult, ProviderHealth } from '../types'

export interface KotatsuSourceInfo {
  name: string
  title: string
  locale: string
  contentType: string
  broken: boolean
  domain?: string | null
}

interface KotatsuSearchItem {
  source: string
  mangaId: number
  title: string
  altTitles: string[]
  url: string
  publicUrl: string
  coverUrl?: string | null
  description?: string | null
  state?: string | null
  isAdult: boolean
  authors: string[]
  genres: string[]
  chapterCount?: number | null
}

const ENABLED_SOURCES_KEY = 'kotatsu.enabled.sources'
/** Default English sources enabled for Discover (user can expand in Sources). */
const DEFAULT_ENABLED = [
  // Native MangaDex provider already covers MD — keep Kotatsu on faster mirrors.
  'MANGAFIRE_EN',
  'ASURASCANS',
  'MANGAHERE',
]

export function encodeKotatsuTitleId(source: string, url: string): string {
  return `${source}::${encodeURIComponent(url)}`
}

export function decodeKotatsuTitleId(titleId: string): { source: string; url: string } | null {
  const idx = titleId.indexOf('::')
  if (idx <= 0) return null
  const source = titleId.slice(0, idx)
  const url = decodeURIComponent(titleId.slice(idx + 2))
  if (!source || !url) return null
  return { source, url }
}

export async function loadEnabledKotatsuSources(): Promise<string[]> {
  if (!isTauri()) return []
  const raw = await api.getSetting(ENABLED_SOURCES_KEY)
  if (!raw) return [...DEFAULT_ENABLED]
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string')
    }
  } catch {
    /* fall through */
  }
  return [...DEFAULT_ENABLED]
}

export async function saveEnabledKotatsuSources(names: string[]): Promise<void> {
  if (!isTauri()) return
  await api.setSetting(ENABLED_SOURCES_KEY, JSON.stringify([...new Set(names)]))
}

export async function listKotatsuSources(): Promise<KotatsuSourceInfo[]> {
  if (!isTauri()) return []
  return invoke<KotatsuSourceInfo[]>('kotatsu_list_sources')
}

function mapItem(item: KotatsuSearchItem): NormalizedSearchResult {
  return {
    providerTitleId: encodeKotatsuTitleId(item.source, item.url),
    providerId: 'kotatsu',
    providerName: `Kotatsu · ${item.source}`,
    title: item.title,
    alternateTitles: item.altTitles ?? [],
    description: item.description ?? undefined,
    coverUrl: item.coverUrl ?? undefined,
    contentType:
      item.source.toLowerCase().includes('manhwa') || item.source.toLowerCase().includes('webtoon')
        ? 'manhwa'
        : 'manga',
    publicationStatus: item.state ?? undefined,
    genres: item.genres ?? [],
    chapterCount: item.chapterCount ?? undefined,
    isMock: false,
    raw: item,
  }
}

/**
 * Aggregator provider: searches all user-enabled Kotatsu-Redo sources.
 * Full catalog (~1385) is managed on the Sources page; Discover only hits enabled ones.
 */
export function createKotatsuProvider(): MangaProvider {
  return {
    info: {
      id: 'kotatsu',
      name: 'Kotatsu sources',
      version: '0.1.0',
      description:
        'Kotatsu-Redo parsers (~1385 sources) via GPL sidecar. Enable individual sources under Sources. Not affiliated with the sites.',
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
      const enabled = (await loadEnabledKotatsuSources()).slice(0, 12)
      if (enabled.length === 0) return []

      const payload = await invoke<{ results?: KotatsuSearchItem[]; errors?: string[] }>(
        'kotatsu_search_many',
        {
          sources: enabled,
          query,
          limit: 6,
          timeoutMs: 12_000,
        },
      )
      const hits = payload.results ?? []
      const errors = payload.errors ?? []
      if (hits.length === 0 && errors.length > 0) {
        throw new Error(
          `Kotatsu sources failed (${errors.length}): ${errors.slice(0, 3).join(' · ')}`,
        )
      }
      return hits.map(mapItem)
    },
    async healthCheck(): Promise<ProviderHealth> {
      const started = performance.now()
      if (!isTauri()) {
        return {
          status: 'unavailable',
          checkedAt: new Date().toISOString(),
          lastError: 'Desktop runtime required',
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
