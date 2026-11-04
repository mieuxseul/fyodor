import { BarChart3, ChevronLeft, Sparkles, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ChapterReadControls } from '@/components/ChapterReadControls'
import { RemoteCover } from '@/components/RemoteCover'
import { TitleSocialControls } from '@/components/social/TitleSocialControls'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toaster'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/Sheet'
import {
  api,
  isTauri,
  type RemoteChapter,
  type RemoteLibraryRef,
  type RemoteTitleDetails,
} from '@/lib/api'
import { cn } from '@/lib/cn'
import {
  markChaptersSeen,
  recordKnownChapterCount,
} from '@/lib/chapter-seen'
import {
  getTitleCategoryId,
  listCategories,
  setTitleCategory,
  subscribeLibraryCategories,
  type LibraryCategory,
} from '@/lib/library-categories'
import {
  loadRemoteProgress,
  markChapterRead,
  markChapterUnread,
  markPreviousRead,
  type RemoteProgressSnapshot,
} from '@/lib/remote-progress'
import { isIncognitoSession } from '@/lib/incognito'
import { LIBRARY_OPENED_EVENT } from '@/lib/library-display'
import { remoteSocialInput } from '@/lib/social-title'
import { decodeKotatsuTitleId } from '@/source-network/providers/kotatsu'

const PAGE_SIZE = 40
const SYNOPSIS_PREVIEW = 280
const SUPPORTED = new Set(['atsu', 'mangadex', 'kotatsu'])

function cleanSynopsis(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/\*/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function RemoteTitlePage() {
  const params = useParams()
  const providerId = params.providerId ?? ''
  const titleId = decodeURIComponent(params.titleId ?? '')
  const navigate = useNavigate()
  const [details, setDetails] = useState<RemoteTitleDetails | null>(null)
  const [chapters, setChapters] = useState<RemoteChapter[]>([])
  const [libraryRef, setLibraryRef] = useState<RemoteLibraryRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [chapterQuery, setChapterQuery] = useState('')
  const [chapterSort, setChapterSort] = useState<'asc' | 'desc'>('desc')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [synopsisOpen, setSynopsisOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [categories, setCategories] = useState<LibraryCategory[]>(() => listCategories())
  const [activeCategoryId, setActiveCategoryId] = useState('reading')
  const [progress, setProgress] = useState<RemoteProgressSnapshot | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [offlineByRemoteId, setOfflineByRemoteId] = useState<Record<string, string>>({})
  useEffect(
    () => subscribeLibraryCategories(() => setCategories(listCategories())),
    [],
  )

  useEffect(() => {
    if (!SUPPORTED.has(providerId) || !titleId) {
      setProgress(null)
      return
    }
    const refresh = () => setProgress(loadRemoteProgress(providerId, titleId))
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [providerId, titleId])

  useEffect(() => {
    if (!isTauri() || (providerId !== 'atsu' && providerId !== 'mangadex') || !titleId) {
      setOfflineByRemoteId({})
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const jobs = await api.listDownloads(500)
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const job of jobs) {
          if (
            job.status === 'completed' &&
            job.providerId === providerId &&
            job.providerTitleId === titleId &&
            job.remoteChapterId
          ) {
            map[job.remoteChapterId] = job.id
          }
        }
        setOfflineByRemoteId(map)
      } catch {
        if (!cancelled) setOfflineByRemoteId({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [providerId, titleId])

  useEffect(() => {
    if (!SUPPORTED.has(providerId) || !titleId || !isTauri()) {
      setLoading(false)
      setError(
        !SUPPORTED.has(providerId)
          ? 'This provider has no in-app details page yet.'
          : 'Remote titles require the Fyodor desktop runtime.',
      )
      return
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const remoteRefPromise = api.getRemoteLibraryRef(providerId, titleId)
        if (providerId === 'atsu') {
          const [bundle, remoteRef] = await Promise.all([
            api.atsuTitleBundle(titleId),
            remoteRefPromise,
          ])
          if (cancelled) return
          setDetails(bundle.details)
          setChapters(bundle.chapters)
          setLibraryRef(remoteRef)
        } else if (providerId === 'mangadex') {
          const [detail, chapterList, remoteRef] = await Promise.all([
            api.mangadexTitleDetails(titleId),
            api.mangadexChapters(titleId),
            remoteRefPromise,
          ])
          if (cancelled) return
          setDetails(detail)
          setChapters(chapterList)
          setLibraryRef(remoteRef)
        } else {
          const decoded = decodeKotatsuTitleId(titleId)
          if (!decoded) throw new Error('Invalid Kotatsu title id')
          const [raw, chapterList, remoteRef] = await Promise.all([
            api.kotatsuTitleDetails(decoded.source, decoded.url),
            api.kotatsuChapters(decoded.source, decoded.url),
            remoteRefPromise,
          ])
          if (cancelled) return
          const detail: RemoteTitleDetails = {
            id: titleId,
            title: String(raw.title ?? 'Untitled'),
            alternateTitles: Array.isArray(raw.altTitles)
              ? (raw.altTitles as string[])
              : [],
            description: (raw.description as string | null | undefined) ?? null,
            coverUrl: (raw.coverUrl as string | null | undefined) ?? null,
            contentType: 'manga',
            publicationStatus: (raw.state as string | null | undefined) ?? null,
            genres: Array.isArray(raw.genres) ? (raw.genres as string[]) : [],
            tags: [],
            author: Array.isArray(raw.authors)
              ? ((raw.authors as string[])[0] ?? null)
              : null,
            artist: null,
            websiteUrl: String(raw.publicUrl ?? ''),
            isAdult: Boolean(raw.isAdult),
            chapterCount: Number(raw.chapterCount ?? chapterList.length),
            providerId: 'kotatsu',
            providerName: `Kotatsu · ${decoded.source}`,
          }
          setDetails(detail)
          setChapters(
            chapterList.map((ch) => ({
              id: ch.url,
              mangaId: titleId,
              title: ch.title,
              number: ch.number ?? null,
              pageCount: 0,
              scanlator: ch.scanlator ?? null,
              sortIndex: ch.sortIndex,
            })),
          )
          setLibraryRef(remoteRef)
        }
        if (cancelled) return
        setVisibleCount(PAGE_SIZE)
        setSynopsisOpen(false)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [providerId, titleId])

  useEffect(() => {
    if (!providerId || !titleId || chapters.length === 0) return
    const count = Math.max(details?.chapterCount ?? 0, chapters.length)
    recordKnownChapterCount(providerId, titleId, count)
    markChaptersSeen(providerId, titleId, count)
  }, [providerId, titleId, chapters, details?.chapterCount])

  useEffect(() => {
    if (!libraryRef?.inLibrary || !libraryRef.titleId || !isTauri()) return
    if (isIncognitoSession()) return
    void api.markTitleOpened(libraryRef.titleId).then(() => {
      window.dispatchEvent(new Event(LIBRARY_OPENED_EVENT))
    })
  }, [libraryRef?.inLibrary, libraryRef?.titleId])

  const filteredChapters = useMemo(() => {
    const q = chapterQuery.trim().toLowerCase()
    let list = [...chapters]
    if (q) {
      list = list.filter(
        (ch) =>
          ch.title.toLowerCase().includes(q) ||
          (ch.number != null && String(ch.number).includes(q)) ||
          (ch.scanlator ?? '').toLowerCase().includes(q),
      )
    }
    list.sort((a, b) => {
      const an = a.number ?? Number.POSITIVE_INFINITY
      const bn = b.number ?? Number.POSITIVE_INFINITY
      if (an !== bn) return chapterSort === 'asc' ? an - bn : bn - an
      return chapterSort === 'asc' ? a.sortIndex - b.sortIndex : b.sortIndex - a.sortIndex
    })
    return list
  }, [chapters, chapterQuery, chapterSort])

  const visibleChapters = filteredChapters.slice(0, visibleCount)
  const firstChapter =
    filteredChapters.length > 0
      ? [...filteredChapters].sort((a, b) => (a.number ?? 0) - (b.number ?? 0))[0]
      : null

  const synopsisText = useMemo(
    () => cleanSynopsis(details?.description),
    [details?.description],
  )
  const synopsisNeedsToggle = synopsisText.length > SYNOPSIS_PREVIEW
  const synopsisShown =
    !synopsisNeedsToggle || synopsisOpen
      ? synopsisText
      : `${synopsisText.slice(0, SYNOPSIS_PREVIEW).replace(/\s+\S*$/, '')}…`

  const canDownloadOffline = providerId === 'atsu' || providerId === 'mangadex'

  async function downloadChapter(chapter: RemoteChapter) {
    if (!details || !canDownloadOffline || !isTauri()) return
    setDownloadingId(chapter.id)
    setNotice(null)
    setError(null)
    try {
      const job = await api.downloadRemoteChapter({
        providerId,
        providerName: details.providerName || providerId,
        providerTitleId: titleId,
        remoteChapterId: chapter.id,
        chapterTitle: chapter.title,
        primaryTitle: details.title,
        coverUrl: details.coverUrl,
        contentType: details.contentType,
      })
      if (job.status === 'completed' && job.remoteChapterId) {
        setOfflineByRemoteId((prev) => ({ ...prev, [job.remoteChapterId!]: job.id }))
      }
      setNotice(
        job.status === 'completed'
          ? `Saved offline: ${chapter.title}. Open it from Downloads.`
          : `Download ${job.status}.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDownloadingId(null)
    }
  }

  async function deleteOfflineChapter(chapter: RemoteChapter) {
    const downloadId = offlineByRemoteId[chapter.id]
    if (!downloadId || !isTauri() || deletingId) return
    if (
      !window.confirm(
        `Delete “${chapter.title}” from this device? Offline pages will be removed. You can download it again later.`,
      )
    ) {
      return
    }
    setDeletingId(chapter.id)
    setNotice(null)
    setError(null)
    try {
      await api.deleteDownload(downloadId)
      setOfflineByRemoteId((prev) => {
        const next = { ...prev }
        delete next[chapter.id]
        return next
      })
      toast.success('Download deleted', { description: chapter.title })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.error('Couldn’t delete download', { description: message })
    } finally {
      setDeletingId(null)
    }
  }

  function openChapter(chapter: RemoteChapter) {
    navigate(`/reader/${providerId}:${titleId}?chapter=${encodeURIComponent(chapter.id)}`)
  }

  function openLibraryCategorySheet() {
    if (libraryRef?.inLibrary && libraryRef.titleId) {
      setActiveCategoryId(getTitleCategoryId(libraryRef.titleId))
    } else {
      setActiveCategoryId('reading')
    }
    setCategoryOpen(true)
  }

  async function removeFromLibrary() {
    if (!libraryRef?.inLibrary || !libraryRef.titleId || !isTauri()) return
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      await api.removeFromLibrary(libraryRef.titleId)
      setLibraryRef({
        titleId: '',
        editionId: '',
        providerId,
        providerTitleId: titleId,
        inLibrary: false,
      })
      setCategoryOpen(false)
      toast.success('Removed from library')
      setNotice(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error('Couldn’t remove title', { description: message })
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  async function addOrMoveToCategory(categoryId: string) {
    if (!details || !isTauri()) return
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      let ref = libraryRef
      if (!ref?.inLibrary) {
        ref = await api.addRemoteToLibrary({
          providerId: details.providerId,
          providerName: details.providerName,
          providerTitleId: details.id,
          primaryTitle: details.title,
          alternateTitles: details.alternateTitles,
          description: details.description,
          author: details.author,
          artist: details.artist,
          genres: details.genres,
          tags: details.tags ?? [],
          contentType: details.contentType,
          publicationStatus: details.publicationStatus,
          coverUrl: details.coverUrl,
          websiteUrl: details.websiteUrl,
          readingMode: details.contentType === 'manhwa' ? 'vertical' : 'page',
          readingDirection: 'ltr',
        })
        setLibraryRef(ref)
      }
      if (!ref?.titleId) throw new Error('Could not resolve library title')
      const category = setTitleCategory(ref.titleId, categoryId)
      setActiveCategoryId(categoryId)
      if (category?.status) {
        await api.updateTitle({ id: ref.titleId, status: category.status })
      }
      setCategoryOpen(false)
      const wasInLibrary = Boolean(libraryRef?.inLibrary)
      const message = wasInLibrary
        ? `Moved to ${category?.name ?? 'library'}`
        : `Added to ${category?.name ?? 'library'}`
      toast.success(message, { description: details.title })
      setNotice(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error('Couldn’t update library', { description: message })
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-4 w-24 animate-pulse rounded bg-[var(--fy-bg)]" />
        <div className="flex gap-6">
          <div className="h-64 w-44 animate-pulse rounded-lg bg-[var(--fy-bg)]" />
          <div className="flex-1 space-y-3 pt-2">
            <div className="h-8 w-2/3 animate-pulse rounded bg-[var(--fy-bg)]" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-[var(--fy-bg)]" />
            <div className="h-10 w-40 animate-pulse rounded bg-[var(--fy-bg)]" />
          </div>
        </div>
      </div>
    )
  }

  if (error && !details) {
    return (
      <EmptyState
        title="Unable to open title"
        description={error}
        action={
          <Button variant="secondary" onClick={() => navigate('/discover')}>
            Back to Discover
          </Button>
        }
      />
    )
  }

  if (!details) {
    return (
      <EmptyState
        title="Title unavailable"
        description="No metadata was returned for this title."
        action={
          <Button variant="secondary" onClick={() => navigate('/discover')}>
            Back to Discover
          </Button>
        }
      />
    )
  }

  const continueChapter =
    (progress?.chapterId
      ? chapters.find((chapter) => chapter.id === progress.chapterId)
      : null) ?? null
  const startChapter = continueChapter ?? firstChapter ?? chapters[0] ?? null
  const hasProgress = Boolean(progress?.chapterId)
  const readChapterIds = new Set(progress?.readChapterIds ?? [])
  const readCount = chapters.filter((c) => readChapterIds.has(c.id)).length
  const statsPercent =
    chapters.length > 0 ? Math.round((readCount / chapters.length) * 100) : 0
  const suggestionsQuery = details.genres[0]
    ? `${details.title} ${details.genres[0]}`
    : details.title
  const metaBits = [
    details.providerName,
    details.contentType,
    details.publicationStatus?.replace(/_/g, ' '),
    details.author,
    details.releaseYear != null ? String(details.releaseYear) : null,
    details.rating != null ? `★ ${details.rating.toFixed(1)}` : null,
    chapters.length > 0 ? `${chapters.length} ch` : null,
  ].filter(Boolean)

  return (
    <div className="pb-8">
      <button
        type="button"
        onClick={() => navigate(libraryRef?.inLibrary ? '/library' : '/discover')}
        className="mb-5 inline-flex items-center gap-1 text-sm text-[var(--fy-text-muted)] transition hover:text-[var(--fy-text)]"
      >
        <ChevronLeft size={16} />
        {libraryRef?.inLibrary ? 'Library' : 'Discover'}
      </button>

      {error ? <p className="mb-3 text-sm text-[var(--fy-danger)]">{error}</p> : null}
      {notice ? <p className="mb-3 text-sm text-[var(--fy-text-muted)]">{notice}</p> : null}

      <section className="mb-10 flex w-full flex-col gap-6 sm:flex-row sm:items-start">
        <div className="h-64 w-44 shrink-0 overflow-hidden rounded-lg border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] sm:h-72 sm:w-48">
          <RemoteCover
            path={details.coverUrl}
            placeholder={details.title}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 w-full flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--fy-text)]">
            {details.title}
          </h1>

          {details.alternateTitles[0] ? (
            <p className="mt-1 text-sm text-[var(--fy-text-muted)]">{details.alternateTitles[0]}</p>
          ) : null}

          <p className="mt-3 text-sm capitalize text-[var(--fy-text-muted)]">
            {metaBits.join(' · ')}
          </p>

          {details.genres.length > 0 ? (
            <p className="mt-3 text-sm text-[var(--fy-text-muted)]">
              {details.genres.slice(0, 8).join(' · ')}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              disabled={!startChapter}
              onClick={() => startChapter && openChapter(startChapter)}
            >
              {hasProgress ? 'Continue reading' : 'Start reading'}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={openLibraryCategorySheet}
            >
              {libraryRef?.inLibrary ? 'Library category' : 'Add to library'}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setStatsOpen(true)}>
              <BarChart3 size={14} /> Statistics
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                navigate(`/suggestions?q=${encodeURIComponent(suggestionsQuery)}`)
              }
            >
              <Wand2 size={14} /> Find similar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!libraryRef?.inLibrary || !libraryRef.titleId}
              onClick={() => {
                if (libraryRef?.titleId) {
                  navigate(`/title/${libraryRef.titleId}`)
                }
              }}
              title={
                libraryRef?.inLibrary
                  ? 'Edit title and cover in your library copy'
                  : 'Add to library to edit title and cover'
              }
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                navigate(`/suggestions?q=${encodeURIComponent(suggestionsQuery)}`)
              }
            >
              <Sparkles size={14} /> Suggestions
            </Button>
          </div>

          <TitleSocialControls
            className="mt-4"
            title={remoteSocialInput({
              providerId: details.providerId,
              providerTitleId: details.id,
              primaryTitle: details.title,
              coverPath: details.coverUrl,
              author: details.author,
              contentType: details.contentType,
            })}
          />

        </div>
      </section>

      <section className="mb-10 max-w-3xl">
        <h2 className="mb-2 text-sm font-medium tracking-wide text-[var(--fy-text-muted)]">
          Synopsis
        </h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--fy-text)]">
          {synopsisText ? synopsisShown : 'No description from this source.'}
        </p>
        {synopsisNeedsToggle ? (
          <button
            type="button"
            className="mt-2 text-sm text-[var(--fy-text-muted)] underline-offset-4 hover:text-[var(--fy-text)] hover:underline"
            onClick={() => setSynopsisOpen((open) => !open)}
          >
            {synopsisOpen ? 'Show less' : 'Show more'}
          </button>
        ) : null}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fy-border-subtle)] pb-3">
          <h2 className="text-sm font-medium tracking-wide text-[var(--fy-text-muted)]">
            Chapters
            <span className="ml-2 font-normal text-[var(--fy-text-muted)]">
              {filteredChapters.length}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <input
              value={chapterQuery}
              onChange={(e) => {
                setChapterQuery(e.target.value)
                setVisibleCount(PAGE_SIZE)
              }}
              placeholder="Filter…"
              className="w-36 rounded-md border border-[var(--fy-border-subtle)] bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-[var(--fy-border)]"
            />
            <select
              value={chapterSort}
              onChange={(e) => setChapterSort(e.target.value as 'asc' | 'desc')}
              className="rounded-md border border-[var(--fy-border-subtle)] bg-transparent px-2 py-1.5 text-sm"
              aria-label="Chapter sort order"
            >
              <option value="desc">Newest</option>
              <option value="asc">Oldest</option>
            </select>
          </div>
        </div>

        {filteredChapters.length === 0 ? (
          <EmptyState
            title="No chapters"
            description={
              chapterQuery
                ? 'No chapters match your filter.'
                : 'No readable chapters were returned for this title.'
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-[color-mix(in_srgb,var(--fy-text-muted)_28%,transparent)]">
              {visibleChapters.map((chapter) => {
                const isCurrent = chapter.id === progress?.chapterId
                const isRead = readChapterIds.has(chapter.id)
                return (
                  <li key={chapter.id} className="flex items-center gap-1 py-1.5">
                    <button
                      type="button"
                      className={cn(
                        'flex min-w-0 flex-1 items-baseline justify-between gap-3 py-1.5 text-left transition',
                        isRead
                          ? 'text-[var(--fy-text-muted)] hover:text-[var(--fy-text)]'
                          : 'text-[var(--fy-text)] hover:opacity-80',
                      )}
                      onClick={() => openChapter(chapter)}
                    >
                      <span className="flex min-w-0 items-center gap-2 truncate text-sm">
                        <span className="truncate">{chapter.title}</span>
                        {isCurrent ? (
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
                            Current
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-[var(--fy-text-muted)]">
                        {chapter.scanlator ? `${chapter.scanlator} · ` : ''}
                        {chapter.pageCount}p
                      </span>
                    </button>
                    {canDownloadOffline ? (
                      offlineByRemoteId[chapter.id] ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy || deletingId === chapter.id || Boolean(deletingId)}
                          onClick={() => void deleteOfflineChapter(chapter)}
                        >
                          {deletingId === chapter.id ? 'Deleting…' : 'Delete'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy || downloadingId === chapter.id}
                          onClick={() => void downloadChapter(chapter)}
                        >
                          {downloadingId === chapter.id ? 'Saving…' : 'Download'}
                        </Button>
                      )
                    ) : null}
                    <ChapterReadControls
                      isRead={isRead}
                      onToggleRead={() => {
                        const next = isRead
                          ? markChapterUnread(providerId, titleId, chapter.id)
                          : markChapterRead(providerId, titleId, chapter.id)
                        setProgress(next)
                      }}
                      onMarkPrevious={() => {
                        const next = markPreviousRead(providerId, titleId, chapter.id, chapters)
                        setProgress(next)
                      }}
                    />
                  </li>
                )
              })}
            </ul>
            {visibleCount < filteredChapters.length ? (
              <div className="mt-4">
                <button
                  type="button"
                  className="text-sm text-[var(--fy-text-muted)] underline-offset-4 hover:text-[var(--fy-text)] hover:underline"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                >
                  Show more ({filteredChapters.length - visibleCount})
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <Sheet open={statsOpen} onOpenChange={setStatsOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl sm:mx-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Statistics</SheetTitle>
            <SheetDescription>Local reading progress for this remote title.</SheetDescription>
          </SheetHeader>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="fy-liquid-tile rounded-md p-3">
              <dt className="text-xs text-[var(--fy-text-muted)]">Chapters</dt>
              <dd className="mt-1 font-display text-2xl">{chapters.length}</dd>
            </div>
            <div className="fy-liquid-tile rounded-md p-3">
              <dt className="text-xs text-[var(--fy-text-muted)]">Read</dt>
              <dd className="mt-1 font-display text-2xl">{readCount}</dd>
            </div>
            <div className="fy-liquid-tile rounded-md p-3">
              <dt className="text-xs text-[var(--fy-text-muted)]">Progress</dt>
              <dd className="mt-1 font-display text-2xl">{statsPercent}%</dd>
            </div>
            <div className="fy-liquid-tile rounded-md p-3">
              <dt className="text-xs text-[var(--fy-text-muted)]">Current</dt>
              <dd className="mt-1 truncate text-sm font-medium">
                {continueChapter?.title ?? '—'}
              </dd>
            </div>
          </dl>
        </SheetContent>
      </Sheet>

      <Sheet open={categoryOpen} onOpenChange={setCategoryOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl sm:mx-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {libraryRef?.inLibrary ? 'Library category' : 'Add to library'}
            </SheetTitle>
            <SheetDescription>
              Choose where this title belongs — Reading, Finished, Dropped, or a custom category.
            </SheetDescription>
          </SheetHeader>
          <ul className="mt-4 space-y-1">
            {categories.map((cat) => {
              const selected = activeCategoryId === cat.id && Boolean(libraryRef?.inLibrary)
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void addOrMoveToCategory(cat.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition',
                      selected
                        ? 'bg-[var(--fy-nav-active)] font-medium'
                        : 'hover:bg-[var(--fy-nav-hover)]',
                    )}
                  >
                    <span>{cat.name}</span>
                    {selected ? (
                      <span className="font-mono text-[10px] uppercase text-[var(--fy-text-muted)]">
                        Current
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
          {libraryRef?.inLibrary ? (
            <div className="mt-4 border-t border-[var(--fy-border-subtle)] pt-3">
              <Button
                variant="danger"
                className="w-full"
                disabled={busy}
                onClick={() => void removeFromLibrary()}
              >
                Remove from library
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
