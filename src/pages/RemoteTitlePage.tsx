import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { RemoteCover } from '@/components/RemoteCover'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  api,
  isTauri,
  type RemoteChapter,
  type RemoteLibraryRef,
  type RemoteTitleDetails,
} from '@/lib/api'

const PAGE_SIZE = 40
const SUPPORTED = new Set(['atsu', 'mangadex'])

export function RemoteTitlePage() {
  const { providerId = '', titleId = '' } = useParams()
  const navigate = useNavigate()
  const [details, setDetails] = useState<RemoteTitleDetails | null>(null)
  const [chapters, setChapters] = useState<RemoteChapter[]>([])
  const [libraryRef, setLibraryRef] = useState<RemoteLibraryRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [chapterQuery, setChapterQuery] = useState('')
  const [chapterSort, setChapterSort] = useState<'asc' | 'desc'>('asc')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    if (!SUPPORTED.has(providerId) || !titleId || !isTauri()) {
      setLoading(false)
      setError(
        !SUPPORTED.has(providerId)
          ? 'This provider has no in-app details page yet.'
          : 'Remote titles require the FYODOR desktop runtime.',
      )
      return
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [detail, chapterList, remoteRef] = await Promise.all([
          providerId === 'atsu'
            ? api.atsuTitleDetails(titleId)
            : api.mangadexTitleDetails(titleId),
          providerId === 'atsu'
            ? api.atsuChapters(titleId)
            : api.mangadexChapters(titleId),
          api.getRemoteLibraryRef(providerId, titleId),
        ])
        if (cancelled) return
        setDetails(detail)
        setChapters(chapterList)
        setLibraryRef(remoteRef)
        setVisibleCount(PAGE_SIZE)
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
  const latestChapter =
    filteredChapters.length > 0
      ? [...filteredChapters].sort((a, b) => (b.number ?? 0) - (a.number ?? 0))[0]
      : null

  function openChapter(chapter: RemoteChapter) {
    navigate(`/reader/${providerId}:${titleId}?chapter=${encodeURIComponent(chapter.id)}`)
  }

  async function toggleLibrary() {
    if (!details || !isTauri()) return
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      if (libraryRef?.inLibrary && libraryRef.titleId) {
        await api.removeFromLibrary(libraryRef.titleId)
        setLibraryRef({
          titleId: '',
          editionId: '',
          providerId,
          providerTitleId: titleId,
          inLibrary: false,
        })
        setNotice('Removed from library.')
      } else {
        const ref = await api.addRemoteToLibrary({
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
        setNotice('Added to library.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-[var(--fy-bg)]" />
        <div className="flex gap-4">
          <div className="h-56 w-40 animate-pulse rounded-lg bg-[var(--fy-bg)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--fy-bg)]" />
            <div className="h-4 w-full animate-pulse rounded bg-[var(--fy-bg)]" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--fy-bg)]" />
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

  const startChapter =
    (chapterSort === 'asc' ? filteredChapters[0] : latestChapter) ?? chapters[0] ?? null

  return (
    <div>
      <PageHeader
        title={details.title}
        subtitle={`${details.providerName} · ${details.contentType}${
          details.publicationStatus ? ` · ${details.publicationStatus}` : ''
        }`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate('/discover')}>
              Back to Discover
            </Button>
            <Button variant="ghost" onClick={() => void api.openExternalUrl(details.websiteUrl)}>
              Open source
            </Button>
          </div>
        }
      />

      {error ? <p className="mb-3 text-sm text-[var(--fy-danger)]">{error}</p> : null}
      {notice ? <p className="mb-3 text-sm text-[var(--fy-text-muted)]">{notice}</p> : null}

      <section className="mb-8 flex w-full flex-col gap-5 sm:flex-row sm:items-start">
        <div className="h-64 w-44 shrink-0 overflow-hidden rounded-lg border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] sm:h-72 sm:w-48">
          <RemoteCover
            path={details.coverUrl}
            placeholder={details.title}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 w-full flex-1 space-y-3">
          {details.alternateTitles.length > 0 ? (
            <p className="text-sm text-[var(--fy-text-muted)]">
              Also known as: {details.alternateTitles.slice(0, 4).join(' · ')}
            </p>
          ) : null}

          <dl className="grid w-full grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {details.author ? (
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
                  Author
                </dt>
                <dd>{details.author}</dd>
              </div>
            ) : null}
            {details.artist ? (
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
                  Artist
                </dt>
                <dd>{details.artist}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
                Type
              </dt>
              <dd className="capitalize">{details.contentType}</dd>
            </div>
            {details.publicationStatus ? (
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
                  Status
                </dt>
                <dd className="capitalize">{details.publicationStatus.replace(/_/g, ' ')}</dd>
              </div>
            ) : null}
            {details.releaseYear != null ? (
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
                  Release year
                </dt>
                <dd>{details.releaseYear}</dd>
              </div>
            ) : null}
            {details.rating != null ? (
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
                  Rating
                </dt>
                <dd>{details.rating.toFixed(2)}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
                Source
              </dt>
              <dd>{details.providerName}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
                Chapters
              </dt>
              <dd>
                {chapters.length}
                {details.latestChapterTitle ? ` · Latest: ${details.latestChapterTitle}` : ''}
              </dd>
            </div>
          </dl>

          {details.genres.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {details.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-md border border-[var(--fy-border-subtle)] px-2 py-0.5 text-xs"
                >
                  {genre}
                </span>
              ))}
            </div>
          ) : null}

          {(details.tags ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {details.tags.slice(0, 16).map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-dashed border-[var(--fy-border-subtle)] px-2 py-0.5 text-[11px] text-[var(--fy-text-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="primary"
              disabled={!startChapter}
              onClick={() => startChapter && openChapter(startChapter)}
            >
              Start reading
            </Button>
            {latestChapter ? (
              <Button variant="secondary" onClick={() => openChapter(latestChapter)}>
                Latest chapter
              </Button>
            ) : null}
            <Button variant="secondary" disabled={busy} onClick={() => void toggleLibrary()}>
              {libraryRef?.inLibrary ? 'Remove from library' : 'Add to library'}
            </Button>
            <Button variant="ghost" disabled title="Downloads are not enabled for remote sources yet">
              Download
            </Button>
          </div>

        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-base font-semibold tracking-tight">Synopsis</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--fy-text-muted)]">
          {details.description?.trim() || 'No description available from this source.'}
        </p>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Chapters</h2>
          <div className="flex flex-wrap gap-2">
            <input
              value={chapterQuery}
              onChange={(e) => {
                setChapterQuery(e.target.value)
                setVisibleCount(PAGE_SIZE)
              }}
              placeholder="Search chapters…"
              className="min-w-[180px] rounded-lg border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--fy-border)]"
            />
            <select
              value={chapterSort}
              onChange={(e) => setChapterSort(e.target.value as 'asc' | 'desc')}
              className="rounded-lg border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] px-2.5 py-1.5 text-sm"
              aria-label="Chapter sort order"
            >
              <option value="asc">Oldest first</option>
              <option value="desc">Newest first</option>
            </select>
          </div>
        </div>

        {filteredChapters.length === 0 ? (
          <EmptyState
            title="No chapters"
            description={
              chapterQuery
                ? 'No chapters match your search.'
                : 'No readable chapters were returned for this title.'
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-[var(--fy-border-subtle)] rounded-xl border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)]">
              {visibleChapters.map((chapter) => (
                <li key={chapter.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-[var(--fy-nav-active)]"
                    onClick={() => openChapter(chapter)}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{chapter.title}</div>
                      <div className="font-mono text-[11px] text-[var(--fy-text-muted)]">
                        {chapter.scanlator ? `${chapter.scanlator} · ` : ''}
                        {chapter.pageCount} page{chapter.pageCount === 1 ? '' : 's'}
                        {chapter.createdAt
                          ? ` · ${new Date(chapter.createdAt).toLocaleDateString()}`
                          : ''}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-[var(--fy-text-muted)]">Read</span>
                  </button>
                </li>
              ))}
            </ul>
            {visibleCount < filteredChapters.length ? (
              <div className="mt-3 flex justify-center">
                <Button
                  variant="secondary"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                >
                  Show more ({filteredChapters.length - visibleCount} remaining)
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
