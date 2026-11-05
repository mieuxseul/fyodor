import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { open } from '@tauri-apps/plugin-dialog'
import {
  BarChart3,
  ChevronLeft,
  ImagePlus,
  Pencil,
  Sparkles,
  Wand2,
} from 'lucide-react'

import { ChapterReadControls } from '@/components/ChapterReadControls'
import { PageHeader } from '@/components/layout/PageHeader'
import { RemoteCover } from '@/components/RemoteCover'
import { TitleSocialControls } from '@/components/social/TitleSocialControls'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toaster'
import { api, isTauri } from '@/lib/api'
import { cn } from '@/lib/cn'
import {
  createCategory,
  getTitleCategoryId,
  listCategories,
  setTitleCategory,
  subscribeLibraryCategories,
  type LibraryCategory,
} from '@/lib/library-categories'
import {
  loadLocalReadChapters,
  markLocalChapterRead,
  markLocalChapterUnread,
  markLocalPreviousRead,
} from '@/lib/local-read-chapters'
import { isIncognitoSession } from '@/lib/incognito'
import { LIBRARY_OPENED_EVENT } from '@/lib/library-display'
import { localSocialInput } from '@/lib/social-title'
import type { TitleDetails } from '@/lib/types'

export function TitleDetailsPage() {
  const { titleId = '' } = useParams()
  const navigate = useNavigate()
  const [details, setDetails] = useState<TitleDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [direction, setDirection] = useState('ltr')
  const [mode, setMode] = useState('page')
  const [notice, setNotice] = useState<string | null>(null)
  const [relinking, setRelinking] = useState(false)
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null)
  const [readChapterIds, setReadChapterIds] = useState<Set<string>>(() => new Set())
  const [categories, setCategories] = useState<LibraryCategory[]>(() => listCategories())
  const [categoryId, setCategoryId] = useState('reading')
  const [newCategoryName, setNewCategoryName] = useState('')

  useEffect(() => subscribeLibraryCategories(() => setCategories(listCategories())), [])

  useEffect(() => {
    if (!titleId || !isTauri()) return
    let cancelled = false
    void (async () => {
      try {
        let data = await api.getTitleDetails(titleId)
        if (cancelled) return
        const cover = data.title.coverPath
        const needsCoverSync =
          !cover || cover.startsWith('http://') || cover.startsWith('https://')
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
        setCategoryId(getTitleCategoryId(data.title.id, data.entry?.status))
        const edition = data.editions[0]
        if (edition) {
          setDirection(edition.readingDirection)
          setMode(edition.readingMode)
        }
        const editionId = data.entry?.preferredEditionId ?? data.editions[0]?.id
        if (editionId) {
          setReadChapterIds(new Set(loadLocalReadChapters(editionId).readChapterIds))
        } else {
          setReadChapterIds(new Set())
        }
        if (data.entry && !isIncognitoSession()) {
          void api.markTitleOpened(data.title.id).then(() => {
            window.dispatchEvent(new Event(LIBRARY_OPENED_EVENT))
          })
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [titleId])

  useEffect(() => {
    const editionId = details?.entry?.preferredEditionId ?? details?.editions[0]?.id
    if (!editionId) return
    const refresh = () => {
      setReadChapterIds(new Set(loadLocalReadChapters(editionId).readChapterIds))
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [details?.entry?.preferredEditionId, details?.editions])

  const stats = useMemo(() => {
    if (!details) {
      return { chapters: 0, read: 0, pages: 0, percent: 0, current: '—' }
    }
    const chapters = details.chapters.length
    const read = details.chapters.filter(
      (c) =>
        readChapterIds.has(c.id) ||
        (c.id === details.progress?.chapterId && details.progress?.completed),
    ).length
    const pages = details.chapters.reduce((sum, c) => sum + (c.pageCount || 0), 0)
    const percent =
      typeof details.progress?.completed === 'boolean' && details.progress.completed
        ? 100
        : chapters > 0
          ? Math.round((read / chapters) * 100)
          : 0
    const current =
      details.chapters.find((c) => c.id === details.progress?.chapterId)?.title ??
      details.chapters[0]?.title ??
      '—'
    return { chapters, read, pages, percent, current }
  }, [details, readChapterIds])

  async function saveMetadata() {
    if (!details) return
    setSaving(true)
    try {
      const category = setTitleCategory(details.title.id, categoryId)
      await api.updateTitle({
        id: details.title.id,
        primaryTitle: editTitle,
        author: editAuthor,
        description: editDescription,
        status: category?.status ?? details.entry?.status ?? 'reading',
        readingDirection: direction,
        readingMode: mode,
      })
      const refreshed = await api.getTitleDetails(details.title.id)
      setDetails(refreshed)
      setNotice('Title updated.')
      setEditOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function changeCover() {
    if (!details || !isTauri()) return
    try {
      const selected = await open({
        title: 'Choose cover image',
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'] }],
      })
      if (!selected || Array.isArray(selected)) return
      await api.setTitleCoverFromPath(details.title.id, selected)
      const refreshed = await api.getTitleDetails(details.title.id)
      setDetails(refreshed)
      setNotice('Cover updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function assignCategory(nextId: string) {
    if (!details) return
    setCategoryId(nextId)
    const category = setTitleCategory(details.title.id, nextId)
    if (category?.status && isTauri()) {
      try {
        await api.updateTitle({ id: details.title.id, status: category.status })
        const refreshed = await api.getTitleDetails(details.title.id)
        setDetails(refreshed)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  function addCategory() {
    try {
      const created = createCategory(newCategoryName)
      setCategories(listCategories())
      setNewCategoryName('')
      void assignCategory(created.id)
      setNotice(`Category “${created.name}” created.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function removeTitle() {
    if (!details) return
    const confirmed = window.confirm(
      'Remove this title from your library? Original source files on disk will not be deleted.',
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

  async function deleteOfflineChapter(chapterId: string, chapterTitle: string) {
    if (!isTauri() || deletingChapterId) return
    if (
      !window.confirm(
        `Delete “${chapterTitle}” from this device? Offline pages will be removed. You can download it again later.`,
      )
    ) {
      return
    }
    setDeletingChapterId(chapterId)
    setError(null)
    try {
      const jobs = await api.listDownloads(500)
      const job = jobs.find((row) => row.chapterId === chapterId)
      if (!job) {
        throw new Error('No offline download found for this chapter.')
      }
      await api.deleteDownload(job.id)
      const refreshed = await api.getTitleDetails(titleId)
      setDetails(refreshed)
      toast.success('Download deleted', { description: chapterTitle })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.error('Couldn’t delete download', { description: message })
    } finally {
      setDeletingChapterId(null)
    }
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
    try {
      await api.relinkLocalFile(fileId)
      const refreshed = await api.getTitleDetails(titleId)
      setDetails(refreshed)
      setNotice('Local file relinked successfully.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.toLowerCase().includes('cancelled')) setError(message)
    } finally {
      setRelinking(false)
    }
  }

  function suggestionsQuery(): string {
    if (!details) return ''
    const genre = details.title.genres[0]
    return genre ? `${details.title.primaryTitle} ${genre}` : details.title.primaryTitle
  }

  if (!isTauri()) {
    return (
      <EmptyState
        title="Desktop runtime required"
        description="Title details are loaded from the local SQLite library."
      />
    )
  }

  if (error && !details) {
    return <EmptyState title="Unable to open title" description={error} />
  }

  if (!details) {
    return <p className="text-sm text-[var(--fy-text-muted)]">Loading title…</p>
  }

  const nextChapter =
    details.chapters.find((c) => c.id === details.progress?.chapterId) ?? details.chapters[0]
  const editionId = details.entry?.preferredEditionId ?? details.editions[0]?.id

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/library')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--fy-text-muted)] transition hover:text-[var(--fy-text)]"
      >
        <ChevronLeft size={16} />
        Library
      </button>

      <PageHeader
        title={details.title.primaryTitle}
        subtitle={details.title.author ?? 'Local edition'}
        actions={
          <>
            <Button variant="secondary" onClick={() => void bookmarkTitle()}>
              Bookmark
            </Button>
            <Button variant="primary" onClick={() => openReader(nextChapter?.id)}>
              {details.progress ? 'Continue reading' : 'Start reading'}
            </Button>
          </>
        }
      />

      {notice ? <p className="mb-4 fy-liquid-tile px-3 py-2 text-sm">{notice}</p> : null}
      {error ? <p className="mb-4 text-sm text-[var(--fy-danger)]">{error}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setStatsOpen(true)}>
          <BarChart3 size={14} /> Statistics
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            navigate(`/suggestions?q=${encodeURIComponent(suggestionsQuery())}`)
          }
        >
          <Wand2 size={14} /> Find similar
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
          <Pencil size={14} /> Edit
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() =>
            navigate(`/suggestions?q=${encodeURIComponent(suggestionsQuery())}`)
          }
        >
          <Sparkles size={14} /> Suggestions
        </Button>
      </div>

      <TitleSocialControls
        className="mb-6"
        title={localSocialInput({
          titleId: details.title.id,
          primaryTitle: details.title.primaryTitle,
          coverPath: details.title.coverPath,
          author: details.title.author,
          contentType: details.title.contentType,
        })}
      />

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <div>
          <div className="aspect-[2/3] overflow-hidden fy-liquid-tile">
            <RemoteCover
              path={details.title.coverPath}
              placeholder={details.title.primaryTitle}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="mt-3 space-y-1 font-mono text-[11px] text-[var(--fy-text-muted)]">
            <div>
              Category:{' '}
              {categories.find((c) => c.id === categoryId)?.name ?? details.entry?.status ?? '—'}
            </div>
            <div>Chapters: {details.chapters.length}</div>
            <div>Progress: {stats.percent}%</div>
          </div>
        </div>

        <div className="space-y-8">
          <section className="space-y-3 fy-liquid-tile p-4">
            <h2 className="text-xl font-semibold tracking-tight">Category</h2>
            <Select
              value={categoryId}
              onChange={(value) => void assignCategory(value)}
              className="w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2 text-sm"
              options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
            />
            <div className="flex flex-wrap gap-2">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name"
                className="min-w-[12rem] flex-1 rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2 text-sm"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!newCategoryName.trim()}
                onClick={addCategory}
              >
                Create category
              </Button>
            </div>
          </section>

          {details.title.description ? (
            <section>
              <h2 className="text-xl font-semibold tracking-tight">Synopsis</h2>
              <div className="fy-divider my-3" />
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--fy-text-muted)]">
                {details.title.description}
              </p>
            </section>
          ) : null}

          <section>
            <h2 className="text-xl font-semibold tracking-tight">Chapters</h2>
            <div className="fy-divider my-3" />
            {details.chapters.length === 0 ? (
              <p className="text-sm text-[var(--fy-text-muted)]">No chapters available.</p>
            ) : (
              <ul className="divide-y divide-[color-mix(in_srgb,var(--fy-text-muted)_28%,transparent)] rounded-sm border border-[color-mix(in_srgb,var(--fy-text-muted)_22%,transparent)]">
                {details.chapters.map((chapter) => {
                  const isCurrent = chapter.id === details.progress?.chapterId
                  const isRead =
                    readChapterIds.has(chapter.id) ||
                    (isCurrent && Boolean(details.progress?.completed))
                  const isOfflineDownload = details.localFiles.some(
                    (file) => file.chapterId === chapter.id && file.kind === 'download',
                  )
                  const deleting = deletingChapterId === chapter.id
                  return (
                    <li
                      key={chapter.id}
                      className="flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className={cn('min-w-0 flex-1', isRead && 'text-[var(--fy-text-muted)]')}>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="truncate">{chapter.title}</span>
                          {isCurrent ? (
                            <span className="text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
                              Current
                            </span>
                          ) : null}
                          {isOfflineDownload ? (
                            <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
                              Offline
                            </span>
                          ) : null}
                        </div>
                        <div className="font-mono text-[11px] text-[var(--fy-text-muted)]">
                          {chapter.pageCount} pages
                        </div>
                      </div>
                      {editionId ? (
                        <ChapterReadControls
                          isRead={isRead}
                          onToggleRead={() => {
                            const next = isRead
                              ? markLocalChapterUnread(editionId, chapter.id)
                              : markLocalChapterRead(editionId, chapter.id)
                            setReadChapterIds(new Set(next.readChapterIds))
                          }}
                          onMarkPrevious={() => {
                            const next = markLocalPreviousRead(
                              editionId,
                              chapter.id,
                              details.chapters,
                            )
                            setReadChapterIds(new Set(next.readChapterIds))
                          }}
                        />
                      ) : null}
                      {isOfflineDownload ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deleting || Boolean(deletingChapterId)}
                          onClick={() => void deleteOfflineChapter(chapter.id, chapter.title)}
                        >
                          {deleting ? 'Deleting…' : 'Delete'}
                        </Button>
                      ) : null}
                      <Button size="sm" onClick={() => openReader(chapter.id)}>
                        {isCurrent ? 'Continue' : isRead ? 'Re-read' : 'Read'}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
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
          </section>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit title</DialogTitle>
            <DialogDescription>Update metadata and cover art for this book.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm">
              Title
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1 w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Author
              <input
                value={editAuthor}
                onChange={(e) => setEditAuthor(e.target.value)}
                className="mt-1 w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Description
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                Direction
                <Select
                  value={direction}
                  onChange={setDirection}
                  className="mt-1 w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-2 py-2"
                  options={[
                    { value: 'ltr', label: 'LTR' },
                    { value: 'rtl', label: 'RTL' },
                  ]}
                />
              </label>
              <label className="block text-sm">
                Mode
                <Select
                  value={mode}
                  onChange={setMode}
                  className="mt-1 w-full rounded-sm border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-2 py-2"
                  options={[
                    { value: 'page', label: 'Single' },
                    { value: 'double', label: 'Double' },
                    { value: 'vertical', label: 'Webtoon' },
                  ]}
                />
              </label>
            </div>
            <Button variant="secondary" onClick={() => void changeCover()}>
              <ImagePlus size={14} /> Change cover
            </Button>
            <DialogFooter className="pt-1">
              <Button variant="primary" disabled={saving} onClick={() => void saveMetadata()}>
                Save
              </Button>
              <Button variant="danger" onClick={() => void removeTitle()}>
                Remove from library
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={statsOpen} onOpenChange={setStatsOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl sm:mx-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Statistics</SheetTitle>
            <SheetDescription>Local reading progress for this title.</SheetDescription>
          </SheetHeader>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="fy-liquid-tile rounded-md p-3">
              <dt className="text-xs text-[var(--fy-text-muted)]">Chapters</dt>
              <dd className="mt-1 font-display text-2xl">{stats.chapters}</dd>
            </div>
            <div className="fy-liquid-tile rounded-md p-3">
              <dt className="text-xs text-[var(--fy-text-muted)]">Read</dt>
              <dd className="mt-1 font-display text-2xl">{stats.read}</dd>
            </div>
            <div className="fy-liquid-tile rounded-md p-3">
              <dt className="text-xs text-[var(--fy-text-muted)]">Pages</dt>
              <dd className="mt-1 font-display text-2xl">{stats.pages}</dd>
            </div>
            <div className="fy-liquid-tile rounded-md p-3">
              <dt className="text-xs text-[var(--fy-text-muted)]">Progress</dt>
              <dd className="mt-1 font-display text-2xl">{stats.percent}%</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-[var(--fy-text-muted)]">
            Current chapter: {stats.current}
          </p>
        </SheetContent>
      </Sheet>
    </div>
  )
}
