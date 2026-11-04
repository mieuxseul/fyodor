import { Pin } from 'lucide-react'
import { Link } from 'react-router-dom'

import { RemoteCover } from '@/components/RemoteCover'
import { useNewChapterBadge } from '@/hooks/useNewChapterBadge'
import { getAppPrefs } from '@/lib/app-prefs'
import { isTitlePinned } from '@/lib/library-pins'
import type { LibraryItem } from '@/lib/types'

export type CoverCardView = 'grid' | 'details' | 'compact'

interface CoverCardProps {
  item: LibraryItem
  view?: CoverCardView
  pinned?: boolean
}

function progressPercent(item: LibraryItem): number {
  if (typeof item.progressPercent === 'number') {
    return Math.min(100, Math.max(0, Math.round(item.progressPercent)))
  }
  if (!item.progress || item.chapterCount <= 0) return 0
  if (item.progress.completed || item.entry.status === 'completed') return 100
  return 0
}

function titleHref(item: LibraryItem): string {
  const edition = item.preferredEdition
  if (
    edition?.providerId &&
    edition.providerTitleId &&
    edition.sourceKind === 'remote'
  ) {
    return `/remote/${edition.providerId}/${encodeURIComponent(edition.providerTitleId)}`
  }
  return `/title/${item.title.id}`
}

function ProgressRing({ percent }: { percent: number }) {
  const r = 10
  const c = 2 * Math.PI * r
  const offset = c - (percent / 100) * c
  return (
    <span
      className="relative flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-[9px] font-medium text-white backdrop-blur-[2px]"
      title={`${percent}% read`}
    >
      <svg className="absolute inset-0 h-7 w-7 -rotate-90" viewBox="0 0 28 28" aria-hidden>
        <circle cx="14" cy="14" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" />
        <circle
          cx="14"
          cy="14"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth="2.5"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="relative z-[1]">{percent}</span>
    </span>
  )
}

export function CoverCard({ item, view = 'grid', pinned }: CoverCardProps) {
  const prefs = getAppPrefs()
  const percent = progressPercent(item)
  const href = titleHref(item)
  const edition = item.preferredEdition
  const remote =
    edition?.sourceKind === 'remote' && edition.providerId && edition.providerTitleId
      ? { providerId: edition.providerId, titleId: edition.providerTitleId }
      : null
  const badge = useNewChapterBadge(remote?.providerId, remote?.titleId)
  const isPinned = pinned ?? isTitlePinned(item.title.id)
  const showBadge = prefs.showListBadges && badge.show && badge.delta > 0
  const showProgress = prefs.showProgressIndicators

  if (view === 'details') {
    return (
      <Link
        to={href}
        className="fy-liquid-tile flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors hover:border-[var(--fy-accent)]"
      >
        <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-sm bg-[var(--fy-bg)]">
          <RemoteCover
            path={item.title.coverPath}
            placeholder={item.title.primaryTitle}
            className="h-full w-full object-cover"
          />
          {showBadge ? (
            <span className="absolute left-1 top-1 rounded-full bg-[var(--fy-accent)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[var(--fy-panel-solid)]">
              {badge.delta}
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate font-display text-base leading-tight">
              {item.title.primaryTitle}
            </div>
            {isPinned ? <Pin size={12} className="shrink-0 text-[var(--fy-accent)]" /> : null}
          </div>
          <div className="mt-0.5 truncate text-xs text-[var(--fy-text-muted)]">
            {[item.title.author, item.title.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ') ||
              item.currentChapterTitle ||
              `${item.chapterCount} ch`}
          </div>
        </div>
        {showProgress ? <ProgressRing percent={percent} /> : null}
      </Link>
    )
  }

  const compact = view === 'compact'

  return (
    <Link
      to={href}
      className="group block overflow-hidden rounded-sm transition-colors"
      title={compact ? item.title.primaryTitle : undefined}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-sm bg-[var(--fy-bg)]">
        <RemoteCover
          path={item.title.coverPath}
          placeholder={item.title.primaryTitle}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        {compact ? (
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/70 px-2.5 text-center opacity-0 backdrop-blur-[2px] transition-opacity duration-300 ease-out group-hover:opacity-100"
            aria-hidden
          >
            <span className="line-clamp-4 font-display text-[13px] font-semibold leading-snug text-white">
              {item.title.primaryTitle}
            </span>
            {item.title.author ? (
              <span className="mt-1.5 line-clamp-2 text-[10px] text-white/75">
                {item.title.author}
              </span>
            ) : null}
          </div>
        ) : null}
        {showBadge ? (
          <span
            className={`absolute left-1.5 top-1.5 rounded-full bg-[var(--fy-accent)] px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-[var(--fy-panel-solid)] shadow-sm ${compact ? 'transition-opacity group-hover:opacity-0' : ''}`}
          >
            {badge.delta}
          </span>
        ) : null}
        {isPinned ? (
          <span
            className={`absolute left-1.5 top-8 rounded bg-black/50 p-0.5 text-white ${compact ? 'transition-opacity group-hover:opacity-0' : ''}`}
          >
            <Pin size={11} />
          </span>
        ) : null}
        {showProgress ? (
          <span
            className={`absolute right-1.5 top-1.5 ${compact ? 'transition-opacity group-hover:opacity-0' : ''}`}
          >
            <ProgressRing percent={percent} />
          </span>
        ) : null}
      </div>
      {!compact ? (
        <div className="mt-1.5 line-clamp-2 px-0.5 font-display text-[13px] leading-snug">
          {item.title.primaryTitle}
        </div>
      ) : null}
    </Link>
  )
}
