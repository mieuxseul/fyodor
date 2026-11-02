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
import { api, isTauri, resolveRemoteImageUrl, toAssetUrl } from '@/lib/api'
import { cn } from '@/lib/cn'
import type {
  Chapter,
  Edition,
  FitMode,
  ReaderSession,
  ReadingDirection,
  ReadingMode,
  Title,
} from '@/lib/types'

type RemoteProvider = 'atsu' | 'mangadex'

function parseRemoteEdition(
  editionId: string,
): { provider: RemoteProvider; mangaId: string } | null {
  for (const provider of ['atsu', 'mangadex'] as const) {
    const prefix = `${provider}:`
    if (editionId.startsWith(prefix)) {
      const mangaId = editionId.slice(prefix.length).trim()
      return mangaId ? { provider, mangaId } : null
    }
  }
  return null
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
  const [loading, setLoading] = useState(true)
  const [pagesLoading, setPagesLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<number | null>(null)

  const chapterIndex = useMemo(() => {
    if (!session || !chapterId) return 0
    return Math.max(0, session.chapters.findIndex((c) => c.id === chapterId))
  }, [session, chapterId])

  const persistProgress = useCallback(
    async (nextPage: number, scrollRatio = 0, completed = false) => {
      if (!editionId || !chapterId || !isTauri() || isRemote) return
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        void api.saveReadingProgress({
          editionId,
          chapterId,
          pageIndex: nextPage,
          scrollRatio,
          completed,
        })
      }, 400)
    },
    [editionId, chapterId, isRemote],
  )

  const loadChapter = useCallback(
    async (id: string, restorePage = 0) => {
      setPagesLoading(true)
      try {
        if (remote?.provider === 'atsu') {
          const data = await api.atsuChapterPages(remote.mangaId, id)
          setPages(data.pages)
          setChapterId(id)
          setPageIndex(Math.min(restorePage, Math.max(data.pages.length - 1, 0)))
          return
        }
        if (remote?.provider === 'mangadex') {
          const data = await api.mangadexChapterPages(remote.mangaId, id)
          setPages(data.pages)
          setChapterId(id)
          setPageIndex(Math.min(restorePage, Math.max(data.pages.length - 1, 0)))
          return
        }
        const data = await api.getChapterPages(id)
        setPages(data.pages)
        setChapterId(id)
        setPageIndex(Math.min(restorePage, Math.max(data.pages.length - 1, 0)))
      } finally {
        setPagesLoading(false)
      }
    },
    [remote],
  )

  useEffect(() => {
    if (!editionId || !isTauri()) {
      setLoading(false)
      setError('Reader requires the FYODOR desktop runtime.')
      return
    }

    let cancelled = false
    void (async () => {
      try {
        if (remote) {
          const [details, chapters] =
            remote.provider === 'atsu'
              ? await Promise.all([
                  api.atsuTitleDetails(remote.mangaId),
                  api.atsuChapters(remote.mangaId),
                ])
              : await Promise.all([
                  api.mangadexTitleDetails(remote.mangaId),
                  api.mangadexChapters(remote.mangaId),
                ])
          if (cancelled) return
          const remoteSession = buildRemoteSession(
            remote.provider,
            remote.mangaId,
            details.title,
            details.providerName,
            details.contentType,
            chapters,
          )
          setSession(remoteSession)
          setMode(details.contentType === 'manhwa' ? 'vertical' : 'page')
          setDirection('ltr')

          const requested = searchParams.get('chapter')
          const initialChapter = requested || remoteSession.chapters[0]?.id || null
          if (!initialChapter) {
            setError('No chapters available for this title.')
            return
          }
          await loadChapter(initialChapter, 0)
          return
        }

        const data = await api.openEditionForReading(editionId)
        if (cancelled) return
        setSession(data)
        setMode((data.edition.readingMode as ReadingMode) || 'page')
        setDirection((data.edition.readingDirection as ReadingDirection) || 'ltr')

        const requested = searchParams.get('chapter')
        const initialChapter =
          requested || data.progress?.chapterId || data.chapters[0]?.id || null
        if (!initialChapter) {
          setError('No chapters available for this edition.')
          return
        }
        await loadChapter(initialChapter, data.progress?.pageIndex ?? 0)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [editionId, remote, loadChapter, searchParams])

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      if (editionId && chapterId && isTauri() && !isRemote) {
        void api.saveReadingProgress({
          editionId,
          chapterId,
          pageIndex,
          scrollRatio: 0,
          completed: false,
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goPage = useCallback(
    (delta: number) => {
      setPageIndex((current) => {
        const next = Math.min(Math.max(current + delta, 0), Math.max(pages.length - 1, 0))
        void persistProgress(next)
        return next
      })
    },
    [pages.length, persistProgress],
  )

  const goChapter = useCallback(
    async (delta: number) => {
      if (!session) return
      const next = session.chapters[chapterIndex + delta]
      if (!next) return
      await loadChapter(next.id, 0)
      await persistProgress(0)
    },
    [session, chapterIndex, loadChapter, persistProgress],
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

  function pageStyle(): CSSProperties {
    const base: CSSProperties = {
      transform: `scale(${zoom})`,
      transformOrigin: 'top left',
    }
    if (fit === 'width') return { ...base, width: '100%', height: 'auto' }
    if (fit === 'height') return { ...base, height: '100%', width: 'auto' }
    if (fit === 'screen') {
      return { ...base, maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }
    }
    return { ...base, width: 'auto', height: 'auto' }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--fy-reader-bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--fy-border)] border-t-[var(--fy-text)]" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="h-full bg-[var(--fy-reader-bg)]">
        <EmptyState
          title="Unable to open reader"
          description={error ?? 'Edition unavailable.'}
          action={
            <Button variant="secondary" onClick={() => navigate(backTarget())}>
              {isRemote ? 'Back to title' : 'Back to library'}
            </Button>
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
    <div className="flex h-full overflow-hidden bg-[var(--fy-reader-bg)] text-[var(--fy-text)]">
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)]">
        <div className="border-b border-[var(--fy-border-subtle)] px-3 py-3">
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
              className="min-w-0 flex-1 truncate rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-2 py-1.5 text-xs outline-none focus:border-[var(--fy-border)]"
              value={chapterId ?? ''}
              disabled={pagesLoading}
              onChange={(e) => void loadChapter(e.target.value, 0)}
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarSection
            label="Page Style"
            open={styleOpen}
            onToggle={() => setStyleOpen((v) => !v)}
          >
            <label className="block text-xs text-[var(--fy-text-muted)]">
              Mode
              <select
                className="mt-1 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-2 py-1.5 text-sm text-[var(--fy-text)]"
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
                className="mt-1 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-2 py-1.5 text-sm text-[var(--fy-text)]"
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

        <div className="border-t border-[var(--fy-border-subtle)] px-3 py-3">
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

      <main className="relative min-w-0 flex-1 bg-[var(--fy-reader-bg)]">
        {pagesLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--fy-border)] border-t-[var(--fy-text)]" />
          </div>
        ) : mode === 'vertical' ? (
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto px-4 py-4"
            onScroll={(e) => {
              const el = e.currentTarget
              const ratio = el.scrollTop / Math.max(el.scrollHeight - el.clientHeight, 1)
              void persistProgress(pageIndex, ratio)
            }}
          >
            <div className="flex w-full flex-col gap-2">
              {pages.map((page, index) => (
                <ReaderPageImage
                  key={`${page}-${index}`}
                  path={page}
                  alt={`Page ${index + 1}`}
                  className="w-full"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-start justify-start overflow-auto p-4">
            {pages[pageIndex] ? (
              <ReaderPageImage
                path={pages[pageIndex]}
                alt={`Page ${pageIndex + 1}`}
                className="max-h-full max-w-full"
                style={pageStyle()}
              />
            ) : (
              <p className="text-[var(--fy-text-muted)]">No page image</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function ReaderPageImage({
  path,
  alt,
  className,
  style,
}: {
  path: string
  alt: string
  className?: string
  style?: CSSProperties
}) {
  const [src, setSrc] = useState<string | undefined>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSrc(undefined)
    setFailed(false)
    void resolveRemoteImageUrl(path).then((url) => {
      if (!cancelled) setSrc(url ?? toAssetUrl(path))
    })
    return () => {
      cancelled = true
    }
  }, [path])

  if (failed || !src) {
    return (
      <div
        className={cn(
          'flex min-h-[120px] items-center justify-center text-sm text-[var(--fy-text-muted)]',
          className,
        )}
      >
        {failed ? 'Unable to load page image' : 'Loading…'}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
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
