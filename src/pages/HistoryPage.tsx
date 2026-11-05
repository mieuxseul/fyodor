import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { RemoteCover } from '@/components/RemoteCover'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { api, isTauri } from '@/lib/api'
import { isIncognitoSession, subscribeIncognito } from '@/lib/incognito'
import {
  clearReadingHistory,
  historyResumePath,
  historyTitlePath,
  listReadingHistory,
  mergeReadingHistory,
  subscribeReadingHistory,
  type ReadingHistoryEntry,
} from '@/lib/reading-history'

function formatOpenedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

/** Fold SQLite history (local editions) into the client store once per visit. */
async function syncDbHistory(): Promise<void> {
  if (!isTauri()) return
  try {
    const rows = await api.listHistory(100)
    mergeReadingHistory(
      rows.map((item) => {
        const remote =
          item.edition.sourceKind === 'remote' &&
          item.edition.providerId &&
          item.edition.providerTitleId
            ? {
                providerId: item.edition.providerId,
                providerTitleId: item.edition.providerTitleId,
              }
            : null
        return {
          id: item.id,
          openedAt: item.openedAt,
          titleId: item.title.id,
          editionId: item.edition.id,
          primaryTitle: item.title.primaryTitle,
          coverPath: item.title.coverPath,
          chapterId: item.chapter?.id ?? item.progress?.chapterId ?? null,
          chapterTitle: item.chapter?.title ?? null,
          providerId: remote?.providerId,
          providerTitleId: remote?.providerTitleId,
        }
      }),
    )
  } catch {
    /* keep local store if DB sync fails */
  }
}

export function HistoryPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ReadingHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (isIncognitoSession()) {
      setItems([])
      setLoading(false)
      return
    }
    setItems(listReadingHistory(100))
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      await syncDbHistory()
      if (!cancelled) refresh()
    })()
    const unsubStore = subscribeReadingHistory(refresh)
    const unsubIncognito = subscribeIncognito(refresh)
    return () => {
      cancelled = true
      unsubStore()
      unsubIncognito()
    }
  }, [refresh])

  async function clearAll() {
    if (!window.confirm('Clear all reading history? This cannot be undone.')) return
    clearReadingHistory()
    if (isTauri()) {
      try {
        await api.clearHistory()
      } catch {
        /* local clear still applies */
      }
    }
    refresh()
  }

  return (
    <div>
      <PageHeader
        title="History"
        subtitle="Recently opened titles — resume where you left off."
        actions={
          <Button
            variant="secondary"
            disabled={items.length === 0}
            onClick={() => void clearAll()}
          >
            Clear history
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-[var(--fy-text-muted)]">Loading history…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No reading history"
          description={
            isIncognitoSession()
              ? 'Incognito is on — opens aren’t saved to History.'
              : 'Open a title from Library or Discover to start building history.'
          }
          action={
            <Button variant="primary" onClick={() => navigate('/library')}>
              Open library
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 fy-liquid-tile px-3 py-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => navigate(historyTitlePath(item))}
              >
                <div className="h-16 w-12 overflow-hidden rounded-md bg-[var(--fy-bg)]">
                  <RemoteCover
                    path={item.coverPath}
                    placeholder={item.primaryTitle}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{item.primaryTitle}</div>
                  <div className="mt-1 font-mono text-[11px] text-[var(--fy-text-muted)]">
                    {item.chapterTitle ?? 'No chapter'} · {formatOpenedAt(item.openedAt)}
                  </div>
                </div>
              </button>
              <Button size="sm" variant="primary" onClick={() => navigate(historyResumePath(item))}>
                Resume
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
