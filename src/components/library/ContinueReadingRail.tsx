import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { RemoteCover } from '@/components/RemoteCover'
import { api, isTauri } from '@/lib/api'
import { isIncognitoSession, subscribeIncognito } from '@/lib/incognito'
import { LIBRARY_OPENED_EVENT } from '@/lib/library-display'
import type { LibraryItem } from '@/lib/types'

function resumeHref(item: LibraryItem): string {
  const edition = item.preferredEdition
  if (edition?.id) {
    const chapter = item.progress?.chapterId
    const params = chapter ? `?chapter=${encodeURIComponent(chapter)}` : ''
    return `/reader/${edition.id}${params}`
  }
  return `/title/${item.title.id}`
}

function pickContinue(items: LibraryItem[]): LibraryItem | null {
  // Already sorted by last_opened_at DESC from the API.
  for (const item of items) {
    if (!item.entry.lastOpenedAt) continue
    if (item.progress?.completed || item.entry.status === 'completed') continue
    return item
  }
  return items.find((item) => Boolean(item.entry.lastOpenedAt)) ?? null
}

export function ContinueReadingRail() {
  const navigate = useNavigate()
  const [item, setItem] = useState<LibraryItem | null>(null)

  const load = useCallback(async () => {
    if (!isTauri() || isIncognitoSession()) {
      setItem(null)
      return
    }
    try {
      const list = await api.listLibrary({ status: 'all', sort: 'recent' })
      setItem(pickContinue(list))
    } catch {
      setItem(null)
    }
  }, [])

  useEffect(() => {
    void load()
    const onFocus = () => {
      void load()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener(LIBRARY_OPENED_EVENT, onFocus)
    const unsub = subscribeIncognito(() => {
      void load()
    })
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(LIBRARY_OPENED_EVENT, onFocus)
      unsub()
    }
  }, [load])

  if (!item) return null

  const chapterLabel =
    item.currentChapterTitle ??
    (item.progress?.chapterId ? 'Resume' : 'Open')

  return createPortal(
    <button
      type="button"
      onClick={() => navigate(resumeHref(item))}
      aria-label={`Continue reading ${item.title.primaryTitle}`}
      title={`${item.title.primaryTitle} — ${chapterLabel}`}
      className="fy-liquid-menu group fixed bottom-5 right-5 z-50 w-[7.25rem] overflow-hidden rounded-2xl p-0 text-left shadow-xl transition hover:scale-[1.03] active:scale-[0.98] sm:w-[8.5rem]"
    >
      <span className="relative block aspect-[2/3] w-full bg-[var(--fy-bg)]">
        {item.title.coverPath ? (
          <RemoteCover
            path={item.title.coverPath}
            placeholder={item.title.primaryTitle}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[var(--fy-text-muted)]">
            <BookOpen size={28} />
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-2 pb-2 pt-8">
          <span className="block font-mono text-[9px] uppercase tracking-wide text-white/75">
            Continue
          </span>
          <span className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-white sm:text-xs">
            {item.title.primaryTitle}
          </span>
        </span>
      </span>
    </button>,
    document.body,
  )
}
