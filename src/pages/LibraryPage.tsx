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
  const [query, setQuery] = useState('')
  const [view, setView] = useState<LibraryView>('grid')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

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
        api.listLibrary({ status, query, sort }),
        api.getSetting('library_view'),
      ])
      setItems(list)
      if (savedView === 'grid' || savedView === 'list') setView(savedView)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [status, query, sort])

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

  return (
    <div>
      <PageHeader
        title="Library"
        subtitle="Your personal collection of manga, manhwa, and local comics."
        actions={
          <>
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
          placeholder="Filter titles…"
          className="min-w-[200px] flex-1 rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--fy-accent)]"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] px-3 py-2 text-sm"
        >
          <option value="recent">Recently opened</option>
          <option value="added">Recently added</option>
          <option value="title">Title</option>
          <option value="progress">Reading progress</option>
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

      <div className="mb-6 flex flex-wrap gap-2">
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
          }}
        >
          Reset
        </Button>
      </div>

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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <CoverCard key={item.title.id} item={item} view="grid" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <CoverCard key={item.title.id} item={item} view="list" />
          ))}
        </div>
      )}
    </div>
  )
}
