import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, LayoutGrid, List, Upload } from 'lucide-react'

import { CoverCard } from '@/components/library/CoverCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { api, isTauri } from '@/lib/api'
import type { LibraryItem, LibraryView } from '@/lib/types'

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'reading', label: 'Reading' },
  { id: 'completed', label: 'Completed' },
  { id: 'planned', label: 'Planned' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'dropped', label: 'Dropped' },
]

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
      setError('Launch with `npm run tauri:dev` to use the local library.')
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
    void load()
  }, [load])

  async function changeView(next: LibraryView) {
    setView(next)
    if (isTauri()) await api.setSetting('library_view', next)
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
        setNotice(`Imported ${results.length} title${results.length === 1 ? '' : 's'}.`)
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
          <option value="title">Title</option>
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

      {loading ? (
        <p className="text-sm text-[var(--fy-text-muted)]">Loading library…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No titles in the library"
          description="Import a CBZ/ZIP archive or an image folder to begin your collection. Original files are never deleted when you remove a title."
          action={
            <Button variant="primary" disabled={!isTauri() || busy} onClick={() => void importArchives()}>
              Import CBZ
            </Button>
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
