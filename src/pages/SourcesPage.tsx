import { useCallback, useEffect, useState } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { api } from '@/lib/api'
import {
  ensureSourceNetworkReady,
  type ProviderRegistration,
} from '@/source-network'

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

  const refresh = useCallback(async () => {
    const network = await ensureSourceNetworkReady()
    setProviders(network.list())
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh().catch((err) => {
      setError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    })
  }, [refresh])

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
        subtitle="Fyodor Source Network — provider registry, capabilities, and health. Official providers credit their hosts; downloads and in-app online reading stay disabled until explicitly authorized."
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
              className="rounded-xl border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] p-4"
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
    </div>
  )
}
