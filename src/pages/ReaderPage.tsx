import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Maximize2,
  Minimize2,
  Settings2,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { api, isTauri, resolveRemoteImageUrl, toAssetUrl, toFyodorCdnUrl } from '@/lib/api'
import { cn } from '@/lib/cn'
import { markLocalChapterRead } from '@/lib/local-read-chapters'
import { loadRemoteProgress, saveRemoteProgress } from '@/lib/remote-progress'
import { decodeKotatsuTitleId } from '@/source-network/providers/kotatsu'
import type {
  Chapter,
  Edition,
  FitMode,
  ReaderSession,
  ReadingDirection,
  ReadingMode,
  Title,
} from '@/lib/types'

type RemoteProvider = 'atsu' | 'mangadex' | 'kotatsu'

function parseRemoteEdition(
  editionId: string,
): { provider: RemoteProvider; mangaId: string } | null {
  for (const provider of ['atsu', 'mangadex', 'kotatsu'] as const) {
    const prefix = `${provider}:`
    if (editionId.startsWith(prefix)) {
      const mangaId = editionId.slice(prefix.length).trim()
      return mangaId ? { provider, mangaId } : null
    }
  }
  return null
}

function parseKotatsuTitleId(titleId: string): { source: string; url: string } | null {
  const idx = titleId.indexOf('::')
  if (idx <= 0) return null
  const source = titleId.slice(0, idx).trim()
  const url = titleId.slice(idx + 2).trim()
  return source && url ? { source, url } : null
}

function parseKotatsuChapterId(chapterId: string): { id: string; url: string } | null {
  const idx = chapterId.indexOf('|||')
  if (idx <= 0) return null
  const id = chapterId.slice(0, idx).trim()
  const url = chapterId.slice(idx + 3).trim()
  return id && url ? { id, url } : null
}

function buildRemoteSession(
  provider: RemoteProvider,
  mangaId: string,
  titleName: string,
  label: string,
  contentType: string,
  chapters: {
    id: string
    title: string
    number?: number | null
    pageCount: number
    sortIndex: number
  }[],
): ReaderSession {
  const now = new Date().toISOString()
  const title: Title = {
    id: `${provider}:${mangaId}`,
    primaryTitle: titleName,
    alternateTitles: [],
    genres: [],
    tags: [],
    contentType,
    createdAt: now,
    updatedAt: now,
  }
  const edition: Edition = {
    id: `${provider}:${mangaId}`,
    titleId: title.id,
    label,
    readingDirection: 'ltr',
    readingMode: contentType === 'manhwa' ? 'vertical' : 'page',
    sourceKind: 'remote',
    providerId: provider,
    providerTitleId: mangaId,
    createdAt: now,
    updatedAt: now,
  }
  const mapped: Chapter[] = chapters.map((chapter, index) => ({
    id: chapter.id,
    editionId: edition.id,
    number: chapter.number ?? null,
    title: chapter.title,
    sortIndex: chapter.sortIndex ?? index,
    pageCount: chapter.pageCount,
    createdAt: now,
  }))
  return { title, edition, chapters: mapped, progress: null }
}

export function ReaderPage() {
  const { editionId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const remote = parseRemoteEdition(editionId)
  const isRemote = Boolean(remote)

  const [session, setSession] = useState<ReaderSession | null>(null)
  const [pages, setPages] = useState<string[]>([])
  const [chapterId, setChapterId] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [mode, setMode] = useState<ReadingMode>('page')
  const [direction, setDirection] = useState<ReadingDirection>('ltr')
  const [fit, setFit] = useState<FitMode>('width')
  const [zoom, setZoom] = useState(1)
  const [styleOpen, setStyleOpen] = useState(false)
  const [fitOpen, setFitOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagesError, setPagesError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pagesLoading, setPagesLoading] = useState(false)
  const [pagesError, setPagesError] = useState<string | null>(null)
  const [pagesRateLimited, setPagesRateLimited] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<number | null>(null)
  const pageCacheRef = useRef(new Map<string, string[]>())
  const prefetchingRef = useRef(new Set<string>())
  const loadChapterRef = useRef<(id: string, restorePage?: number) => Promise<void>>(
    async () => undefined,
  )
  const chapterQueryOnOpenRef = useRef<string | null>(searchParams.get('chapter'))
  const chapterIdRef = useRef<string | null>(null)

  const chapterIndex = useMemo(() => {
    if (!session || !chapterId) return 0
    return Math.max(0, session.chapters.findIndex((c) => c.id === chapterId))
  }, [session, chapterId])

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const persistProgress = useCallback(
    async (nextPage: number, scrollRatio = 0, completed = false) => {
      if (!editionId || !chapterId || !isTauri()) return
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        if (remote) {
          saveRemoteProgress(remote.provider, remote.mangaId, {
            chapterId,
            pageIndex: nextPage,
            markReadChapterId: completed ? chapterId : undefined,
          })
          return
        }
        markLocalChapterRead(editionId, chapterId)
        void api.saveReadingProgress({
          editionId,
          chapterId,
          pageIndex: nextPage,
          scrollRatio,
          completed,
        })
      }, 280)
    },
    [editionId, chapterId, remote],
  )

  const fetchChapterPages = useCallback(
    async (id: string): Promise<string[]> => {
      const cached = pageCacheRef.current.get(id)
      if (cached) return cached

      let pages: string[]
      if (remote?.provider === 'atsu') {
        pages = (await api.atsuChapterPages(remote.mangaId, id)).pages
      } else if (remote?.provider === 'mangadex') {
        pages = (await api.mangadexChapterPages(remote.mangaId, id)).pages
      } else if (remote?.provider === 'kotatsu') {
        const decoded = decodeKotatsuTitleId(remote.mangaId)
        if (!decoded) throw new Error('Invalid Kotatsu title id')
        pages = (await api.kotatsuChapterPages(decoded.source, id)).pages
      } else {
        pages = (await api.getChapterPages(id)).pages
      }
      pageCacheRef.current.set(id, pages)
      return pages
    },
    [remote],
  )

  const prefetchChapter = useCallback(
    (id: string | undefined) => {
      if (!id || pageCacheRef.current.has(id) || prefetchingRef.current.has(id)) return
      prefetchingRef.current.add(id)
      void fetchChapterPages(id)
        .catch(() => {
          /* prefetch is best-effort */
        })
        .finally(() => {
          prefetchingRef.current.delete(id)
        })
    },
    [fetchChapterPages],
  )

  const fetchChapterPages = useCallback(
    async (id: string): Promise<string[]> => {
      if (remote?.provider === 'atsu') {
        const data = await api.atsuChapterPages(remote.mangaId, id)
        return data.pages
      }
      if (remote?.provider === 'mangadex') {
        const data = await api.mangadexChapterPages(remote.mangaId, id)
        return data.pages
      }
      if (remote?.provider === 'kotatsu') {
        const parsedTitle = parseKotatsuTitleId(remote.mangaId)
        const parsedChapter = parseKotatsuChapterId(id)
        if (!parsedTitle || !parsedChapter) {
          throw new Error('Invalid Kotatsu chapter reference.')
        }
        const data = await api.kotatsuChapterPages({
          source: parsedTitle.source,
          mangaUrl: parsedTitle.url,
          chapterUrl: parsedChapter.url,
          chapterId: parsedChapter.id,
        })
        return data.pages ?? []
      }
      const data = await api.getChapterPages(id)
      return data.pages
    },
    [remote],
  )

  const warmResolvedPages = useCallback(async (rawPages: string[], fromIndex = 0) => {
    const slice = rawPages.slice(fromIndex, fromIndex + 4)
    const resolved = await Promise.all(
      slice.map(async (path) => (await resolveRemoteImageUrl(path)) ?? toAssetUrl(path) ?? path),
    )
    prefetchImageUrls(resolved.filter(Boolean) as string[], 4)
  }, [])

  const prefetchAdjacentChapter = useCallback(
    (currentChapterId: string) => {
      const current = sessionRef.current
      if (!current || !remote) return
      const index = current.chapters.findIndex((c) => c.id === currentChapterId)
      const next = current.chapters[index + 1]
      if (!next) return

      if (prefetchTimer.current) window.clearTimeout(prefetchTimer.current)
      prefetchTimer.current = window.setTimeout(() => {
        const key = chapterCacheKey(remote.provider, remote.mangaId, next.id)
        void loadChapterPagesCached(key, () => fetchChapterPages(next.id))
          .then((pages) => warmResolvedPages(pages, 0))
          .catch(() => {
            // Prefetch is best-effort; ignore rate limits here.
          })
      }, 800)
    },
    [remote, fetchChapterPages, warmResolvedPages],
  )

  const loadChapter = useCallback(
    async (id: string, restorePage = 0) => {
      setPagesLoading(true)
      setPagesError(null)
      try {
        const nextPages = await fetchChapterPages(id)
        setPages(nextPages)
        setChapterId(id)
        setPageIndex(Math.min(restorePage, Math.max(nextPages.length - 1, 0)))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const rateLimited = /429|rate.?limit|too many/i.test(message)
        setPagesError(
          rateLimited
            ? 'Source is rate-limiting requests. Wait a moment, then try again.'
            : message,
        )
        throw err
      } finally {
        setPagesLoading(false)
      }
    },
    [fetchChapterPages],
  )

  useEffect(() => {
    loadChapterRef.current = loadChapter
  }, [loadChapter])

  useEffect(() => {
    chapterIdRef.current = chapterId
  }, [chapterId])

  useEffect(() => {
    if (!session || !chapterId) return
    const index = session.chapters.findIndex((c) => c.id === chapterId)
    if (index < 0) return
    prefetchChapter(session.chapters[index + 1]?.id)
  }, [session, chapterId, prefetchChapter])

  useEffect(() => {
    if (!editionId || !isTauri()) {
      setLoading(false)
      setError('Reader requires the Fyodor desktop runtime.')
      return
    }

    const remoteSession = parseRemoteEdition(editionId)
    chapterQueryOnOpenRef.current = searchParams.get('chapter')
    const requestedChapter = chapterQueryOnOpenRef.current
    let cancelled = false
    setLoading(true)
    setError(null)
    setSession(null)
    setPages([])
    setChapterId(null)
    setPageIndex(0)

    void (async () => {
      try {
        if (remoteSession) {
          let chapters: {
            id: string
            title: string
            number?: number | null
            pageCount: number
            sortIndex: number
          }[] = []
          if (remoteSession.provider === 'atsu') {
            chapters = await api.atsuChapters(remoteSession.mangaId)
          } else if (remoteSession.provider === 'mangadex') {
            chapters = await api.mangadexChapters(remoteSession.mangaId)
          } else {
            const decoded = decodeKotatsuTitleId(remoteSession.mangaId)
            if (!decoded) throw new Error('Invalid Kotatsu title id')
            const list = await api.kotatsuChapters(decoded.source, decoded.url)
            chapters = list.map((ch) => ({
              id: ch.url,
              title: ch.title,
              number: ch.number ?? null,
              pageCount: 0,
              sortIndex: ch.sortIndex,
            }))
          }
          if (cancelled) return

          let title = 'Untitled'
          let providerName =
            remoteSession.provider === 'atsu'
              ? 'Atsumaru'
              : remoteSession.provider === 'mangadex'
                ? 'MangaDex'
                : 'Kotatsu'
          let contentType = 'manga'
          try {
            if (remoteSession.provider === 'atsu') {
              const details = await api.atsuTitleDetails(remoteSession.mangaId)
              if (cancelled) return
              title = details.title
              providerName = details.providerName
              contentType = details.contentType
            } else if (remoteSession.provider === 'mangadex') {
              const details = await api.mangadexTitleDetails(remoteSession.mangaId)
              if (cancelled) return
              title = details.title
              providerName = details.providerName
              contentType = details.contentType
            } else {
              const decoded = decodeKotatsuTitleId(remoteSession.mangaId)
              if (decoded) {
                const details = await api.kotatsuTitleDetails(decoded.source, decoded.url)
                if (cancelled) return
                title = String(details.title ?? title)
                providerName = `Kotatsu · ${decoded.source}`
              }
            }
          } catch {
            // Title metadata is optional once chapters are available.
          }

          const built = buildRemoteSession(
            remoteSession.provider,
            remoteSession.mangaId,
            title,
            providerName,
            contentType,
            chapters,
          )
          setSession(built)
          setMode(contentType === 'manhwa' ? 'vertical' : 'page')
          setDirection('ltr')

          const saved = loadRemoteProgress(remoteSession.provider, remoteSession.mangaId)
          const initialChapter =
            requestedChapter || saved?.chapterId || built.chapters[0]?.id || null
          if (!initialChapter) {
            setError('No chapters available for this title.')
            return
          }
          const restorePage =
            requestedChapter && requestedChapter !== saved?.chapterId
              ? 0
              : (saved?.pageIndex ?? 0)
          try {
            await loadChapterRef.current(initialChapter, restorePage)
          } catch {
            /* pagesError overlay */
          }
          return
        }

        const data = await api.openEditionForReading(editionId)
        if (cancelled) return
        setSession(data)
        setMode((data.edition.readingMode as ReadingMode) || 'page')
        setDirection((data.edition.readingDirection as ReadingDirection) || 'ltr')

        const initialChapter =
          requestedChapter || data.progress?.chapterId || data.chapters[0]?.id || null
        if (!initialChapter) {
          setError('No chapters available for this edition.')
          return
        }
        try {
          await loadChapterRef.current(
            initialChapter,
            requestedChapter && requestedChapter !== data.progress?.chapterId
              ? 0
              : (data.progress?.pageIndex ?? 0),
          )
        } catch {
          /* pagesError overlay */
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // intentionally editionId-only: remote/loadChapter/searchParams identity churn was
    // re-opening the session and snapping back to cover + page mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId])

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      const remoteSession = parseRemoteEdition(editionId)
      const activeChapter = chapterIdRef.current
      if (!editionId || !activeChapter || !isTauri()) return
      if (remoteSession) {
        saveRemoteProgress(remoteSession.provider, remoteSession.mangaId, {
          chapterId: activeChapter,
          pageIndex,
        })
        return
      }
      void api.saveReadingProgress({
        editionId,
        chapterId: activeChapter,
        pageIndex,
        scrollRatio: 0,
        completed: false,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!pages.length) return
    void warmResolvedPages(pages, pageIndex)
  }, [pages, pageIndex, warmResolvedPages])

  const goPage = useCallback(
    (delta: number) => {
      setPageIndex((current) => {
        const last = Math.max(pages.length - 1, 0)
        const next = Math.min(Math.max(current + delta, 0), last)
        if (next !== current) {
          const completed = next >= last && last > 0
          queueMicrotask(() => {
            void persistProgress(next, 0, completed)
          })
        }
        return next
      })
    },
    [pages.length, persistProgress],
  )

  useEffect(() => {
    if (mode !== 'page' || pages.length === 0) return
    for (const offset of [-1, 0, 1, 2]) {
      const path = pages[pageIndex + offset]
      if (path) preloadPageImage(path)
    }
  }, [mode, pages, pageIndex])

  const goChapter = useCallback(
    async (delta: number) => {
      if (!session) return
      const leavingId = chapterId
      const next = session.chapters[chapterIndex + delta]
      if (!next) return
      try {
        if (leavingId && delta > 0) {
          if (remote) {
            saveRemoteProgress(remote.provider, remote.mangaId, {
              chapterId: next.id,
              pageIndex: 0,
              markReadChapterId: leavingId,
            })
          } else if (editionId) {
            markLocalChapterRead(editionId, leavingId)
          }
        }
        await loadChapter(next.id, 0)
        await persistProgress(0)
      } catch {
        /* pagesError already set */
      }
    },
    [session, chapterIndex, chapterId, loadChapter, persistProgress, remote, editionId],
  )

  function backTarget() {
    if (remote) return `/remote/${remote.provider}/${remote.mangaId}`
    if (session) return `/title/${session.title.id}`
    return '/library'
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      const forward = direction === 'ltr' ? 1 : -1
      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault()
          if (mode === 'page') goPage(forward)
          break
        case 'ArrowLeft':
          event.preventDefault()
          if (mode === 'page') goPage(-forward)
          break
        case ' ':
        case 'PageDown':
          event.preventDefault()
          if (mode === 'page') goPage(1)
          else scrollRef.current?.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' })
          break
        case 'PageUp':
          event.preventDefault()
          if (mode === 'page') goPage(-1)
          else scrollRef.current?.scrollBy({ top: -window.innerHeight * 0.9, behavior: 'smooth' })
          break
        case 'Home':
          event.preventDefault()
          setPageIndex(0)
          void persistProgress(0)
          break
        case 'End':
          event.preventDefault()
          {
            const last = Math.max(pages.length - 1, 0)
            setPageIndex(last)
            void persistProgress(last)
          }
          break
        case 'Escape':
          if (fullscreen) void toggleFullscreen(false)
          else navigate(backTarget())
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    direction,
    mode,
    goPage,
    fullscreen,
    navigate,
    pages.length,
    persistProgress,
    remote,
    isRemote,
    session,
  ])

  async function toggleFullscreen(force?: boolean) {
    if (!isTauri()) return
    const win = getCurrentWindow()
    const next = force ?? !(await win.isFullscreen())
    await win.setFullscreen(next)
    setFullscreen(next)
  }

  async function bookmarkPosition() {
    if (!session || !isTauri()) return
    if (isRemote) {
      setNotice('Bookmarks are local-library only for now')
      window.setTimeout(() => setNotice(null), 1800)
      return
    }
    try {
      await api.createBookmark({
        titleId: session.title.id,
        editionId: session.edition.id,
        chapterId,
        pageIndex,
        scrollRatio: 0,
      })
      setNotice('Position bookmarked')
      window.setTimeout(() => setNotice(null), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function pageStyle(vertical = false): CSSProperties {
    const base: CSSProperties = {
      display: 'block',
      transform: `scale(${zoom})`,
      transformOrigin: vertical ? 'top center' : 'center center',
    }
    if (fit === 'width') {
      return { ...base, width: '100%', maxWidth: '100%', height: 'auto' }
    }
    if (fit === 'height') {
      if (vertical) {
        return { ...base, width: 'auto', maxWidth: '100%', height: 'auto' }
      }
      return { ...base, height: '100%', maxHeight: '100%', width: 'auto' }
    }
    if (fit === 'screen') {
      if (vertical) {
        return { ...base, width: '100%', maxWidth: 'min(100%, 920px)', height: 'auto' }
      }
      return {
        ...base,
        maxWidth: '100%',
        maxHeight: '100%',
        width: 'auto',
        height: 'auto',
        objectFit: 'contain',
      }
    }
    return { ...base, width: 'auto', height: 'auto', maxWidth: '100%' }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--fy-reader-bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--fy-border)] border-t-[var(--fy-text)]" />
      </div>
    )
  }

  if (error || !session) {
    const rateLimited = (error ?? '').toLowerCase().includes('rate')
    return (
      <div className="h-full bg-[var(--fy-reader-bg)]">
        <EmptyState
          title={rateLimited ? 'Source is busy' : 'Unable to open reader'}
          description={error ?? 'Edition unavailable.'}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" onClick={() => navigate(0)}>
                Try again
              </Button>
              <Button variant="secondary" onClick={() => navigate(backTarget())}>
                {isRemote ? 'Back to title' : 'Back to library'}
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const chapter = session.chapters[chapterIndex]
  const pageCount = pages.length
  const chapterLabel =
    chapter?.number != null ? `Ch. ${chapter.number}` : chapter?.title || 'Chapter'
  const editionLabel = session.edition.label || session.edition.providerId || 'Local'

  return (
    <div className="relative h-full overflow-hidden fy-reader-ambient text-[var(--fy-text)]">
      <aside className="fy-liquid-glass fy-reader-glass absolute bottom-3 left-3 top-3 z-20 flex w-[280px] flex-col overflow-hidden rounded-[28px]">
        <div className="relative z-[1] border-b border-[var(--fy-border-subtle)] px-3 py-3">
          <div className="mb-2 flex items-start gap-2">
            <button
              type="button"
              aria-label="Close reader"
              className="mt-0.5 rounded-md p-1 text-[var(--fy-text-muted)] hover:bg-[var(--fy-nav-active)] hover:text-[var(--fy-text)]"
              onClick={() => navigate(backTarget())}
            >
              <X size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-snug tracking-tight">
                {session.title.primaryTitle}
              </div>
              <div className="mt-0.5 truncate text-xs text-[var(--fy-text-muted)]">
                {editionLabel}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous chapter"
              disabled={chapterIndex <= 0 || pagesLoading}
              className="rounded-md p-1.5 text-[var(--fy-text-muted)] hover:bg-[var(--fy-nav-active)] disabled:opacity-40"
              onClick={() => void goChapter(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <select
              className="min-w-0 flex-1 truncate fy-liquid-control px-2 py-1.5 text-xs outline-none focus:border-[var(--fy-border)]"
              value={chapterId ?? ''}
              disabled={pagesLoading}
              onChange={(e) => {
                void loadChapter(e.target.value, 0).catch(() => undefined)
              }}
              aria-label="Select chapter"
            >
              {session.chapters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Next chapter"
              disabled={chapterIndex >= session.chapters.length - 1 || pagesLoading}
              className="rounded-md p-1.5 text-[var(--fy-text-muted)] hover:bg-[var(--fy-nav-active)] disabled:opacity-40"
              onClick={() => void goChapter(1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-1">
            <button
              type="button"
              aria-label="First page"
              disabled={pageIndex <= 0 || pageCount === 0}
              className="rounded-md p-1.5 text-[var(--fy-text-muted)] hover:bg-[var(--fy-nav-active)] disabled:opacity-40"
              onClick={() => {
                setPageIndex(0)
                void persistProgress(0)
              }}
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              type="button"
              aria-label="Previous page"
              disabled={pageIndex <= 0 || pageCount === 0}
              className="rounded-md p-1.5 text-[var(--fy-text-muted)] hover:bg-[var(--fy-nav-active)] disabled:opacity-40"
              onClick={() => goPage(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[4.5rem] text-center font-mono text-xs text-[var(--fy-text-muted)]">
              {pageCount === 0 ? '0 / 0' : `${pageIndex + 1} / ${pageCount}`}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={pageIndex >= pageCount - 1 || pageCount === 0}
              className="rounded-md p-1.5 text-[var(--fy-text-muted)] hover:bg-[var(--fy-nav-active)] disabled:opacity-40"
              onClick={() => goPage(1)}
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              aria-label="Last page"
              disabled={pageIndex >= pageCount - 1 || pageCount === 0}
              className="rounded-md p-1.5 text-[var(--fy-text-muted)] hover:bg-[var(--fy-nav-active)] disabled:opacity-40"
              onClick={() => {
                const last = Math.max(pageCount - 1, 0)
                setPageIndex(last)
                void persistProgress(last)
              }}
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>

        <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto">
          <SidebarSection
            label="Page Style"
            open={styleOpen}
            onToggle={() => setStyleOpen((v) => !v)}
          >
            <label className="block text-xs text-[var(--fy-text-muted)]">
              Mode
              <select
                className="mt-1 w-full fy-liquid-control px-2 py-1.5 text-sm text-[var(--fy-text)]"
                value={mode}
                onChange={(e) => setMode(e.target.value as ReadingMode)}
              >
                <option value="page">Page-based</option>
                <option value="vertical">Vertical</option>
              </select>
            </label>
            <label className="mt-2 block text-xs text-[var(--fy-text-muted)]">
              Direction
              <select
                className="mt-1 w-full fy-liquid-control px-2 py-1.5 text-sm text-[var(--fy-text)]"
                value={direction}
                onChange={(e) => setDirection(e.target.value as ReadingDirection)}
              >
                <option value="ltr">Left to right</option>
                <option value="rtl">Right to left</option>
              </select>
            </label>
          </SidebarSection>

          <SidebarSection
            label="Page Fit"
            open={fitOpen}
            onToggle={() => setFitOpen((v) => !v)}
          >
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['width', 'Width'],
                  ['height', 'Height'],
                  ['screen', 'Screen'],
                  ['original', 'Original'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    'rounded-md border px-2 py-1.5 text-xs',
                    fit === value
                      ? 'border-[var(--fy-border)] bg-[var(--fy-nav-active)]'
                      : 'border-[var(--fy-border-subtle)] hover:bg-[var(--fy-nav-active)]',
                  )}
                  onClick={() => setFit(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </SidebarSection>

          <SidebarSection
            label="Settings"
            open={settingsOpen}
            onToggle={() => setSettingsOpen((v) => !v)}
            icon={<SlidersHorizontal size={14} />}
          >
            <label className="block text-xs text-[var(--fy-text-muted)]">
              Zoom ({Math.round(zoom * 100)}%)
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <div className="mt-3 flex flex-col gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => void bookmarkPosition()}>
                Bookmark position
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void toggleFullscreen()}>
                {fullscreen ? (
                  <>
                    <Minimize2 size={14} /> Exit fullscreen
                  </>
                ) : (
                  <>
                    <Maximize2 size={14} /> Fullscreen
                  </>
                )}
              </Button>
            </div>
          </SidebarSection>
        </div>

        <div className="relative z-[1] border-t border-[var(--fy-border-subtle)] px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{chapterLabel}</div>
              <div className="truncate text-xs text-[var(--fy-text-muted)]">{editionLabel}</div>
            </div>
            <ChevronsUpDown size={14} className="mt-1 shrink-0 text-[var(--fy-text-muted)]" />
          </div>
          {notice ? (
            <p className="mt-2 text-[11px] text-[var(--fy-text-muted)]">{notice}</p>
          ) : null}
        </div>
      </aside>

      <main className="absolute inset-0 z-0">
        {pagesError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="max-w-md text-sm text-[var(--fy-danger)]">{pagesError}</p>
            <Button
              variant="secondary"
              disabled={!chapterId || pagesLoading}
              onClick={() => {
                if (!chapterId) return
                pageCacheRef.current.delete(chapterId)
                void loadChapter(chapterId, pageIndex).catch(() => undefined)
              }}
            >
              Try again
            </Button>
          </div>
        ) : pagesLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--fy-border)] border-t-[var(--fy-text)]" />
            <p className="text-xs text-[var(--fy-text-muted)]">Loading pages…</p>
          </div>
        ) : pagesError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="max-w-md text-sm text-[var(--fy-text)]">{pagesError}</p>
            {pagesRateLimited ? (
              <p className="max-w-sm text-xs text-[var(--fy-text-muted)]">
                Sources like MangaDex throttle bursts. Prefetch will retry quietly in the
                background after a pause.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                disabled={!chapterId || pagesLoading}
                onClick={() => {
                  if (!chapterId) return
                  void loadChapter(chapterId, pageIndex).catch(() => undefined)
                }}
              >
                Try again
              </Button>
              <Button
                variant="secondary"
                disabled={chapterIndex >= session.chapters.length - 1 || pagesLoading}
                onClick={() => void goChapter(1)}
              >
                Next chapter
              </Button>
            </div>
          </div>
        ) : mode === 'vertical' ? (
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto overscroll-contain px-4 py-4 pl-[304px]"
            onScroll={(e) => {
              const el = e.currentTarget
              const ratio = el.scrollTop / Math.max(el.scrollHeight - el.clientHeight, 1)
              void persistProgress(pageIndex, ratio)
            }}
          >
            <div className="mx-auto flex w-full max-w-[920px] flex-col items-center gap-2">
              {pages.map((page, index) => (
                <ReaderPageImage
                  key={`${page}-${index}`}
                  path={page}
                  alt={`Page ${index + 1}`}
                  className="w-full"
                  style={pageStyle(true)}
                  eager={index < 3}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="relative flex h-full items-center justify-center overflow-auto p-4 pl-[304px]">
            {pages.length === 0 ? (
              <p className="text-[var(--fy-text-muted)]">No page image</p>
            ) : (
              pages.map((page, index) => {
                if (Math.abs(index - pageIndex) > 1) return null
                const active = index === pageIndex
                return (
                  <ReaderPageImage
                    key={`${page}-${index}`}
                    path={page}
                    alt={`Page ${index + 1}`}
                    className={cn(
                      'max-h-full max-w-full',
                      active ? 'relative' : 'pointer-events-none absolute opacity-0',
                    )}
                    style={pageStyle(false)}
                    eager
                    priority={active}
                  />
                )
              })
            )}
          </div>
        )}
      </main>
    </div>
  )
}

const pageUrlCache = new Map<string, string>()
const pagePreloadSet = new Set<string>()

function pageSrcSync(path: string): string | undefined {
  const cached = pageUrlCache.get(path)
  if (cached) return cached
  const proxied = toFyodorCdnUrl(path)
  if (proxied) {
    pageUrlCache.set(path, proxied)
    return proxied
  }
  if (
    path.startsWith('http') ||
    path.startsWith('data:') ||
    path.startsWith('blob:') ||
    path.startsWith('asset:') ||
    path.startsWith('https://asset.localhost') ||
    path.startsWith('http://asset.localhost') ||
    path.startsWith('http://fyodor-cdn.localhost') ||
    path.startsWith('https://fyodor-cdn.localhost')
  ) {
    pageUrlCache.set(path, path)
    return path
  }
  const asset = toAssetUrl(path)
  if (asset) {
    pageUrlCache.set(path, asset)
    return asset
  }
  return undefined
}

function resolvePageSrc(path: string): Promise<string> {
  const sync = pageSrcSync(path)
  if (sync) return Promise.resolve(sync)
  return resolveRemoteImageUrl(path).then((url) => {
    const resolved = url ?? toAssetUrl(path) ?? path
    pageUrlCache.set(path, resolved)
    return resolved
  })
}

function preloadPageImage(path: string) {
  if (pagePreloadSet.has(path)) return
  pagePreloadSet.add(path)
  void resolvePageSrc(path).then((url) => {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  })
}

function ReaderPageImage({
  path,
  alt,
  className,
  style,
  eager = false,
  priority = false,
}: {
  path: string
  alt: string
  className?: string
  style?: CSSProperties
  eager?: boolean
  priority?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const [src, setSrc] = useState<string | undefined>(() => pageSrcSync(path))

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    const sync = pageSrcSync(path)
    if (sync) {
      setSrc(sync)
      return () => {
        cancelled = true
      }
    }
    void resolvePageSrc(path).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [path, retryToken])

  if (failed) {
    return (
      <div
        className={cn(
          'flex min-h-[120px] flex-col items-center justify-center gap-2 text-sm text-[var(--fy-text-muted)]',
          className,
        )}
      >
        <span>Unable to load page image</span>
        <button
          type="button"
          className="rounded-md border border-[var(--fy-border-subtle)] px-2 py-1 text-xs text-[var(--fy-text)] hover:bg-[var(--fy-nav-active)]"
          onClick={() => {
            setFailed(false)
            setRetryToken((n) => n + 1)
          }}
        >
          Retry image
        </button>
      </div>
    )
  }

  if (!src) {
    return (
      <div
        className={cn(
          'flex min-h-[120px] items-center justify-center text-sm text-[var(--fy-text-muted)]',
          className,
        )}
      >
        Loading…
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={eager ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : eager ? 'auto' : 'low'}
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}

function SidebarSection({
  label,
  open,
  onToggle,
  children,
  icon,
}: {
  label: string
  open: boolean
  onToggle: () => void
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="border-b border-[var(--fy-border-subtle)]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm hover:bg-[var(--fy-nav-active)]"
        onClick={onToggle}
      >
        <span className="flex items-center gap-2">
          {icon ?? <Settings2 size={14} className="text-[var(--fy-text-muted)]" />}
          {label}
        </span>
        <ChevronRight
          size={14}
          className={cn(
            'text-[var(--fy-text-muted)] transition-transform',
            open && 'rotate-90',
          )}
        />
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </div>
  )
}
