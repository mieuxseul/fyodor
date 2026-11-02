export type ProviderHealthStatus =
  | 'available'
  | 'degraded'
  | 'unavailable'
  | 'disabled'
  | 'authentication_required'

export type ContentType = 'manga' | 'manhwa' | 'comic' | 'unknown'

export interface ProviderCapabilities {
  search: boolean
  metadata: boolean
  chapterList: boolean
  onlineReading: boolean
  downloads: boolean
}

export interface ProviderInfo {
  id: string
  name: string
  version: string
  description: string
  isMock: boolean
  websiteUrl?: string
  capabilities: ProviderCapabilities
}

export interface ProviderHealth {
  status: ProviderHealthStatus
  checkedAt?: string
  lastSuccessAt?: string
  lastError?: string
  latencyMs?: number
}

export interface ProviderRegistration {
  info: ProviderInfo
  enabled: boolean
  health: ProviderHealth
}

export interface NormalizedSearchResult {
  /** Stable key within a provider */
  providerTitleId: string
  providerId: string
  providerName: string
  title: string
  alternateTitles: string[]
  description?: string
  coverUrl?: string
  contentType: ContentType
  language?: string
  publicationStatus?: string
  genres: string[]
  chapterCount?: number
  isMock: boolean
  /** Original provider payload kept for debugging / future use */
  raw?: unknown
}

export interface SearchEdition {
  providerId: string
  providerName: string
  providerTitleId: string
  language?: string
  chapterCount?: number
  capabilities: ProviderCapabilities
  isMock: boolean
  websiteUrl?: string
}

export interface GroupedSearchResult {
  groupId: string
  primaryTitle: string
  alternateTitles: string[]
  description?: string
  coverUrl?: string
  contentType: ContentType
  publicationStatus?: string
  genres: string[]
  latestChapterLabel?: string
  editions: SearchEdition[]
  confidence: 'exact' | 'likely' | 'related'
  isMock: boolean
}

export interface ProviderSearchOutcome {
  providerId: string
  providerName: string
  ok: boolean
  results: NormalizedSearchResult[]
  error?: string
  timedOut?: boolean
  cancelled?: boolean
  durationMs: number
}

export interface DiscoverySearchReport {
  query: string
  startedAt: string
  finishedAt: string
  outcomes: ProviderSearchOutcome[]
  groups: GroupedSearchResult[]
  cancelled: boolean
}

export interface MangaProvider {
  info: ProviderInfo
  search(
    query: string,
    options?: { signal?: AbortSignal; timeoutMs?: number },
  ): Promise<NormalizedSearchResult[]>
  healthCheck?(signal?: AbortSignal): Promise<ProviderHealth>
}
