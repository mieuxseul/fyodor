import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { api, isTauri } from '@/lib/api'

type KotatsuSource = {
  id: string
  title: string
  locale: string
  contentType: string
  broken: boolean
  domain?: string | null
}

export function KotatsuCatalog() {
  const [sources, setSources] = useState<KotatsuSource[]>([])
  const [enabled, setEnabled] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [locale, setLocale] = useState('en')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isTauri()) {
      setError('Desktop runtime required for the Kotatsu catalog.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [list, enabledIds] = await Promise.all([
        api.kotatsuListSources(),
        api.kotatsuGetEnabledSources(),
      ])
      setSources(list.sources ?? [])
      setEnabled(new Set(enabledIds))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const locales = useMemo(() => {
    const set = new Set(sources.map((s) => s.locale || 'other'))
    return ['en', ...[...set].filter((l) => l !== 'en').sort()]
  }, [sources])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sources
      .filter((s) => (locale === 'all' ? true : (s.locale || '') === locale))
      .filter((s) => {
        if (!q) return true
        return (
          s.id.toLowerCase().includes(q) ||
          s.title.toLowerCase().includes(q) ||
          (s.domain ?? '').toLowerCase().includes(q)
        )
      })
      .slice(0, 200)
  }, [sources, query, locale])

  async function persist(next: Set<string>) {
    setSaving(true)
    setError(null)
    try {
      await api.kotatsuSetEnabledSources([...next])
      setEnabled(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  function toggle(id: string) {
    const next = new Set(enabled)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    void persist(next)
  }

  return (
    <section className="mt-8 rounded-xl border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Kotatsu catalog</h2>
          <p className="mt-1 text-sm text-[var(--fy-text-muted)]">
            {sources.length
              ? `${sources.length} parsers from Kotatsu-Redo (GPL sidecar). Discover searches only enabled sources (${enabled.size} on).`
              : 'Load the Kotatsu-Redo parser list via the local bridge jar.'}
          </p>
        </div>
        <Button size="sm" variant="secondary" disabled={loading || saving} onClick={() => void refresh()}>
          Refresh list
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-[var(--fy-danger)]">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className="min-w-[12rem] flex-1 rounded-md border border-[var(--fy-border-subtle)] bg-transparent px-3 py-2 text-sm"
          placeholder="Filter by name, id, domain…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="rounded-md border border-[var(--fy-border-subtle)] bg-transparent px-3 py-2 text-sm"
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
        >
          <option value="all">All locales</option>
          {locales.map((item) => (
            <option key={item} value={item}>
              {item || 'other'}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-[var(--fy-text-muted)]">Loading Kotatsu sources…</p>
      ) : (
        <ul className="mt-3 max-h-80 space-y-1 overflow-auto pr-1">
          {filtered.map((source) => {
            const on = enabled.has(source.id)
            return (
              <li
                key={source.id}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-[var(--fy-nav-active)]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {source.title}
                    {source.broken ? (
                      <span className="ml-2 text-[10px] uppercase text-[var(--fy-danger)]">
                        broken
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate font-mono text-[11px] text-[var(--fy-text-muted)]">
                    {source.id}
                    {source.domain ? ` · ${source.domain}` : ''}
                    {source.locale ? ` · ${source.locale}` : ''}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={on ? 'secondary' : 'primary'}
                  disabled={saving}
                  onClick={() => toggle(source.id)}
                >
                  {on ? 'On' : 'Off'}
                </Button>
              </li>
            )
          })}
          {filtered.length === 0 ? (
            <li className="py-6 text-center text-sm text-[var(--fy-text-muted)]">
              No sources match this filter.
            </li>
          ) : null}
        </ul>
      )}
    </section>
  )
}
