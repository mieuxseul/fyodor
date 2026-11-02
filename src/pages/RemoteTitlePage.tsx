import { ChevronLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

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
const SYNOPSIS_PREVIEW = 280
const SUPPORTED = new Set(['atsu', 'mangadex', 'kotatsu'])

function parseKotatsuTitleId(titleId: string): { source: string; url: string } | null {
  const idx = titleId.indexOf('::')
  if (idx <= 0) return null
  const source = titleId.slice(0, idx).trim()
  const url = titleId.slice(idx + 2).trim()
  return source && url ? { source, url } : null
}

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
        } else if (providerId === 'kotatsu') {
          const parsed = parseKotatsuTitleId(titleId)
          if (!parsed) throw new Error('Invalid Kotatsu title id.')
          const seedTitle = decodeURIComponent(titleId.split('::').slice(1).join('::'))
          const [detailPayload, chapterPayload, remoteRef] = await Promise.all([
            api.kotatsuTitleDetails({
              source: parsed.source,
              url: parsed.url,
              title: seedTitle || 'Untitled',
            }),
            api.kotatsuChapters({
              source: parsed.source,
              url: parsed.url,
              title: seedTitle || 'Untitled',
            }),
            remoteRefPromise,
          ])
          if (cancelled) return
          const d = detailPayload.details as {
            id?: string
            title?: string
            alternateTitles?: string[]
            description?: string | null
            coverUrl?: string | null
            authors?: string[]
            tags?: string[]
            state?: string | null
            publicUrl?: string
          }
          setDetails({
            id: titleId,
            title: d.title ?? 'Untitled',
            alternateTitles: d.alternateTitles ?? [],
            description: d.description ?? null,
            coverUrl: d.coverUrl ?? null,
            contentType: 'manga',
            publicationStatus: d.state ?? null,
            genres: d.tags ?? [],
            tags: d.tags ?? [],
            author: d.authors?.[0] ?? null,
            artist: null,
            websiteUrl: d.publicUrl || parsed.url,
            isAdult: false,
            chapterCount: chapterPayload.chapters?.length ?? 0,
            rating: null,
            releaseYear: null,
            latestChapterTitle: chapterPayload.chapters?.[0]?.title ?? null,
            providerId: 'kotatsu',
            providerName: `Kotatsu · ${parsed.source}`,
          })
          setChapters(
            (chapterPayload.chapters ?? []).map((chapter) => ({
              id: `${chapter.id}|||${chapter.url}`,
              mangaId: titleId,
              title: chapter.title,
              number: chapter.number ?? null,
              pageCount: 0,
              scanlator: chapter.scanlator ?? null,
              sortIndex: chapter.sortIndex,
            })),
          )
          setLibraryRef(remoteRef)
        } else {
          const [detail, chapterList, remoteRef] = await Promise.all([
            api.mangadexTitleDetails(titleId),
            api.mangadexChapters(titleId),
            remoteRefPromise,
          ])
          if (cancelled) return
          setDetails(detail)
          setChapters(chapterList)
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

  const startChapter = firstChapter ?? chapters[0] ?? null
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
        onClick={() => navigate('/discover')}
        className="mb-5 inline-flex items-center gap-1 text-sm text-[var(--fy-text-muted)] transition hover:text-[var(--fy-text)]"
      >
        <ChevronLeft size={16} />
        Discover
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
              Start reading
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void toggleLibrary()}
            >
              {libraryRef?.inLibrary ? 'In library — remove' : 'Add to library'}
            </Button>
          </div>
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
            <ul className="divide-y divide-[var(--fy-border-subtle)]">
              {visibleChapters.map((chapter) => (
                <li key={chapter.id}>
                  <button
                    type="button"
                    className="flex w-full items-baseline justify-between gap-4 py-3 text-left transition hover:text-[var(--fy-text)]"
                    onClick={() => openChapter(chapter)}
                  >
                    <span className="min-w-0 truncate text-sm">{chapter.title}</span>
                    <span className="shrink-0 font-mono text-[11px] text-[var(--fy-text-muted)]">
                      {chapter.scanlator ? `${chapter.scanlator} · ` : ''}
                      {chapter.pageCount}p
                    </span>
                  </button>
                </li>
              ))}
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
    </div>
  )
}
