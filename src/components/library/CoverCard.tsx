import { Link } from 'react-router-dom'

import { RemoteCover } from '@/components/RemoteCover'
import { cn } from '@/lib/cn'
import type { LibraryItem } from '@/lib/types'

interface CoverCardProps {
  item: LibraryItem
  view?: 'grid' | 'list'
}

function progressPercent(item: LibraryItem): number {
  if (!item.progress || item.chapterCount <= 0) return 0
  if (item.progress.completed) return 100
  const chapterIndex = Math.max(item.progress.pageIndex, 0)
  return Math.min(100, Math.round((chapterIndex / Math.max(item.chapterCount, 1)) * 100))
}

function titleHref(item: LibraryItem): string {
  const edition = item.preferredEdition
  if (
    edition?.providerId &&
    edition.providerTitleId &&
    edition.sourceKind === 'remote'
  ) {
    return `/remote/${edition.providerId}/${edition.providerTitleId}`
  }
  return `/title/${item.title.id}`
}

export function CoverCard({ item, view = 'grid' }: CoverCardProps) {
  const percent = progressPercent(item)
  const href = titleHref(item)

  if (view === 'list') {
    return (
      <Link
        to={href}
        className="flex items-center gap-4 rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] px-3 py-2 transition-colors hover:border-[var(--fy-accent)]"
      >
        <div className="h-16 w-12 overflow-hidden rounded-sm bg-[var(--fy-bg)]">
          <RemoteCover
            path={item.title.coverPath}
            placeholder={item.title.primaryTitle}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-xl">{item.title.primaryTitle}</div>
          <div className="mt-1 flex flex-wrap gap-3 font-mono text-[11px] text-[var(--fy-text-muted)]">
            <span>{item.entry.status.replace('_', ' ')}</span>
            <span>
              {item.currentChapterTitle ?? 'Unread'} · {item.chapterCount} ch
            </span>
            {item.entry.isLocal ? <span>Local</span> : null}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={href}
      className="group block overflow-hidden rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] transition-colors hover:border-[var(--fy-accent)]"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-[var(--fy-bg)]">
        <RemoteCover
          path={item.title.coverPath}
          placeholder={item.title.primaryTitle}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--fy-border-subtle)]">
          <div
            className="h-full bg-[var(--fy-progress)] transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <div className="space-y-1 px-3 py-3">
        <div className="line-clamp-2 font-display text-lg leading-tight">
          {item.title.primaryTitle}
        </div>
        <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
          <span>{item.entry.status.replace('_', ' ')}</span>
          <span className={cn(item.entry.isLocal && 'text-[var(--fy-accent)]')}>
            {item.entry.isLocal ? 'Local' : 'Remote'}
          </span>
        </div>
      </div>
    </Link>
  )
}
