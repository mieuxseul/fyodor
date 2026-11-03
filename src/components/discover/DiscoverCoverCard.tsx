import { RemoteCover } from '@/components/RemoteCover'
import { cn } from '@/lib/cn'
import type { GroupedSearchResult } from '@/source-network'

interface DiscoverCoverCardProps {
  group: GroupedSearchResult
  onOpen: (group: GroupedSearchResult) => void
}

export function DiscoverCoverCard({ group, onOpen }: DiscoverCoverCardProps) {
  const alt = group.alternateTitles[0]
  const providers = group.editions.map((e) => e.providerName).join(' · ')

  return (
    <button
      type="button"
      onClick={() => onOpen(group)}
      className={cn(
        'group flex h-full flex-col overflow-hidden fy-liquid-tile text-left transition',
        'hover:-translate-y-0.5 hover:border-[var(--fy-border)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fy-accent)]',
      )}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[var(--fy-bg)]">
        <RemoteCover
          path={group.coverUrl}
          placeholder={group.primaryTitle}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {group.isMock ? (
          <span className="absolute left-2 top-2 rounded-md bg-[var(--fy-nav-active)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide">
            Test
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-2.5 py-2.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight">
          {group.primaryTitle}
        </h3>
        {alt ? (
          <p className="line-clamp-1 text-xs text-[var(--fy-text-muted)]">{alt}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1 font-mono text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
          <span>{group.contentType}</span>
          {group.publicationStatus ? (
            <span>{group.publicationStatus.replace(/_/g, ' ')}</span>
          ) : null}
          {group.latestChapterLabel ? <span>{group.latestChapterLabel}</span> : null}
        </div>
        <p className="truncate font-mono text-[10px] text-[var(--fy-text-muted)]">{providers}</p>
      </div>
    </button>
  )
}
