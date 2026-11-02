import type { DiscoverySearchReport } from '@/source-network'

const KEY = 'fyodor.discover.state.v1'

export interface DiscoverPersistedState {
  query: string
  contentType: string
  status: string
  sort: string
  report: DiscoverySearchReport | null
}

export function loadDiscoverState(): DiscoverPersistedState | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as DiscoverPersistedState
  } catch {
    return null
  }
}

export function saveDiscoverState(state: DiscoverPersistedState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Ignore quota / private-mode failures.
  }
}
