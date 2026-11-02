import { api, isTauri } from '@/lib/api'

import { createAtsuProvider } from './providers/atsu'
import { createKotatsuProvider } from './providers/kotatsu'
import { createLocalLibraryProvider } from './providers/local-library'
import { createMangaDexProvider } from './providers/mangadex'
import { createMockCatalogProvider } from './providers/mock-catalog'
import type {
  MangaProvider,
  ProviderHealth,
  ProviderRegistration,
} from './types'

const ENABLED_KEY_PREFIX = 'provider.enabled.'

export class ProviderRegistry {
  private providers = new Map<string, MangaProvider>()
  private enabled = new Map<string, boolean>()
  private health = new Map<string, ProviderHealth>()

  register(provider: MangaProvider, defaultEnabled = true): void {
    if (this.providers.has(provider.info.id)) {
      throw new Error(`Provider already registered: ${provider.info.id}`)
    }
    this.providers.set(provider.info.id, provider)
    this.enabled.set(provider.info.id, defaultEnabled)
    this.health.set(provider.info.id, {
      status: defaultEnabled ? 'available' : 'disabled',
    })
  }

  list(): ProviderRegistration[] {
    return [...this.providers.values()].map((provider) => ({
      info: provider.info,
      enabled: this.enabled.get(provider.info.id) ?? false,
      health: this.health.get(provider.info.id) ?? { status: 'disabled' },
    }))
  }

  getEnabledProviders(): MangaProvider[] {
    return [...this.providers.values()].filter(
      (provider) => this.enabled.get(provider.info.id) === true,
    )
  }

  getProvider(id: string): MangaProvider | undefined {
    return this.providers.get(id)
  }

  async loadPersistedState(): Promise<void> {
    if (!isTauri()) return
    for (const id of this.providers.keys()) {
      const value = await api.getSetting(`${ENABLED_KEY_PREFIX}${id}`)
      if (value === 'true' || value === 'false') {
        this.enabled.set(id, value === 'true')
        const health = this.health.get(id)
        if (value === 'false') {
          this.health.set(id, { status: 'disabled', checkedAt: health?.checkedAt })
        }
      }
    }
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    if (!this.providers.has(id)) {
      throw new Error(`Unknown provider: ${id}`)
    }
    this.enabled.set(id, enabled)
    this.health.set(id, {
      status: enabled ? 'available' : 'disabled',
      checkedAt: new Date().toISOString(),
    })
    if (isTauri()) {
      await api.setSetting(`${ENABLED_KEY_PREFIX}${id}`, enabled ? 'true' : 'false')
    }
  }

  async checkHealth(id: string): Promise<ProviderHealth> {
    const provider = this.providers.get(id)
    if (!provider) throw new Error(`Unknown provider: ${id}`)
    if (!(this.enabled.get(id) ?? false)) {
      const disabled: ProviderHealth = {
        status: 'disabled',
        checkedAt: new Date().toISOString(),
      }
      this.health.set(id, disabled)
      return disabled
    }

    if (!provider.healthCheck) {
      const fallback: ProviderHealth = {
        status: 'available',
        checkedAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
      }
      this.health.set(id, fallback)
      return fallback
    }

    try {
      const result = await provider.healthCheck()
      this.health.set(id, result)
      return result
    } catch (error) {
      const failed: ProviderHealth = {
        status: 'unavailable',
        checkedAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : String(error),
      }
      this.health.set(id, failed)
      return failed
    }
  }

  async checkAllHealth(): Promise<ProviderRegistration[]> {
    for (const id of this.providers.keys()) {
      await this.checkHealth(id)
    }
    return this.list()
  }
}

let singleton: ProviderRegistry | null = null

export function getSourceNetwork(): ProviderRegistry {
  if (singleton) return singleton
  const registry = new ProviderRegistry()
  // Local library is always available by default.
  registry.register(createLocalLibraryProvider(), true)
  // Official MangaDex API — enabled by default; health reflects network availability.
  registry.register(createMangaDexProvider(), true)
  // Atsumaru (atsu.moe) — unofficial site JSON; enabled by default (same pattern as Kotatsu clients).
  registry.register(createAtsuProvider(), true)
  // Kotatsu-Redo parser catalog via GPL sidecar (1,300+ sources; enable subset in Sources).
  registry.register(createKotatsuProvider(), true)
  // Mock catalog is available but disabled until the user opts in.
  registry.register(createMockCatalogProvider(), false)
  singleton = registry
  return registry
}

export async function ensureSourceNetworkReady(): Promise<ProviderRegistry> {
  const registry = getSourceNetwork()
  await registry.loadPersistedState()
  return registry
}
