import { BookMarked, Heart, Star } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
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
import type { SocialTitleInput, TitleSocialState } from '@/lib/types'

interface TitleSocialControlsProps {
  title: SocialTitleInput
  className?: string
}

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function TitleSocialControls({ title, className }: TitleSocialControlsProps) {
  const [state, setState] = useState<TitleSocialState | null>(null)
  const [busy, setBusy] = useState(false)
  const [favOpen, setFavOpen] = useState(false)
  const [diaryOpen, setDiaryOpen] = useState(false)
  const [loggedOn, setLoggedOn] = useState(todayIsoDate)
  const [diaryRating, setDiaryRating] = useState<number | null>(null)
  const [diaryReview, setDiaryReview] = useState('')
  const [diaryLiked, setDiaryLiked] = useState(false)

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    void api
      .getTitleSocial(title)
      .then((s) => {
        if (!cancelled) setState(s)
      })
      .catch(() => {
        if (!cancelled) setState(null)
      })
    return () => {
      cancelled = true
    }
  }, [
    title.kind,
    title.localTitleId,
    title.providerId,
    title.providerTitleId,
    title.primaryTitle,
  ])

  async function setRating(value: number | null) {
    if (!isTauri() || busy) return
    setBusy(true)
    try {
      const next = await api.setTitleRating({ title, rating: value })
      setState(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function toggleLike() {
    if (!isTauri() || busy) return
    setBusy(true)
    try {
      const next = await api.toggleTitleLike({ title })
      setState(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function setFavorite(slot: number) {
    if (!isTauri() || busy) return
    setBusy(true)
    try {
      await api.setProfileFavorite({ slot, title })
      const next = await api.getTitleSocial(title)
      setState(next)
      setFavOpen(false)
      toast.success(`Saved to favorite slot ${slot + 1}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function clearFavorite() {
    if (!isTauri() || busy || state?.favoriteSlot == null) return
    setBusy(true)
    try {
      await api.clearProfileFavorite(state.favoriteSlot)
      const next = await api.getTitleSocial(title)
      setState(next)
      setFavOpen(false)
      toast.success('Removed from favorites')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function submitDiary() {
    if (!isTauri() || busy) return
    setBusy(true)
    try {
      await api.createDiaryEntry({
        title,
        loggedOn,
        rating: diaryRating,
        review: diaryReview.trim() || null,
        liked: diaryLiked,
      })
      const next = await api.getTitleSocial(title)
      setState(next)
      setDiaryOpen(false)
      setDiaryReview('')
      setDiaryRating(null)
      setDiaryLiked(false)
      setLoggedOn(todayIsoDate())
      toast.success('Logged to diary')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const rating = state?.rating ?? null

  return (
    <>
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <div className="flex items-center gap-0.5 rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-elevated)] px-1.5 py-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = rating != null && rating >= n
            const half = rating != null && rating >= n - 0.5 && rating < n
            return (
              <button
                key={n}
                type="button"
                disabled={busy}
                title={`${n} stars`}
                className={cn(
                  'p-0.5 transition',
                  filled || half
                    ? 'text-[var(--fy-accent)]'
                    : 'text-[var(--fy-text-muted)] hover:text-[var(--fy-text)]',
                )}
                onClick={() => {
                  if (rating === n) void setRating(null)
                  else if (rating === n - 0.5) void setRating(n)
                  else void setRating(n - 0.5)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  void setRating(n)
                }}
              >
                <Star size={16} fill={filled ? 'currentColor' : half ? 'currentColor' : 'none'} className={half && !filled ? 'opacity-50' : undefined} />
              </button>
            )
          })}
        </div>

        <Button
          size="sm"
          variant={state?.liked ? 'primary' : 'secondary'}
          disabled={busy}
          onClick={() => void toggleLike()}
        >
          <Heart size={14} fill={state?.liked ? 'currentColor' : 'none'} />
          {state?.liked ? 'Liked' : 'Like'}
        </Button>

        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setFavOpen(true)}>
          <Star size={14} fill={state?.favoriteSlot != null ? 'currentColor' : 'none'} />
          {state?.favoriteSlot != null ? `Fav #${state.favoriteSlot + 1}` : 'Favorite'}
        </Button>

        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setDiaryOpen(true)}>
          <BookMarked size={14} /> Log diary
        </Button>
      </div>

      <Sheet open={favOpen} onOpenChange={setFavOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-3 sm:mx-auto sm:max-w-lg">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--fy-border)]" />
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-base">Profile favorites</SheetTitle>
            <SheetDescription className="text-xs">
              Pick a slot (max 4). Choosing an occupied slot replaces it.
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((slot) => (
              <Button
                key={slot}
                variant={state?.favoriteSlot === slot ? 'primary' : 'secondary'}
                disabled={busy}
                onClick={() => void setFavorite(slot)}
              >
                Slot {slot + 1}
                {state?.favoriteSlot === slot ? ' · current' : ''}
              </Button>
            ))}
          </div>
          {state?.favoriteSlot != null ? (
            <Button
              className="mt-3 w-full"
              variant="ghost"
              disabled={busy}
              onClick={() => void clearFavorite()}
            >
              Remove from favorites
            </Button>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={diaryOpen} onOpenChange={setDiaryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log to diary</DialogTitle>
            <DialogDescription>
              Letterboxd-style entry for {title.primaryTitle}.
            </DialogDescription>
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
            <div>
              <div className="mb-1 text-xs font-medium text-[var(--fy-text-muted)]">Rating</div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={cn(
                      'p-0.5',
                      diaryRating != null && diaryRating >= n
                        ? 'text-[var(--fy-accent)]'
                        : 'text-[var(--fy-text-muted)]',
                    )}
                    onClick={() =>
                      setDiaryRating((prev) => (prev === n ? null : n))
                    }
                  >
                    <Star size={18} fill={diaryRating != null && diaryRating >= n ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={diaryLiked}
                onChange={(e) => setDiaryLiked(e.target.checked)}
              />
              Liked
            </label>
            <label className="block text-xs font-medium text-[var(--fy-text-muted)]">
              Review
              <textarea
                value={diaryReview}
                onChange={(e) => setDiaryReview(e.target.value)}
                rows={4}
                placeholder="Optional notes…"
                className="mt-1 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2 text-sm"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDiaryOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy || !loggedOn} onClick={() => void submitDiary()}>
              Save entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
