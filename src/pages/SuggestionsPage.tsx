import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { DiscoverCoverCard } from '@/components/discover/DiscoverCoverCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs'
import { isTauri } from '@/lib/api'
import { cn } from '@/lib/cn'
import { gridColsClass } from '@/lib/library-display'
import {
  ensureSourceNetworkReady,
  searchProviders,
  type GroupedSearchResult,
} from '@/source-network'

export function SuggestionsPage() {
  const navigate = useNavigate()
  const display = useDisplayPrefs()
  const [params] = useSearchParams()
  const seedQuery = params.get('q') ?? ''
  const [query, setQuery] = useState(seedQuery)
  const [groups, setGroups] = useState<GroupedSearchResult[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setGroups([])
      return
    }
    if (!isTauri()) {
      setError('Suggestions need the desktop app.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const network = await ensureSourceNetworkReady()
      const providers = network.getEnabledProviders()
      const report = await searchProviders({ query: trimmed, providers })
      setGroups(report.groups.slice(0, 24))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setGroups([])
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (seedQuery.trim()) void run(seedQuery)
  }, [seedQuery, run])

  // Live suggestions while typing.
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setGroups([])
      setBusy(false)
      return
    }
    if (trimmed === seedQuery.trim()) return
    const handle = window.setTimeout(() => {
      void run(trimmed)
    }, 380)
    return () => window.clearTimeout(handle)
  }, [query, seedQuery, run])

  const subtitle = useMemo(() => {
    if (seedQuery) return `Based on “${seedQuery}”.`
    return 'Search enabled sources for related titles and recommendations.'
  }, [seedQuery])

  function openGroup(group: GroupedSearchResult) {
    const local = group.editions.find((e) => e.providerId === 'local-library')
    if (local) {
      navigate(`/title/${local.providerTitleId}`)
      return
    }
    const atsu = group.editions.find((e) => e.providerId === 'atsu')
    if (atsu) {
      navigate(`/remote/atsu/${atsu.providerTitleId}`)
      return
    }
    const mangadex = group.editions.find((e) => e.providerId === 'mangadex')
    if (mangadex) {
      navigate(`/remote/mangadex/${mangadex.providerTitleId}`)
      return
    }
    const kotatsu = group.editions.find((e) => e.providerId === 'kotatsu')
    if (kotatsu) {
      navigate(`/remote/kotatsu/${encodeURIComponent(kotatsu.providerTitleId)}`)
    }
  }

  return (
    <div>
      <PageHeader
        title="Suggestions"
        subtitle={subtitle}
        actions={
          <Button variant="secondary" onClick={() => navigate('/discover')}>
            Open Discover
          </Button>
        }
      />

      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void run(query)
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a title, genre, or author…"
          className="fy-liquid-control h-10 min-w-[16rem] flex-1 px-3 text-sm"
        />
        <Button type="submit" variant="primary" disabled={busy || !query.trim()}>
          {busy ? 'Searching…' : 'Find similar'}
        </Button>
      </form>

      {error ? <p className="mb-4 text-sm text-[var(--fy-danger)]">{error}</p> : null}

      {!busy && groups.length === 0 ? (
        <EmptyState
          title="No suggestions yet"
          description="Enter a title or genre, or open a book and tap Find similar / Suggestions."
        />
      ) : display.mode === 'details' ? (
        <div className="divide-y divide-[var(--fy-border-subtle)]">
          {groups.map((group) => (
            <DiscoverCoverCard
              key={group.groupId}
              group={group}
              view="details"
              onOpen={openGroup}
              onLibraryError={(message) => {
                setError(message)
              }}
            />
          ))}
        </div>
      ) : (
        <div className={cn('grid gap-3', gridColsClass(display.gridSize))}>
          {groups.map((group) => (
            <DiscoverCoverCard
              key={group.groupId}
              group={group}
              view={display.mode === 'compact' ? 'compact' : 'grid'}
              onOpen={openGroup}
              onLibraryError={(message) => {
                setError(message)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
