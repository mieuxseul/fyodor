import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toaster'
import { api, isTauri } from '@/lib/api'
import type { DownloadRecord } from '@/lib/types'

function statusLabel(status: string): string {
  switch (status) {
    case 'running':
      return 'Downloading'
    case 'completed':
      return 'Ready'
    case 'failed':
      return 'Failed'
    case 'queued':
      return 'Queued'
    default:
      return status
  }
}

export function DownloadsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<DownloadRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isTauri()) {
      setLoading(false)
      setError('Desktop runtime required for offline downloads.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      setItems(await api.listDownloads(100))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      void load()
    }, 2500)
    return () => window.clearInterval(timer)
  }, [load])

  function openJob(item: DownloadRecord) {
    if (item.status !== 'completed' || !item.editionId) return
    const chapter = item.chapterId ? `?chapter=${encodeURIComponent(item.chapterId)}` : ''
    navigate(`/reader/${item.editionId}${chapter}`)
  }

  async function removeJob(item: DownloadRecord) {
    if (!isTauri() || deletingId) return
    const label = item.chapterTitle ?? 'this chapter'
    if (
      !window.confirm(
        `Delete “${label}” from this device? Offline pages will be removed. You can download it again later.`,
      )
    ) {
      return
    }
    setDeletingId(item.id)
    try {
      await api.deleteDownload(item.id)
      setItems((prev) => prev.filter((row) => row.id !== item.id))
      toast.success('Download deleted', { description: label })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error('Couldn’t delete download', { description: message })
      setError(message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Downloads"
        subtitle="Offline chapters saved to this device (Atsumaru & MangaDex)."
        actions={
          <Button variant="secondary" size="sm" disabled={!isTauri()} onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      {error ? <p className="mb-4 text-sm text-[var(--fy-danger)]">{error}</p> : null}

      {loading && items.length === 0 ? (
        <p className="text-sm text-[var(--fy-text-muted)]">Loading downloads…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No downloads yet"
          description="Open a remote title and tap Download on a chapter. Kotatsu offline is not available in this build."
          action={
            <Button variant="primary" onClick={() => navigate('/discover')}>
              Discover titles
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const pct = Math.round(Math.min(1, Math.max(0, item.progress)) * 100)
            const busy = deletingId === item.id
            return (
              <li
                key={item.id}
                className="fy-liquid-tile flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {item.titleLabel ?? 'Untitled'}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--fy-text-muted)]">
                    {item.chapterTitle ?? 'Chapter'} · {statusLabel(item.status)}
                    {item.status === 'running' ? ` · ${pct}%` : ''}
                    {item.providerId ? ` · ${item.providerId}` : ''}
                  </div>
                  {item.error ? (
                    <div className="mt-1 text-xs text-[var(--fy-danger)]">{item.error}</div>
                  ) : null}
                  {item.status === 'running' ? (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--fy-border-subtle)]">
                      <div
                        className="h-full bg-[var(--fy-progress)] transition-[width]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  {item.status === 'completed' && item.editionId ? (
                    <Button size="sm" variant="primary" onClick={() => openJob(item)}>
                      Read offline
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || item.status === 'running'}
                    title={
                      item.status === 'running'
                        ? 'Wait for the download to finish'
                        : 'Delete offline chapter'
                    }
                    onClick={() => void removeJob(item)}
                  >
                    {busy ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
