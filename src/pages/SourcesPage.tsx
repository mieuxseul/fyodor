import { useCallback, useEffect, useMemo, useState } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { KotatsuCatalog } from '@/components/sources/KotatsuCatalog'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { api } from '@/lib/api'
import {
  ensureSourceNetworkReady,
  type ProviderRegistration,
} from '@/source-network'
import {
  listKotatsuSources,
  loadEnabledKotatsuSources,
  saveEnabledKotatsuSources,
  type KotatsuSourceInfo,
} from '@/source-network/providers/kotatsu'

function statusLabel(status: string): string {
  switch (status) {
    case 'available':
      return 'Available'
    case 'degraded':
      return 'Degraded'
    case 'unavailable':
      return 'Temporarily unavailable'
    case 'authentication_required':
      return 'Authentication required'
    case 'disabled':
      return 'Disabled'
    default:
      return status
  }
}

export function SourcesPage() {
  const [providers, setProviders] = useState<ProviderRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kotatsuSources, setKotatsuSources] = useState<KotatsuSourceInfo[]>([])
  const [kotatsuEnabled, setKotatsuEnabled] = useState<Set<string>>(new Set())
  const [kotatsuFilter, setKotatsuFilter] = useState('')
  const [kotatsuLoading, setKotatsuLoading] = useState(false)

  const refresh = useCallback(async () => {
    const network = await ensureSourceNetworkReady()
    setProviders(network.list())
    setLoading(false)
  }, [])

  const refreshKotatsu = useCallback(async () => {
    setKotatsuLoading(true)
    try {
      const [sources, enabled] = await Promise.all([
        listKotatsuSources(),
        loadEnabledKotatsuSources(),
      ])
      setKotatsuSources(sources)
      setKotatsuEnabled(new Set(enabled))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setKotatsuLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh().catch((err) => {
      setError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    })
    void refreshKotatsu()
  }, [refresh, refreshKotatsu])

  const filteredKotatsu = useMemo(() => {
    const q = kotatsuFilter.trim().toLowerCase()
    if (!q) return kotatsuSources
    return kotatsuSources.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.locale.toLowerCase().includes(q) ||
        (s.domain ?? '').toLowerCase().includes(q),
    )
  }, [kotatsuSources, kotatsuFilter])

  async function toggleKotatsuSource(name: string, enabled: boolean) {
    const next = new Set(kotatsuEnabled)
    if (enabled) next.add(name)
    else next.delete(name)
    setKotatsuEnabled(next)
    await saveEnabledKotatsuSources([...next])
  }

  async function toggle(id: string, enabled: boolean) {
    setBusyId(id)
    setError(null)
    try {
      const network = await ensureSourceNetworkReady()
      await network.setEnabled(id, enabled)
      if (enabled) await network.checkHealth(id)
      setProviders(network.list())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
    }
  }

  async function retry(id: string) {
    setBusyId(id)
    setError(null)
    try {
      const network = await ensureSourceNetworkReady()
      await network.checkHealth(id)
      setProviders(network.list())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
    }
  }

  async function checkAll() {
    setBusyId('__all__')
    setError(null)
    try {
      const network = await ensureSourceNetworkReady()
      setProviders(await network.checkAllHealth())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Sources"
        subtitle="Provider registry and health. Kotatsu-Redo’s full parser catalog is managed below; Discover only queries sources you enable."
        actions={
          <Button
            variant="secondary"
            disabled={loading || busyId !== null}
            onClick={() => void checkAll()}
          >
            Check health
          </Button>
        }
      />

      {error ? <p className="mb-4 text-sm text-[var(--fy-danger)]">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-[var(--fy-text-muted)]">Loading providers…</p>
      ) : providers.length === 0 ? (
        <EmptyState
          title="No providers registered"
          description="The Source Network registry is empty."
        />
      ) : (
        <ul className="space-y-3">
          {providers.map((provider) => (
            <li
              key={provider.info.id}
              className="fy-liquid-tile p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold tracking-tight">{provider.info.name}</h2>
                    {provider.info.isMock ? (
                      <span className="rounded-md bg-[var(--fy-nav-active)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide">
                        Test data
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--fy-text-muted)]">
                    {provider.info.description}
                  </p>
                  {provider.info.id === 'mangadex' ? (
                    <p className="mt-1 text-xs text-[var(--fy-text-muted)]">
                      Credit: MangaDex · search, chapters, and in-app reading via api.mangadex.org ·
                      no ads · downloads disabled
                    </p>
                  ) : null}
                  {provider.info.id === 'atsu' ? (
                    <p className="mt-1 text-xs text-[var(--fy-text-muted)]">
                      Unofficial · atsu.moe frontend JSON · not affiliated with Atsumaru · in-app
                      chapter reading enabled · downloads disabled
                    </p>
                  ) : null}
                  <div className="mt-2 font-mono text-[11px] text-[var(--fy-text-muted)]">
                    v{provider.info.version} · {statusLabel(provider.health.status)}
                    {provider.health.latencyMs != null
                      ? ` · ${provider.health.latencyMs}ms`
                      : ''}
                  </div>
                  {provider.health.lastError ? (
                    <p className="mt-1 text-xs text-[var(--fy-danger)]">
                      {provider.health.lastError}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {provider.info.websiteUrl ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === provider.info.id}
                      onClick={() => void api.openExternalUrl(provider.info.websiteUrl!)}
                    >
                      Website
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant={provider.enabled ? 'secondary' : 'primary'}
                    disabled={busyId === provider.info.id}
                    onClick={() => void toggle(provider.info.id, !provider.enabled)}
                  >
                    {provider.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!provider.enabled || busyId === provider.info.id}
                    onClick={() => void retry(provider.info.id)}
                  >
                    Retry
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(provider.info.capabilities).map(([key, supported]) => (
                  <span
                    key={key}
                    className={
                      supported
                        ? 'rounded-md border border-[var(--fy-border-subtle)] px-2 py-1 text-xs'
                        : 'rounded-md border border-dashed border-[var(--fy-border-subtle)] px-2 py-1 text-xs text-[var(--fy-text-muted)] line-through'
                    }
                  >
                    {key}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Kotatsu catalog</h2>
            <p className="mt-1 text-sm text-[var(--fy-text-muted)]">
              {kotatsuSources.length
                ? `${kotatsuSources.length} parsers from Kotatsu-Redo · ${kotatsuEnabled.size} enabled for Discover`
                : 'Requires the GPL kotatsu-bridge JAR (see README).'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={kotatsuFilter}
              onChange={(e) => setKotatsuFilter(e.target.value)}
              placeholder="Filter sources…"
              className="h-9 w-56 rounded-lg border border-[var(--fy-border-subtle)] bg-transparent px-3 text-sm"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={kotatsuLoading}
              onClick={() => void refreshKotatsu()}
            >
              Reload catalog
            </Button>
          </div>
        </div>
        {kotatsuLoading && kotatsuSources.length === 0 ? (
          <p className="text-sm text-[var(--fy-text-muted)]">Loading Kotatsu sources…</p>
        ) : filteredKotatsu.length === 0 ? (
          <EmptyState
            title="No Kotatsu sources"
            description="Build the bridge JAR or adjust the filter."
          />
        ) : (
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto rounded-xl border border-[var(--fy-border-subtle)] p-2">
            {filteredKotatsu.map((source) => {
              const on = kotatsuEnabled.has(source.name)
              return (
                <li
                  key={source.name}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-[var(--fy-nav-active)]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {source.title}
                      {source.broken ? (
                        <span className="ml-2 text-xs text-[var(--fy-danger)]">broken</span>
                      ) : null}
                    </div>
                    <div className="truncate font-mono text-[11px] text-[var(--fy-text-muted)]">
                      {source.name}
                      {source.domain ? ` · ${source.domain}` : ''}
                      {source.locale ? ` · ${source.locale}` : ''}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={on ? 'secondary' : 'primary'}
                    onClick={() => void toggleKotatsuSource(source.name, !on)}
                  >
                    {on ? 'Disable' : 'Enable'}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
