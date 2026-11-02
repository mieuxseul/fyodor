import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { RemoteCover } from '@/components/RemoteCover'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { api, isTauri } from '@/lib/api'
import type { TitleDetails } from '@/lib/types'

export function TitleDetailsPage() {
  const { titleId = '' } = useParams()
  const navigate = useNavigate()
  const [details, setDetails] = useState<TitleDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [status, setStatus] = useState('planned')
  const [direction, setDirection] = useState('ltr')
  const [mode, setMode] = useState('page')
  const [notice, setNotice] = useState<string | null>(null)
  const [relinking, setRelinking] = useState(false)

  useEffect(() => {
    if (!titleId || !isTauri()) return
    let cancelled = false
    void (async () => {
      try {
        let data = await api.getTitleDetails(titleId)
        if (cancelled) return
        const cover = data.title.coverPath
        const needsCoverSync =
          !cover ||
          cover.startsWith('http://') ||
          cover.startsWith('https://')
        if (
          needsCoverSync &&
          data.editions.some((edition) => edition.sourceKind === 'remote')
        ) {
          const synced = await api.syncTitleCover(titleId)
          if (cancelled) return
          if (synced) {
            data = await api.getTitleDetails(titleId)
            if (cancelled) return
          }
        }
        setDetails(data)
        setEditTitle(data.title.primaryTitle)
        setEditAuthor(data.title.author ?? '')
        setEditDescription(data.title.description ?? '')
        setStatus(data.entry?.status ?? 'planned')
        const edition = data.editions[0]
        if (edition) {
          setDirection(edition.readingDirection)
          setMode(edition.readingMode)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [titleId])

  async function saveMetadata() {
    if (!details) return
    setSaving(true)
    try {
      await api.updateTitle({
        id: details.title.id,
        primaryTitle: editTitle,
        author: editAuthor,
        description: editDescription,
        status,
        readingDirection: direction,
        readingMode: mode,
      })
      const refreshed = await api.getTitleDetails(details.title.id)
      setDetails(refreshed)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function removeTitle() {
    if (!details) return
    const confirmed = window.confirm(
      'Remove this title from your library? Original source files on disk will not be deleted. Only Fyodor metadata and cached extracts will be removed.',
    )
    if (!confirmed) return
    await api.removeFromLibrary(details.title.id)
    navigate('/library')
  }

  function openReader(chapterId?: string) {
    const editionId = details?.entry?.preferredEditionId ?? details?.editions[0]?.id
    if (!editionId) return
    const params = chapterId ? `?chapter=${chapterId}` : ''
    navigate(`/reader/${editionId}${params}`)
  }

  async function bookmarkTitle() {
    if (!details) return
    try {
      await api.createBookmark({
        titleId: details.title.id,
        editionId: details.entry?.preferredEditionId ?? details.editions[0]?.id,
      })
      setNotice('Title bookmarked.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function relink(fileId: string) {
    setRelinking(true)
    setNotice(null)
    try {
      await api.relinkLocalFile(fileId)
      const refreshed = await api.getTitleDetails(titleId)
      setDetails(refreshed)
      setNotice('Local file relinked successfully.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.toLowerCase().includes('cancelled')) {
        setError(message)
      }
    } finally {
      setRelinking(false)
    }
  }

  if (!isTauri()) {
    return (
      <EmptyState
        title="Desktop runtime required"
        description="Title details are loaded from the local SQLite library."
      />
    )
  }

  if (error) {
    return <EmptyState title="Unable to open title" description={error} />
  }

  if (!details) {
    return <p className="text-sm text-[var(--fy-text-muted)]">Loading title…</p>
  }

  const nextChapter =
    details.chapters.find((c) => c.id === details.progress?.chapterId) ?? details.chapters[0]

  return (
    <div>
      <PageHeader
        title={details.title.primaryTitle}
        subtitle={details.title.author ?? 'Local edition'}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/library')}>
              Back
            </Button>
            <Button variant="secondary" onClick={() => void bookmarkTitle()}>
              Bookmark
            </Button>
            <Button variant="primary" onClick={() => openReader(nextChapter?.id)}>
              {details.progress ? 'Continue reading' : 'Start reading'}
            </Button>
          </>
        }
      />

      {notice ? (
        <p className="mb-4 rounded-lg border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <div>
          <div className="aspect-[2/3] overflow-hidden rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)]">
            <RemoteCover
              path={details.title.coverPath}
              placeholder={details.title.primaryTitle}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="mt-3 space-y-1 font-mono text-[11px] text-[var(--fy-text-muted)]">
            <div>Status: {details.entry?.status ?? '—'}</div>
            <div>Chapters: {details.chapters.length}</div>
            <div>Local files: {details.localFiles.length}</div>
          </div>
        </div>

        <div className="space-y-8">
          <section className="space-y-3 rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-panel)] p-4">
            <h2 className="text-xl font-semibold tracking-tight">Metadata</h2>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--fy-text-muted)]">Title</span>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--fy-text-muted)]">Author</span>
              <input
                value={editAuthor}
                onChange={(e) => setEditAuthor(e.target.value)}
                className="w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--fy-text-muted)]">Description</span>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                className="w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--fy-text-muted)]">Library status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2"
                >
                  <option value="reading">Reading</option>
                  <option value="completed">Completed</option>
                  <option value="planned">Planned</option>
                  <option value="on_hold">On hold</option>
                  <option value="dropped">Dropped</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--fy-text-muted)]">Direction</span>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                  className="w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2"
                >
                  <option value="ltr">Left to right</option>
                  <option value="rtl">Right to left</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--fy-text-muted)]">Default mode</span>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2"
                >
                  <option value="page">Page-based</option>
                  <option value="vertical">Vertical</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="primary" disabled={saving} onClick={() => void saveMetadata()}>
                Save changes
              </Button>
              <Button variant="danger" onClick={() => void removeTitle()}>
                Remove from library
              </Button>
            </div>
            <p className="text-xs text-[var(--fy-text-muted)]">
              Removing a title deletes library metadata only. Your original CBZ/ZIP/folder remains untouched.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight">Chapters</h2>
            <div className="fy-divider my-3" />
            {details.chapters.length === 0 ? (
              <p className="text-sm text-[var(--fy-text-muted)]">No chapters available.</p>
            ) : (
              <ul className="divide-y divide-[var(--fy-border-subtle)] rounded-sm border border-[var(--fy-border-subtle)]">
                {details.chapters.map((chapter) => (
                  <li key={chapter.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div>
                      <div className="text-sm">{chapter.title}</div>
                      <div className="font-mono text-[11px] text-[var(--fy-text-muted)]">
                        {chapter.pageCount} pages
                      </div>
                    </div>
                    <Button size="sm" onClick={() => openReader(chapter.id)}>
                      Read
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight">Editions</h2>
            <div className="fy-divider my-3" />
            <ul className="space-y-2">
              {details.editions.map((edition) => (
                <li
                  key={edition.id}
                  className="rounded-lg border border-[var(--fy-border-subtle)] px-3 py-2 text-sm"
                >
                  <div>{edition.label}</div>
                  <div className="font-mono text-[11px] text-[var(--fy-text-muted)]">
                    {edition.sourceKind} · {edition.readingDirection} · {edition.readingMode}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight">Local files</h2>
            <div className="fy-divider my-3" />
            {details.localFiles.length === 0 ? (
              <p className="text-sm text-[var(--fy-text-muted)]">No local files linked.</p>
            ) : (
              <ul className="space-y-2">
                {details.localFiles.map((file) => (
                  <li
                    key={file.id}
                    className="rounded-lg border border-[var(--fy-border-subtle)] px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-[var(--fy-text-muted)]">
                          {file.kind} · {file.pagePaths.length} cached pages
                        </div>
                        <div className="truncate text-xs text-[var(--fy-text-muted)]">
                          {file.sourcePath}
                        </div>
                        <div
                          className={
                            file.existsOnDisk
                              ? 'mt-1 font-mono text-[11px] text-[var(--fy-text-muted)]'
                              : 'mt-1 font-mono text-[11px] text-[var(--fy-danger)]'
                          }
                        >
                          {file.existsOnDisk ? 'Available on disk' : 'Missing or moved'}
                        </div>
                      </div>
                      {!file.existsOnDisk ? (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={relinking}
                          onClick={() => void relink(file.id)}
                        >
                          Relink
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-[var(--fy-text-muted)]">
              App data locations are listed in{' '}
              <Link className="underline" to="/settings">
                Settings
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
