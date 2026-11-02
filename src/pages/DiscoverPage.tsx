import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { DiscoverCoverCard } from '@/components/discover/DiscoverCoverCard'
import { DiscoverGridSkeleton } from '@/components/discover/DiscoverGridSkeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { loadDiscoverState, saveDiscoverState } from '@/lib/discover-state'
import {
  ensureSourceNetworkReady,
  searchProviders,
  type DiscoverySearchReport,
  type GroupedSearchResult,
} from '@/source-network'

export function DiscoverPage() {
  const navigate = useNavigate()
  const restored = useRef(loadDiscoverState())
  const [query, setQuery] = useState(restored.current?.query ?? '')
  const [report, setReport] = useState<DiscoverySearchReport | null>(
    restored.current?.report ?? null,
  )
  const [searching, setSearching] = useState(false)
  const [ready, setReady] = useState(false)
  const [enabledCount, setEnabledCount] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const [contentType, setContentType] = useState(restored.current?.contentType ?? 'all')
  const [status, setStatus] = useState(restored.current?.status ?? 'all')
  const [sort, setSort] = useState(restored.current?.sort ?? 'title')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    void (async () => {
      const network = await ensureSourceNetworkReady()
      setEnabledCount(network.getEnabledProviders().length)
      setReady(true)
    })()
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    saveDiscoverState({ query, contentType, status, sort, report })
  }, [query, contentType, status, sort, report])

  async function runSearch(nextQuery = query) {
    const network = await ensureSourceNetworkReady()
    const providers = network.getEnabledProviders()
    setEnabledCount(providers.length)
    setActionError(null)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSearching(true)
    try {
      const result = await searchProviders({
        query: nextQuery,
        providers,
        signal: controller.signal,
      })
      if (!controller.signal.aborted) {
        setReport(result)
      }
    } finally {
      if (!controller.signal.aborted) {
        setSearching(false)
      }
    }
  }

  function cancelSearch() {
    abortRef.current?.abort()
    setSearching(false)
  }

  function openGroup(group: GroupedSearchResult) {
    setActionError(null)
    // Always keep title info in-app — never open the browser from Discover cards.
    const local = group.editions.find((edition) => edition.providerId === 'local-library')
    if (local) {
      navigate(`/title/${local.providerTitleId}`)
      return
    }

    // Prefer Atsumaru when both remote editions exist (in-app reading).
    const atsu = group.editions.find((edition) => edition.providerId === 'atsu')
    if (atsu) {
      navigate(`/remote/atsu/${atsu.providerTitleId}`)
      return
    }

    const mangadex = group.editions.find((edition) => edition.providerId === 'mangadex')
    if (mangadex) {
      navigate(`/remote/mangadex/${mangadex.providerTitleId}`)
      return
    }

    const mock = group.editions.find((edition) => edition.providerId === 'mock-catalog')
    if (mock) {
      setActionError('Test catalog titles have no remote details page.')
      return
    }

    setActionError('No in-app details route for this provider yet. Enable Atsumaru or MangaDex.')
  }

  const filteredGroups = useMemo(() => {
    if (!report) return []
    let groups = [...report.groups]
    if (contentType !== 'all') {
      groups = groups.filter((g) => g.contentType === contentType)
    }
    if (status !== 'all') {
      groups = groups.filter(
        (g) => (g.publicationStatus ?? '').toLowerCase().replace(/\s+/g, '_') === status,
      )
    }
    groups.sort((a, b) => {
      if (sort === 'type') return a.contentType.localeCompare(b.contentType)
      if (sort === 'status') {
        return (a.publicationStatus ?? '').localeCompare(b.publicationStatus ?? '')
      }
      return a.primaryTitle.localeCompare(b.primaryTitle)
    })
    return groups
  }, [report, contentType, status, sort])

  const hasFailures = Boolean(report?.outcomes.some((item) => !item.ok && !item.cancelled))
  const hasResults = filteredGroups.length > 0

  return (
    <div>
      <PageHeader
        title="Discover"
        subtitle="Browse covers from enabled providers. Click a title for full details and chapters."
        actions={
          <Button variant="secondary" onClick={() => navigate('/sources')}>
            Manage sources
          </Button>
        }
      />

      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void runSearch()
        }}
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles across enabled sources…"
          className="min-w-[240px] flex-1 rounded-xl border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] px-3 py-2 text-sm outline-none focus:border-[var(--fy-border)]"
        />
        <Button type="submit" variant="primary" disabled={!ready || searching || !query.trim()}>
          Search
        </Button>
        <Button type="button" variant="secondary" disabled={!searching} onClick={cancelSearch}>
          Cancel
        </Button>
      </form>

      <div className="mb-5 flex flex-wrap gap-2">
        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          className="rounded-lg border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] px-2.5 py-1.5 text-sm"
          aria-label="Filter by content type"
        >
          <option value="all">All types</option>
          <option value="manga">Manga</option>
          <option value="manhwa">Manhwa</option>
          <option value="comic">Comic / Manhua</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] px-2.5 py-1.5 text-sm"
          aria-label="Filter by publication status"
        >
          <option value="all">All statuses</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
          <option value="hiatus">Hiatus</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] px-2.5 py-1.5 text-sm"
          aria-label="Sort results"
        >
          <option value="title">Sort by title</option>
          <option value="type">Sort by type</option>
          <option value="status">Sort by status</option>
        </select>
      </div>

      {actionError ? <p className="mb-4 text-sm text-[var(--fy-danger)]">{actionError}</p> : null}

      {!ready ? (
        <p className="text-sm text-[var(--fy-text-muted)]">Preparing Source Network…</p>
      ) : enabledCount === 0 ? (
        <EmptyState
          title="No providers enabled"
          description="Enable Local Library, MangaDex, Atsumaru, or the optional Test Catalog from Sources to begin discovery."
          action={
            <Button variant="primary" onClick={() => navigate('/sources')}>
              Open Sources
            </Button>
          }
        />
      ) : searching ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--fy-text-muted)]">
            Searching {enabledCount} provider{enabledCount === 1 ? '' : 's'}…
          </p>
          <DiscoverGridSkeleton />
        </div>
      ) : !report ? (
        <EmptyState
          title="Ready to discover"
          description={`${enabledCount} provider${enabledCount === 1 ? '' : 's'} enabled. Search to load real covers and titles from your sources.`}
        />
      ) : !hasResults ? (
        <EmptyState
          title={report.cancelled ? 'Search cancelled' : 'No results'}
          description={
            report.cancelled
              ? 'The previous search was cancelled. Run it again when ready.'
              : report.groups.length > 0
                ? 'No titles match the current filters. Clear filters or try another search.'
                : `No matches for “${report.query}”. Partial provider failures do not hide successful results.`
          }
        />
      ) : (
        <div className="space-y-4">
          {hasFailures ? (
            <div className="rounded-xl border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] px-3 py-2 text-sm text-[var(--fy-text-muted)]">
              Some providers failed or timed out, but successful results are shown below.
              <ul className="mt-2 space-y-1 font-mono text-[11px]">
                {report.outcomes
                  .filter((item) => !item.ok)
                  .map((item) => (
                    <li key={item.providerId}>
                      {item.providerName}: {item.timedOut ? 'timeout' : item.error}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          <p className="font-mono text-[11px] text-[var(--fy-text-muted)]">
            {filteredGroups.length} title{filteredGroups.length === 1 ? '' : 's'}
            {filteredGroups.length !== report.groups.length
              ? ` (filtered from ${report.groups.length})`
              : ''}
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filteredGroups.map((group) => (
              <DiscoverCoverCard key={group.groupId} group={group} onOpen={openGroup} />
            ))}
          </div>

          <p className="text-xs text-[var(--fy-text-muted)]">
            MangaDex results credit MangaDex. Atsumaru uses unofficial atsu.moe site JSON with
            in-app chapter reading. Search state is kept while you open details.
          </p>
        </div>
      )}
    </div>
  )
}
