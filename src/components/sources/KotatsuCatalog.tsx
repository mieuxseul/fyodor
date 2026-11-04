import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { api, isTauri } from '@/lib/api'

const ENABLED_SETTING = 'kotatsu_enabled_sources'

type KotatsuSource = {
  id: string
  title: string
  locale: string
  contentType: string
  broken: boolean
  domain?: string | null
}

async function loadEnabledIds(): Promise<string[]> {
  const raw = await api.getSetting(ENABLED_SETTING)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
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
      setError('Desktop runtime required for Other sources.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [list, enabledIds] = await Promise.all([api.kotatsuListSources(), loadEnabledIds()])
      setSources(
        list.map((s) => ({
          id: s.name,
          title: s.title || s.name,
          locale: s.locale || 'other',
          contentType: s.contentType || 'manga',
          broken: Boolean(s.broken),
          domain: s.domain,
        })),
      )
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
      await api.setSetting(ENABLED_SETTING, JSON.stringify([...next]))
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
          <h2 className="text-base font-semibold tracking-tight">Other sources</h2>
          <p className="mt-1 text-sm text-[var(--fy-text-muted)]">
            {sources.length
              ? `${sources.length} catalog parsers. Discover searches only enabled sources (${enabled.size} on).`
              : 'Load the parser list via the local bridge jar.'}
          </p>
        </div>
        <Button variant="secondary" disabled={loading || saving} onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-[var(--fy-danger)]">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter sources…"
          className="min-w-[12rem] flex-1 rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-1.5 text-sm"
        />
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          className="rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-2 py-1.5 text-sm"
        >
          <option value="all">All locales</option>
          {locales.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto">
        {loading ? (
          <li className="text-sm text-[var(--fy-text-muted)]">Loading sources…</li>
        ) : filtered.length === 0 ? (
          <li className="text-sm text-[var(--fy-text-muted)]">No sources match.</li>
        ) : (
          filtered.map((source) => (
            <li
              key={source.id}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--fy-panel)]"
            >
              <input
                type="checkbox"
                checked={enabled.has(source.id)}
                disabled={saving}
                onChange={() => toggle(source.id)}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {source.title}
                  {source.broken ? (
                    <span className="ml-2 text-[10px] uppercase text-[var(--fy-danger)]">broken</span>
                  ) : null}
                </div>
                <div className="truncate font-mono text-[10px] text-[var(--fy-text-muted)]">
                  {source.id}
                  {source.domain ? ` · ${source.domain}` : ''}
                  {` · ${source.locale}`}
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
