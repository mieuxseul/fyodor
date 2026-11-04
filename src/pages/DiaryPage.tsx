import { ChevronLeft, Heart, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { RemoteCover } from '@/components/RemoteCover'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
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
import { formatHalfStars, localSocialInput, socialHref } from '@/lib/social-title'
import type { DiaryEntry, LibraryItem } from '@/lib/types'

function todayIsoDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DiaryPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<DiaryEntry | null>(null)
  const [pickOpen, setPickOpen] = useState(false)
  const [selected, setSelected] = useState<LibraryItem | null>(null)
  const [libraryQuery, setLibraryQuery] = useState('')
  const [libraryHits, setLibraryHits] = useState<LibraryItem[]>([])
  const [loggedOn, setLoggedOn] = useState(todayIsoDate)
  const [rating, setRating] = useState<number | null>(null)
  const [review, setReview] = useState('')
  const [liked, setLiked] = useState(false)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setEntries(await api.listDiary(200))
  }

  useEffect(() => {
    if (!isTauri()) {
      setError('Diary requires the Fyodor desktop runtime.')
      return
    }
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : String(err)),
    )
  }, [])

  useEffect(() => {
    if (!pickOpen || !isTauri()) return
    const q = libraryQuery.trim()
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const hits = q
            ? await api.searchLibrary(q)
            : (await api.listLibrary()).slice(0, 30)
          if (!cancelled) setLibraryHits(hits)
        } catch {
          if (!cancelled) setLibraryHits([])
        }
      })()
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [pickOpen, libraryQuery])

  function openCreate() {
    setSelected(null)
    setLoggedOn(todayIsoDate())
    setRating(null)
    setReview('')
    setLiked(false)
    setCreateOpen(true)
  }

  function openEdit(entry: DiaryEntry) {
    setEditEntry(entry)
    setLoggedOn(entry.loggedOn)
    setRating(entry.rating ?? null)
    setReview(entry.review ?? '')
    setLiked(entry.liked)
  }

  async function submitCreate() {
    if (!selected || !isTauri() || busy) return
    setBusy(true)
    try {
      await api.createDiaryEntry({
        title: localSocialInput({
          titleId: selected.title.id,
          primaryTitle: selected.title.primaryTitle,
          coverPath: selected.title.coverPath,
          author: selected.title.author,
          contentType: selected.title.contentType,
        }),
        loggedOn,
        rating,
        review: review.trim() || null,
        liked,
      })
      await refresh()
      setCreateOpen(false)
      toast.success('Diary entry saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function submitEdit() {
    if (!editEntry || !isTauri() || busy) return
    setBusy(true)
    try {
      await api.updateDiaryEntry({
        id: editEntry.id,
        loggedOn,
        rating: rating ?? undefined,
        clearRating: rating == null,
        review: review.trim(),
        liked,
      })
      await refresh()
      setEditEntry(null)
      toast.success('Entry updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function removeEntry(id: string) {
    if (!isTauri() || busy) return
    setBusy(true)
    try {
      await api.deleteDiaryEntry(id)
      await refresh()
      toast.success('Entry deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return <EmptyState title="Diary unavailable" description={error} />
  }

  return (
    <div>
      <Link
        to="/profile"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--fy-text-muted)] transition hover:text-[var(--fy-text)]"
      >
        <ChevronLeft size={16} />
        Profile
      </Link>

      <PageHeader
        title="Diary"
        subtitle="Letterboxd-style reading logs."
        actions={
          <Button variant="primary" onClick={openCreate}>
            <Plus size={14} /> New entry
          </Button>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          title="No diary entries"
          description="Log a title from its page, or create an entry from your library."
        />
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const href = socialHref(entry.title)
            return (
              <li key={entry.id} className="fy-liquid-tile flex gap-3 p-3">
                <div className="h-24 w-16 shrink-0 overflow-hidden rounded-sm bg-[var(--fy-bg)]">
                  {href ? (
                    <Link to={href}>
                      <RemoteCover
                        path={entry.title.coverPath}
                        placeholder={entry.title.primaryTitle}
                        className="h-full w-full object-cover"
                      />
                    </Link>
                  ) : (
                    <RemoteCover
                      path={entry.title.coverPath}
                      placeholder={entry.title.primaryTitle}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      {href ? (
                        <Link to={href} className="font-display text-base hover:underline">
                          {entry.title.primaryTitle}
                        </Link>
                      ) : (
                        <div className="font-display text-base">{entry.title.primaryTitle}</div>
                      )}
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--fy-text-muted)]">
                        <span>{entry.loggedOn}</span>
                        {entry.rating != null ? (
                          <span>{formatHalfStars(entry.rating)}</span>
                        ) : null}
                        {entry.liked ? (
                          <Heart size={12} className="text-[var(--fy-accent)]" fill="currentColor" />
                        ) : null}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(entry)}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void removeEntry(entry.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  {entry.review ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--fy-text-muted)]">
                      {entry.review}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New diary entry</DialogTitle>
            <DialogDescription>Pick a library title and log it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md border border-[var(--fy-border-subtle)] px-3 py-2 text-left text-sm hover:bg-[var(--fy-nav-hover)]"
              onClick={() => setPickOpen(true)}
            >
              {selected ? (
                <>
                  <div className="h-10 w-7 overflow-hidden rounded-sm bg-[var(--fy-bg)]">
                    <RemoteCover
                      path={selected.title.coverPath}
                      placeholder={selected.title.primaryTitle}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="truncate">{selected.title.primaryTitle}</span>
                </>
              ) : (
                <span className="text-[var(--fy-text-muted)]">Choose title…</span>
              )}
            </button>
            <label className="block text-xs font-medium text-[var(--fy-text-muted)]">
              Date
              <input
                type="date"
                value={loggedOn}
                onChange={(e) => setLoggedOn(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--fy-text-muted)]">
              Rating (optional)
              <select
                value={rating ?? ''}
                onChange={(e) =>
                  setRating(e.target.value ? Number(e.target.value) : null)
                }
                className="mt-1 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={liked}
                onChange={(e) => setLiked(e.target.checked)}
              />
              Liked
            </label>
            <label className="block text-xs font-medium text-[var(--fy-text-muted)]">
              Review
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2 text-sm"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!selected || busy || !loggedOn}
              onClick={() => void submitCreate()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editEntry != null} onOpenChange={(open) => !open && setEditEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit entry</DialogTitle>
            <DialogDescription>{editEntry?.title.primaryTitle}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-xs font-medium text-[var(--fy-text-muted)]">
              Date
              <input
                type="date"
                value={loggedOn}
                onChange={(e) => setLoggedOn(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--fy-text-muted)]">
              Rating
              <select
                value={rating ?? ''}
                onChange={(e) =>
                  setRating(e.target.value ? Number(e.target.value) : null)
                }
                className="mt-1 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={liked}
                onChange={(e) => setLiked(e.target.checked)}
              />
              Liked
            </label>
            <label className="block text-xs font-medium text-[var(--fy-text-muted)]">
              Review
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2 text-sm"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditEntry(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void submitEdit()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={pickOpen} onOpenChange={setPickOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-3 sm:mx-auto sm:max-w-lg">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--fy-border)]" />
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-base">Choose title</SheetTitle>
            <SheetDescription className="text-xs">From your library.</SheetDescription>
          </SheetHeader>
          <input
            value={libraryQuery}
            onChange={(e) => setLibraryQuery(e.target.value)}
            placeholder="Search…"
            className="mb-3 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2 text-sm"
          />
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {libraryHits.map((item) => (
              <li key={item.title.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-[var(--fy-nav-hover)]"
                  onClick={() => {
                    setSelected(item)
                    setPickOpen(false)
                  }}
                >
                  <div className="h-12 w-8 shrink-0 overflow-hidden rounded-sm bg-[var(--fy-bg)]">
                    <RemoteCover
                      path={item.title.coverPath}
                      placeholder={item.title.primaryTitle}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="truncate text-sm">{item.title.primaryTitle}</span>
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  )
}
