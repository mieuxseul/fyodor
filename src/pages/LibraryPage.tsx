import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckSquare, FolderOpen, LayoutGrid, List, Trash2, Upload } from 'lucide-react'

import { CoverCard } from '@/components/library/CoverCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { api, isTauri } from '@/lib/api'
import type { LibraryItem, LibraryView, ReadingStatus } from '@/lib/types'

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'reading', label: 'Reading' },
  { id: 'completed', label: 'Completed' },
  { id: 'planned', label: 'Planned' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'dropped', label: 'Dropped' },
] as const

const ORIGIN_FILTERS = [
  { id: 'all', label: 'All origins' },
  { id: 'local', label: 'Local' },
  { id: 'remote', label: 'Remote' },
] as const

const TYPE_FILTERS = [
  { id: 'all', label: 'All types' },
  { id: 'manga', label: 'Manga' },
  { id: 'manhwa', label: 'Manhwa' },
  { id: 'comic', label: 'Comic' },
] as const

const BULK_STATUSES: Array<{ id: ReadingStatus; label: string }> = [
  { id: 'reading', label: 'Reading' },
  { id: 'completed', label: 'Completed' },
  { id: 'planned', label: 'Planned' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'dropped', label: 'Dropped' },
]

type OriginFilter = (typeof ORIGIN_FILTERS)[number]['id']
type TypeFilter = (typeof TYPE_FILTERS)[number]['id']

export function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('recent')
  const [origin, setOrigin] = useState<OriginFilter>('all')
  const [contentType, setContentType] = useState<TypeFilter>('all')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 250)
  const [view, setView] = useState<LibraryView>('grid')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [prefsReady, setPrefsReady] = useState(false)

  const load = useCallback(async () => {
    if (!isTauri()) {
      setLoading(false)
      setError('Launch Fyodor desktop to use the local library.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = await api.listLibrary({
        status,
        query: debouncedQuery,
        sort,
        localOnly: origin === 'local',
      })
      setItems(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [status, debouncedQuery, sort, origin])

  useEffect(() => {
    if (!isTauri()) {
      setPrefsReady(true)
      return
    }
    void (async () => {
      try {
        const [savedView, savedSort, savedStatus, savedOrigin, savedType] = await Promise.all([
          api.getSetting('library_view'),
          api.getSetting('library_sort'),
          api.getSetting('library_status'),
          api.getSetting('library_origin'),
          api.getSetting('library_content_type'),
        ])
        if (savedView === 'grid' || savedView === 'list') setView(savedView)
        if (savedSort) setSort(savedSort)
        if (savedStatus) setStatus(savedStatus)
        if (savedOrigin === 'all' || savedOrigin === 'local' || savedOrigin === 'remote') {
          setOrigin(savedOrigin)
        }
        if (
          savedType === 'all' ||
          savedType === 'manga' ||
          savedType === 'manhwa' ||
          savedType === 'comic'
        ) {
          setContentType(savedType)
        }
      } finally {
        setPrefsReady(true)
      }
    })()
  }, [])

  useEffect(() => {
    if (!prefsReady) return
    void load()
  }, [prefsReady, load])

  useEffect(() => {
    if (!isTauri() || !prefsReady) return
    void api.setSetting('library_sort', sort)
  }, [sort, prefsReady])

  useEffect(() => {
    if (!isTauri() || !prefsReady) return
    void api.setSetting('library_status', status)
  }, [status, prefsReady])

  useEffect(() => {
    if (!isTauri() || !prefsReady) return
    void api.setSetting('library_origin', origin)
  }, [origin, prefsReady])

  useEffect(() => {
    if (!isTauri() || !prefsReady) return
    void api.setSetting('library_content_type', contentType)
  }, [contentType, prefsReady])

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (origin === 'remote' && item.entry.isLocal) return false
      if (contentType !== 'all') {
        const type = (item.title.contentType || 'manga').toLowerCase()
        if (type !== contentType) return false
      }
      return true
    })
  }, [items, origin, contentType])

  async function changeView(next: LibraryView) {
    setView(next)
    if (isTauri()) await api.setSetting('library_view', next)
  }

  function toggleSelect(titleId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(titleId)) next.delete(titleId)
      else next.add(titleId)
      return next
    })
  }

  function toggleSelectMode() {
    setSelectMode((on) => {
      if (on) setSelected(new Set())
      return !on
    })
  }

  function selectAllVisible() {
    setSelected(new Set(visibleItems.map((item) => item.title.id)))
  }

  async function importArchives() {
    if (!isTauri()) return
    setBusy(true)
    setNotice(null)
    try {
      const results = await api.pickAndImportArchives()
      if (results.length === 0) {
        setNotice('Import cancelled.')
      } else {
        const warnings = results.flatMap((item) => item.warnings ?? [])
        setNotice(
          `Imported ${results.length} title${results.length === 1 ? '' : 's'}${
            warnings.length ? ` · ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''
          }.`,
        )
        await load()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function importFolder() {
    if (!isTauri()) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await api.pickAndImportFolder()
      setNotice(`Imported “${result.primaryTitle}” (${result.pageCount} pages).`)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.toLowerCase().includes('cancelled')) {
        setError(message)
      }
    } finally {
      setBusy(false)
    }
  }

  async function bulkSetStatus(nextStatus: ReadingStatus) {
    if (!selected.size || !isTauri()) return
    setBusy(true)
    setError(null)
    try {
      const ids = [...selected]
      for (const id of ids) {
        await api.updateTitle({ id, status: nextStatus })
      }
      setNotice(`Updated status to “${nextStatus.replace('_', ' ')}” for ${ids.length} title${ids.length === 1 ? '' : 's'}.`)
      setSelected(new Set())
      setSelectMode(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function bulkRemove() {
    if (!selected.size || !isTauri()) return
    const count = selected.size
    const confirmed = window.confirm(
      `Remove ${count} title${count === 1 ? '' : 's'} from your library? Original files on disk are not deleted.`,
    )
    if (!confirmed) return
    setBusy(true)
    setError(null)
    try {
      for (const id of selected) {
        await api.removeFromLibrary(id)
      }
      setNotice(`Removed ${count} title${count === 1 ? '' : 's'} from the library.`)
      setSelected(new Set())
      setSelectMode(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Library"
        subtitle="Your personal collection of manga, manhwa, and local comics."
        actions={
          <>
            <Button
              variant={selectMode ? 'primary' : 'secondary'}
              disabled={!isTauri() || visibleItems.length === 0}
              onClick={toggleSelectMode}
            >
              <CheckSquare size={16} /> {selectMode ? 'Done' : 'Select'}
            </Button>
            <Button variant="secondary" disabled={busy || !isTauri()} onClick={() => void importFolder()}>
              <FolderOpen size={16} /> Folder
            </Button>
            <Button variant="primary" disabled={busy || !isTauri()} onClick={() => void importArchives()}>
              <Upload size={16} /> Import CBZ
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter titles or authors…"
          className="min-w-[200px] flex-1 rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--fy-accent)]"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] px-3 py-2 text-sm"
        >
          <option value="recent">Recently opened</option>
          <option value="added">Recently added</option>
          <option value="title">Title A–Z</option>
          <option value="progress">Reading progress</option>
        </select>
        <select
          value={origin}
          onChange={(e) => setOrigin(e.target.value as OriginFilter)}
          className="rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] px-3 py-2 text-sm"
        >
          {ORIGIN_FILTERS.map((filter) => (
            <option key={filter.id} value={filter.id}>
              {filter.label}
            </option>
          ))}
        </select>
        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value as TypeFilter)}
          className="rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] px-3 py-2 text-sm"
        >
          {TYPE_FILTERS.map((filter) => (
            <option key={filter.id} value={filter.id}>
              {filter.label}
            </option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-sm border border-[var(--fy-border-subtle)]">
          <Button
            variant={view === 'grid' ? 'primary' : 'ghost'}
            size="icon"
            aria-label="Grid view"
            onClick={() => void changeView('grid')}
          >
            <LayoutGrid size={16} />
          </Button>
          <Button
            variant={view === 'list' ? 'primary' : 'ghost'}
            size="icon"
            aria-label="List view"
            onClick={() => void changeView('list')}
          >
            <List size={16} />
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setStatus(filter.id)}
            className={
              status === filter.id
                ? 'rounded-lg bg-[var(--fy-primary)] px-3 py-1.5 text-xs text-[var(--fy-panel-solid)]'
                : 'rounded-lg border border-[var(--fy-border-subtle)] px-3 py-1.5 text-xs text-[var(--fy-text-muted)] hover:text-[var(--fy-text)]'
            }
          >
            {filter.label}
          </button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStatus('all')
            setQuery('')
            setSort('recent')
            setOrigin('all')
            setContentType('all')
          }}
        >
          Reset
        </Button>
        {!loading && prefsReady ? (
          <span className="ml-auto self-center text-xs text-[var(--fy-text-muted)]">
            {visibleItems.length} shown
          </span>
        ) : null}
      </div>

      {selectMode ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] px-3 py-2">
          <span className="text-sm text-[var(--fy-text-muted)]">
            {selected.size} selected
          </span>
          <Button size="sm" variant="ghost" disabled={busy} onClick={selectAllVisible}>
            Select all visible
          </Button>
          <select
            className="rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-2 py-1.5 text-xs"
            defaultValue=""
            disabled={busy || selected.size === 0}
            onChange={(e) => {
              const value = e.target.value as ReadingStatus
              if (!value) return
              void bulkSetStatus(value)
              e.currentTarget.value = ''
            }}
          >
            <option value="" disabled>
              Set status…
            </option>
            {BULK_STATUSES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || selected.size === 0}
            onClick={() => void bulkRemove()}
          >
            <Trash2 size={14} /> Remove
          </Button>
        </div>
      ) : null}

      {notice ? (
        <p className="mb-4 rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-sm border border-[var(--fy-danger)] px-3 py-2 text-sm text-[var(--fy-danger)]">
          {error}
        </p>
      ) : null}

      {loading || !prefsReady ? (
        <p className="text-sm text-[var(--fy-text-muted)]">Loading library…</p>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? 'No titles in the library' : 'No titles match these filters'}
          description={
            items.length === 0
              ? 'Import CBZ/ZIP archives (multi-select supported) or an image folder. Original files stay on disk when you remove a title.'
              : 'Try clearing filters or switching origin/type.'
          }
          action={
            items.length === 0 ? (
              <Button variant="primary" disabled={!isTauri() || busy} onClick={() => void importArchives()}>
                Import CBZ
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setStatus('all')
                  setOrigin('all')
                  setContentType('all')
                  setQuery('')
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {visibleItems.map((item) => (
            <CoverCard
              key={item.title.id}
              item={item}
              view="grid"
              selectable={selectMode}
              selected={selected.has(item.title.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item) => (
            <CoverCard
              key={item.title.id}
              item={item}
              view="list"
              selectable={selectMode}
              selected={selected.has(item.title.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
