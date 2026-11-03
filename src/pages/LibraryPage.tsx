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
  const [scope, setScope] = useState<'all' | 'local' | 'remote'>('all')
  const [view, setView] = useState<LibraryView>('grid')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!isTauri()) {
      setLoading(false)
      setError('Launch Fyodor desktop to use the local library.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [list, savedView] = await Promise.all([
        api.listLibrary({
          status,
          query: '',
          sort,
          localOnly: scope === 'local',
        }),
        api.getSetting('library_view'),
      ])
      const filtered =
        scope === 'remote' ? list.filter((item) => !item.entry.isLocal) : list
      setItems(filtered)
      if (savedView === 'grid' || savedView === 'list') setView(savedView)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [status, sort, scope])

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

  function toggleSelected(titleId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(titleId)) next.delete(titleId)
      else next.add(titleId)
      return next
    })
  }

  async function removeSelected() {
    if (!isTauri() || selected.size === 0) return
    const count = selected.size
    if (!window.confirm(`Remove ${count} title${count === 1 ? '' : 's'} from the library? Original files stay on disk.`)) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      for (const id of selected) {
        await api.removeFromLibrary(id)
      }
      setSelected(new Set())
      setSelectMode(false)
      setNotice(`Removed ${count} title${count === 1 ? '' : 's'}.`)
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
        subtitle="Manga, manhwa, and local comics."
        actions={
          <>
            <Button variant="secondary" size="sm" disabled={busy || !isTauri()} onClick={() => void importFolder()}>
              <FolderOpen size={14} /> Folder
            </Button>
            <Button variant="primary" size="sm" disabled={busy || !isTauri()} onClick={() => void importArchives()}>
              <Upload size={14} /> Import CBZ
            </Button>
          </>
        }
      />

      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="fy-liquid-tile px-2.5 py-1.5 text-xs"
        >
          <option value="recent">Recently opened</option>
          <option value="added">Recently added</option>
          <option value="title">Title A–Z</option>
          <option value="progress">Reading progress</option>
        </select>
        <div className="flex overflow-hidden rounded-md border border-[var(--fy-border-subtle)]">
          <Button
            variant={view === 'grid' ? 'primary' : 'ghost'}
            size="icon"
            aria-label="Grid view"
            onClick={() => void changeView('grid')}
          >
            <LayoutGrid size={14} />
          </Button>
          <Button
            variant={view === 'list' ? 'primary' : 'ghost'}
            size="icon"
            aria-label="List view"
            onClick={() => void changeView('list')}
          >
            <List size={14} />
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setStatus(filter.id)}
            className={
              status === filter.id
                ? 'rounded-md bg-[var(--fy-primary)] px-2.5 py-1 text-[11px] text-[var(--fy-panel-solid)]'
                : 'rounded-md border border-[var(--fy-border-subtle)] px-2.5 py-1 text-[11px] text-[var(--fy-text-muted)] hover:text-[var(--fy-text)]'
            }
          >
            {filter.label}
          </button>
        ))}
        {(['all', 'local', 'remote'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setScope(id)}
            className={
              scope === id
                ? 'rounded-md bg-[var(--fy-primary)] px-2.5 py-1 text-[11px] text-[var(--fy-panel-solid)]'
                : 'rounded-md border border-[var(--fy-border-subtle)] px-2.5 py-1 text-[11px] text-[var(--fy-text-muted)] hover:text-[var(--fy-text)]'
            }
          >
            {id === 'all' ? 'All sources' : id === 'local' ? 'Local only' : 'Remote only'}
          </button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStatus('all')
            setSort('recent')
            setScope('all')
          }}
        >
          Reset
        </Button>
        <Button
          variant={selectMode ? 'secondary' : 'ghost'}
          size="sm"
          disabled={!isTauri() || items.length === 0}
          onClick={() => {
            setSelectMode((v) => !v)
            setSelected(new Set())
          }}
        >
          {selectMode ? 'Cancel select' : 'Select'}
        </Button>
        {selectMode ? (
          <Button
            variant="primary"
            size="sm"
            disabled={busy || selected.size === 0}
            onClick={() => void removeSelected()}
          >
            Remove ({selected.size})
          </Button>
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
        <p className="mb-2.5 fy-liquid-tile px-2.5 py-1.5 text-xs">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mb-2.5 rounded-sm border border-[var(--fy-danger)] px-2.5 py-1.5 text-xs text-[var(--fy-danger)]">
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
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
          {items.map((item) => (
            <div key={item.title.id} className="relative">
              {selectMode ? (
                <label className="absolute left-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded bg-[var(--fy-panel-solid)]/90">
                  <input
                    type="checkbox"
                    checked={selected.has(item.title.id)}
                    onChange={() => toggleSelected(item.title.id)}
                  />
                </label>
              ) : null}
              <CoverCard item={item} view="grid" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.title.id} className="flex items-center gap-2">
              {selectMode ? (
                <input
                  type="checkbox"
                  checked={selected.has(item.title.id)}
                  onChange={() => toggleSelected(item.title.id)}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <CoverCard item={item} view="list" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
