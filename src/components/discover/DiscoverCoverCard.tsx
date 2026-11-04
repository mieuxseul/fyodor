import { useEffect, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'

import { RemoteCover } from '@/components/RemoteCover'
import { toast } from '@/components/ui/Toaster'
import { useNewChapterBadge } from '@/hooks/useNewChapterBadge'
import { api, isTauri } from '@/lib/api'
import { cn } from '@/lib/cn'
import {
  listCategories,
  setTitleCategory,
  subscribeLibraryCategories,
  type LibraryCategory,
} from '@/lib/library-categories'
import type { LibraryDisplayMode } from '@/lib/library-display'
import type { GroupedSearchResult, SearchEdition } from '@/source-network'

interface DiscoverCoverCardProps {
  group: GroupedSearchResult
  onOpen: (group: GroupedSearchResult) => void
  onLibraryNotice?: (message: string) => void
  onLibraryError?: (message: string) => void
  view?: LibraryDisplayMode
}

type MenuState = {
  x: number
  y: number
} | null

function preferredRemoteEdition(group: GroupedSearchResult): SearchEdition | null {
  return (
    group.editions.find((e) => e.providerId === 'atsu') ??
    group.editions.find((e) => e.providerId === 'mangadex') ??
    group.editions.find((e) => e.providerId === 'kotatsu') ??
    group.editions.find((e) => e.providerId !== 'local-library' && e.providerId !== 'mock-catalog') ??
    null
  )
}

function clampMenuPosition(x: number, y: number, width: number, height: number) {
  const pad = 8
  const maxX = window.innerWidth - width - pad
  const maxY = window.innerHeight - height - pad
  return {
    x: Math.max(pad, Math.min(x, maxX)),
    y: Math.max(pad, Math.min(y, maxY)),
  }
}

export function DiscoverCoverCard({
  group,
  onOpen,
  onLibraryNotice,
  onLibraryError,
  view = 'grid',
}: DiscoverCoverCardProps) {
  const alt = group.alternateTitles[0]
  const remote = preferredRemoteEdition(group)
  const local = group.editions.find((e) => e.providerId === 'local-library') ?? null
  const badge = useNewChapterBadge(remote?.providerId, remote?.providerTitleId)
  const [menu, setMenu] = useState<MenuState>(null)
  const [categories, setCategories] = useState<LibraryCategory[]>(() => listCategories())
  const [busy, setBusy] = useState(false)

  const canAddRemote = Boolean(remote) && !group.isMock && remote?.providerId !== 'mock-catalog'
  const canAssignLocal = Boolean(local)
  const showAddSection = canAddRemote || canAssignLocal
  const compact = view === 'compact'
  const details = view === 'details'

  useEffect(() => subscribeLibraryCategories(() => setCategories(listCategories())), [])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  async function addToCategory(categoryId: string) {
    if (!isTauri() || busy) return
    setBusy(true)
    try {
      let titleId = local?.providerTitleId
      if (!titleId && remote) {
        const ref = await api.addRemoteToLibrary({
          providerId: remote.providerId,
          providerName: remote.providerName,
          providerTitleId: remote.providerTitleId,
          primaryTitle: group.primaryTitle,
          alternateTitles: group.alternateTitles,
          description: group.description ?? null,
          genres: group.genres,
          tags: [],
          contentType: group.contentType,
          publicationStatus: group.publicationStatus ?? null,
          coverUrl: group.coverUrl ?? null,
          websiteUrl: remote.websiteUrl ?? null,
          readingMode: group.contentType === 'manhwa' ? 'vertical' : 'page',
          readingDirection: 'ltr',
        })
        titleId = ref.titleId
      }
      if (!titleId) throw new Error('No addable edition for this title')
      const assigned = setTitleCategory(titleId, categoryId)
      if (assigned?.status) {
        await api.updateTitle({ id: titleId, status: assigned.status })
      }
      setMenu(null)
      const message =
        local && !remote
          ? `Moved to ${assigned?.name ?? 'library'}`
          : `Added to ${assigned?.name ?? 'library'}`
      toast.success(message, {
        description: group.primaryTitle,
      })
      onLibraryNotice?.(message)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error('Couldn’t add to library', { description: message })
      onLibraryError?.(message)
    } finally {
      setBusy(false)
    }
  }

  const pos = menu ? clampMenuPosition(menu.x, menu.y, 220, 280) : null

  const openMenu = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY })
  }

  const menuPortal =
    menu && pos
      ? createPortal(
          <div
            role="menu"
            className="fy-liquid-menu fixed z-[60] w-[13.5rem] overflow-hidden py-1 text-sm shadow-xl"
            style={{ left: pos.x, top: pos.y }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="fy-menu-item"
              onClick={() => {
                setMenu(null)
                onOpen(group)
              }}
            >
              Open
            </button>
            {showAddSection ? (
              <>
                <div className="mx-3 my-1.5 border-t border-[var(--fy-border-subtle)]" />
                <div className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
                  {local && !canAddRemote ? 'Move to category' : 'Add to library'}
                </div>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    className="fy-menu-item"
                    onClick={() => void addToCategory(cat.id)}
                  >
                    {cat.name}
                  </button>
                ))}
              </>
            ) : (
              <>
                <div className="fy-divider my-1" />
                <p className="px-3 py-2 text-xs text-[var(--fy-text-muted)]">
                  Can’t add this title from Discover.
                </p>
              </>
            )}
          </div>,
          document.body,
        )
      : null

  if (details) {
    return (
      <>
        <button
          type="button"
          onClick={() => onOpen(group)}
          onContextMenu={openMenu}
          className="fy-liquid-tile flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:border-[var(--fy-accent)]"
        >
          <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-sm bg-[var(--fy-bg)]">
            <RemoteCover
              path={group.coverUrl}
              placeholder={group.primaryTitle}
              className="h-full w-full object-cover"
            />
            {badge.show ? (
              <span className="absolute left-1 top-1 rounded-full bg-[var(--fy-accent)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[var(--fy-panel-solid)]">
                {badge.delta}
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-base leading-tight">{group.primaryTitle}</div>
            <div className="mt-0.5 truncate text-xs text-[var(--fy-text-muted)]">
              {[alt, group.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ') ||
                group.contentType}
            </div>
          </div>
        </button>
        {menuPortal}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onOpen(group)}
        onContextMenu={openMenu}
        title={compact ? group.primaryTitle : undefined}
        className={cn(
          'group block h-full overflow-hidden text-left transition',
          details ? '' : 'rounded-sm',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fy-accent)]',
        )}
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm bg-[var(--fy-bg)]">
          <RemoteCover
            path={group.coverUrl}
            placeholder={group.primaryTitle}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
          {compact ? (
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/70 px-2.5 text-center opacity-0 backdrop-blur-[2px] transition-opacity duration-300 ease-out group-hover:opacity-100"
              aria-hidden
            >
              <span className="line-clamp-4 font-display text-[13px] font-semibold leading-snug text-white">
                {group.primaryTitle}
              </span>
              {alt ? (
                <span className="mt-1.5 line-clamp-2 text-[10px] text-white/75">{alt}</span>
              ) : null}
            </div>
          ) : null}
          {group.isMock ? (
            <span
              className={cn(
                'absolute left-2 top-2 rounded-md bg-[var(--fy-nav-active)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide',
                compact ? 'transition-opacity group-hover:opacity-0' : '',
              )}
            >
              Test
            </span>
          ) : null}
          {badge.show ? (
            <span
              className={cn(
                'absolute right-2 top-2 rounded-md bg-[var(--fy-accent)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--fy-panel-solid)]',
                compact ? 'transition-opacity group-hover:opacity-0' : '',
              )}
            >
              {badge.delta > 1 ? `+${badge.delta}` : 'New'}
            </span>
          ) : null}
        </div>
        {!compact ? (
          <div className="mt-1.5 line-clamp-2 px-0.5 font-display text-[13px] leading-snug">
            {group.primaryTitle}
          </div>
        ) : null}
      </button>
      {menuPortal}
    </>
  )
}
