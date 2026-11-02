import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { api, isTauri, toAssetUrl } from '@/lib/api'
import type { Bookmark } from '@/lib/types'

function formatCreatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function BookmarksPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isTauri()) {
      setLoading(false)
      setError('Desktop runtime required for bookmarks.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      setItems(await api.listBookmarks())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(id: string) {
    await api.deleteBookmark(id)
    await load()
  }

  function openBookmark(item: Bookmark) {
    if (item.editionId) {
      const params = item.chapterId ? `?chapter=${item.chapterId}` : ''
      navigate(`/reader/${item.editionId}${params}`)
      return
    }
    navigate(`/title/${item.titleId}`)
  }

  return (
    <div>
      <PageHeader
        title="Bookmarks"
        subtitle="Saved titles, chapters, and reading positions."
      />

      {error ? <p className="mb-4 text-sm text-[var(--fy-danger)]">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-[var(--fy-text-muted)]">Loading bookmarks…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No bookmarks yet"
          description="While reading, use the bookmark control to save a chapter or page position."
          action={
            <Button variant="primary" onClick={() => navigate('/library')}>
              Browse library
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const cover = toAssetUrl(item.title.coverPath)
            const position =
              item.pageIndex != null
                ? `Page ${item.pageIndex + 1}`
                : item.chapter?.title ?? 'Title bookmark'
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] px-3 py-2"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => openBookmark(item)}
                >
                  <div className="h-14 w-10 overflow-hidden rounded-md bg-[var(--fy-bg)]">
                    {cover ? (
                      <img src={cover} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.title.primaryTitle}</div>
                    <div className="mt-1 font-mono text-[11px] text-[var(--fy-text-muted)]">
                      {position} · {formatCreatedAt(item.createdAt)}
                    </div>
                  </div>
                </button>
                <Button size="sm" variant="secondary" onClick={() => openBookmark(item)}>
                  Open
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void remove(item.id)}>
                  Remove
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
