export { groupSearchResults, normalizeQuery, normalizeTitleKey } from './normalize'
export { searchProviders } from './orchestrate'
export { ensureSourceNetworkReady, getSourceNetwork, ProviderRegistry } from './registry'
export type {
  DiscoverySearchReport,
  GroupedSearchResult,
  MangaProvider,
  NormalizedSearchResult,
  ProviderCapabilities,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderInfo,
  ProviderRegistration,
  ProviderSearchOutcome,
  SearchEdition,
} from './types'
