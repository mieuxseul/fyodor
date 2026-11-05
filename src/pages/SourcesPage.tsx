import { useCallback, useEffect, useMemo, useState } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ensureSourceNetworkReady } from '@/source-network'
import {
  listKotatsuSources,
  loadEnabledKotatsuSources,
  saveEnabledKotatsuSources,
  type KotatsuSourceInfo,
} from '@/source-network/providers/kotatsu'

export function SourcesPage() {
  const [error, setError] = useState<string | null>(null)
  const [kotatsuSources, setKotatsuSources] = useState<KotatsuSourceInfo[]>([])
  const [kotatsuEnabled, setKotatsuEnabled] = useState<Set<string>>(new Set())
  const [kotatsuFilter, setKotatsuFilter] = useState('')
  const [kotatsuLoading, setKotatsuLoading] = useState(false)
  const [kotatsuVisible, setKotatsuVisible] = useState(80)

  const refreshKotatsu = useCallback(async () => {
    setKotatsuLoading(true)
    setError(null)
    try {
      // Warm provider registry so Discover keeps MangaDex / Atsumaru / Other sources working.
      await ensureSourceNetworkReady()
      const [sources, enabled] = await Promise.all([
        listKotatsuSources(),
        loadEnabledKotatsuSources(),
      ])
      setKotatsuSources(sources)
      setKotatsuEnabled(new Set(enabled))
      setKotatsuVisible(80)
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      const lower = raw.toLowerCase()
      // Never dump JVM / path / JAR jargon at non-technical users.
      if (
        lower.includes('java') ||
        lower.includes('bridge') ||
        lower.includes('jar') ||
        lower.includes('kotatsu')
      ) {
        setError(
          'Other sources couldn’t start. Tap Reload catalog. If it still fails, reinstall Fyodor.',
        )
      } else {
        setError(raw)
      }
    } finally {
      setKotatsuLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshKotatsu()
  }, [refreshKotatsu])

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

  const visibleKotatsu = useMemo(
    () => filteredKotatsu.slice(0, kotatsuVisible),
    [filteredKotatsu, kotatsuVisible],
  )

  async function toggleKotatsuSource(name: string, enabled: boolean) {
    const next = new Set(kotatsuEnabled)
    if (enabled) next.add(name)
    else next.delete(name)
    setKotatsuEnabled(next)
    await saveEnabledKotatsuSources([...next])
  }

  return (
    <div>
      <PageHeader
        title="Sources"
        subtitle="Turn on extra catalogs for Discover. MangaDex and Atsumaru stay available automatically."
        actions={
          <Button
            variant="secondary"
            disabled={kotatsuLoading}
            onClick={() => void refreshKotatsu()}
          >
            Reload catalog
          </Button>
        }
      />

      {error ? <p className="mb-4 text-sm text-[var(--fy-danger)]">{error}</p> : null}

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Other sources</h2>
            <p className="mt-1 text-sm text-[var(--fy-text-muted)]">
              {kotatsuSources.length
                ? `${kotatsuSources.length} catalogs · ${kotatsuEnabled.size} enabled for Discover`
                : 'Extra catalogs included with Fyodor — no extra setup.'}
            </p>
          </div>
          <input
            value={kotatsuFilter}
            onChange={(e) => setKotatsuFilter(e.target.value)}
            placeholder="Filter sources…"
            className="h-9 w-56 rounded-lg border border-[var(--fy-border-subtle)] bg-transparent px-3 text-sm"
          />
        </div>

        {kotatsuLoading && kotatsuSources.length === 0 ? (
          <p className="text-sm text-[var(--fy-text-muted)]">Loading other sources…</p>
        ) : filteredKotatsu.length === 0 ? (
          <EmptyState
            title="No other sources"
            description={
              error
                ? 'Try Reload catalog, or reinstall Fyodor.'
                : 'Nothing matches this filter.'
            }
          />
        ) : (
          <>
            <ul className="max-h-[32rem] space-y-2 overflow-y-auto rounded-xl border border-[var(--fy-border-subtle)] p-2">
              {visibleKotatsu.map((source) => {
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
            {filteredKotatsu.length > visibleKotatsu.length ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[var(--fy-text-muted)]">
                  Showing {visibleKotatsu.length} of {filteredKotatsu.length}
                  {kotatsuFilter.trim() ? '' : ' — filter to narrow the catalog'}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setKotatsuVisible((n) => n + 80)}
                >
                  Show more
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
