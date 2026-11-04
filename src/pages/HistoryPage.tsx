import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { RemoteCover } from '@/components/RemoteCover'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { api, isTauri } from '@/lib/api'
import { filterPublicHistory, subscribeIncognito } from '@/lib/incognito'
import type { HistoryItem } from '@/lib/types'

function formatOpenedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function HistoryPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isTauri()) {
      setLoading(false)
      setError('Desktop runtime required for reading history.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      setItems(filterPublicHistory(await api.listHistory()))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return subscribeIncognito(() => {
      void load()
    })
  }, [load])

  async function clearAll() {
    if (!window.confirm('Clear all reading history? This cannot be undone.')) return
    await api.clearHistory()
    await load()
  }

  function resume(item: HistoryItem) {
    const chapter = item.progress?.chapterId ?? item.chapter?.id
    const params = chapter ? `?chapter=${chapter}` : ''
    navigate(`/reader/${item.edition.id}${params}`)
  }

  return (
    <div>
      <PageHeader
        title="History"
        subtitle="Recently opened titles — resume where you left off."
        actions={
          <Button
            variant="secondary"
            disabled={!isTauri() || items.length === 0}
            onClick={() => void clearAll()}
          >
            Clear history
          </Button>
        }
      />

      {error ? <p className="mb-4 text-sm text-[var(--fy-danger)]">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-[var(--fy-text-muted)]">Loading history…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No reading history"
          description="Open a title from your library to start building history."
          action={
            <Button variant="primary" onClick={() => navigate('/library')}>
              Open library
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            return (
              <li
                key={item.id}
                className="flex items-center gap-4 fy-liquid-tile px-3 py-2"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => navigate(`/title/${item.title.id}`)}
                >
                  <div className="h-16 w-12 overflow-hidden rounded-md bg-[var(--fy-bg)]">
                    <RemoteCover
                      path={item.title.coverPath}
                      placeholder={item.title.primaryTitle}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.title.primaryTitle}</div>
                    <div className="mt-1 font-mono text-[11px] text-[var(--fy-text-muted)]">
                      {item.chapter?.title ?? 'No chapter'} · {formatOpenedAt(item.openedAt)}
                    </div>
                  </div>
                </button>
                <Button size="sm" variant="primary" onClick={() => resume(item)}>
                  Resume
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
