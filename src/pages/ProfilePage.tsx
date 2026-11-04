import { BookOpen, Pencil, Plus, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { RemoteCover } from '@/components/RemoteCover'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toaster'
import { api, isTauri, toAssetUrl } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatActivityLabel, localSocialInput, socialHref } from '@/lib/social-title'
import type {
  ActivityEvent,
  LibraryItem,
  ProfileFavorite,
  UserProfile,
} from '@/lib/types'

export function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [favorites, setFavorites] = useState<ProfileFavorite[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [showActivity, setShowActivity] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pickSlot, setPickSlot] = useState<number | null>(null)
  const [libraryQuery, setLibraryQuery] = useState('')
  const [libraryHits, setLibraryHits] = useState<LibraryItem[]>([])

  async function refresh() {
    if (!isTauri()) return
    const [p, favs, acts] = await Promise.all([
      api.getProfile(),
      api.listProfileFavorites(),
      api.listRecentActivity(40),
    ])
    setProfile(p)
    setFavorites(favs)
    setActivity(acts)
    setName(p.displayName)
    setBio(p.bio ?? '')
    setShowActivity(p.showRecentActivity)
  }

  useEffect(() => {
    if (!isTauri()) {
      setError('Profile requires the Fyodor desktop runtime.')
      return
    }
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : String(err)),
    )
  }, [])

  useEffect(() => {
    if (pickSlot == null || !isTauri()) return
    const q = libraryQuery.trim()
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const hits = q
            ? await api.searchLibrary(q)
            : (await api.listLibrary()).slice(0, 24)
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
  }, [pickSlot, libraryQuery])

  const slots = useMemo(() => {
    const map = new Map(favorites.map((f) => [f.slot, f]))
    return [0, 1, 2, 3].map((slot) => map.get(slot) ?? null)
  }, [favorites])

  const avatarUrl = toAssetUrl(profile?.avatarPath)

  async function saveProfile() {
    if (!isTauri() || saving) return
    setSaving(true)
    try {
      const next = await api.updateProfile({
        displayName: name.trim() || 'Reader',
        bio: bio.trim(),
        showRecentActivity: showActivity,
      })
      setProfile(next)
      setEditOpen(false)
      if (!next.showRecentActivity) setActivity([])
      else setActivity(await api.listRecentActivity(40))
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function pickAvatar() {
    if (!isTauri()) return
    try {
      const next = await api.pickProfileAvatar()
      setProfile(next)
      toast.success('Avatar updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  async function clearAvatar() {
    if (!isTauri()) return
    try {
      const next = await api.updateProfile({ clearAvatar: true })
      setProfile(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  async function assignFavorite(item: LibraryItem) {
    if (pickSlot == null || !isTauri()) return
    try {
      const next = await api.setProfileFavorite({
        slot: pickSlot,
        title: localSocialInput({
          titleId: item.title.id,
          primaryTitle: item.title.primaryTitle,
          coverPath: item.title.coverPath,
          author: item.title.author,
          contentType: item.title.contentType,
        }),
      })
      setFavorites(next)
      setPickSlot(null)
      setLibraryQuery('')
      toast.success(`Added to favorite slot ${pickSlot + 1}`)
      setActivity(await api.listRecentActivity(40))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  async function clearSlot(slot: number) {
    if (!isTauri()) return
    try {
      setFavorites(await api.clearProfileFavorite(slot))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  if (error) {
    return <EmptyState title="Profile unavailable" description={error} />
  }

  if (!profile) {
    return <p className="text-sm text-[var(--fy-text-muted)]">Loading profile…</p>
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle="Your local reader card, favorites, and activity."
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={14} /> Edit
            </Button>
            <Button variant="primary" asChild>
              <Link to="/profile/diary">
                <BookOpen size={14} /> Diary
              </Link>
            </Button>
          </>
        }
      />

      <section className="mb-8 flex flex-wrap items-start gap-5 fy-liquid-tile p-5">
        <button
          type="button"
          onClick={() => void pickAvatar()}
          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-[var(--fy-bg)] ring-1 ring-[var(--fy-border-subtle)]"
          title="Change avatar"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[var(--fy-text-muted)]">
              <UserRound size={36} />
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight">{profile.displayName}</h2>
          {profile.bio ? (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--fy-text-muted)]">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--fy-text-muted)]">No bio yet.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void pickAvatar()}>
              Change avatar
            </Button>
            {profile.avatarPath ? (
              <Button size="sm" variant="ghost" onClick={() => void clearAvatar()}>
                Remove avatar
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Favorites</h3>
            <p className="text-xs text-[var(--fy-text-muted)]">Up to four titles on your profile.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {slots.map((fav, slot) => {
            if (!fav) {
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setPickSlot(slot)}
                  className="flex aspect-[2/3] flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-[var(--fy-border-subtle)] text-[var(--fy-text-muted)] transition hover:border-[var(--fy-accent)] hover:text-[var(--fy-text)]"
                >
                  <Plus size={20} />
                  <span className="text-xs">Add</span>
                </button>
              )
            }
            const href = socialHref(fav.title)
            const body = (
              <>
                <div className="aspect-[2/3] overflow-hidden rounded-sm bg-[var(--fy-bg)]">
                  <RemoteCover
                    path={fav.title.coverPath}
                    placeholder={fav.title.primaryTitle}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="mt-1.5 line-clamp-2 px-0.5 font-display text-[13px] leading-snug">
                  {fav.title.primaryTitle}
                </div>
              </>
            )
            return (
              <div key={slot} className="group relative">
                {href ? (
                  <Link to={href} className="block">
                    {body}
                  </Link>
                ) : (
                  <div>{body}</div>
                )}
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                  onClick={() => void clearSlot(slot)}
                >
                  Clear
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {profile.showRecentActivity ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Recent activity</h3>
              <p className="text-xs text-[var(--fy-text-muted)]">
                Ratings, likes, diary logs, favorites, and reads.
              </p>
            </div>
            <Link
              to="/profile/diary"
              className="text-xs text-[var(--fy-text-muted)] underline-offset-2 hover:text-[var(--fy-text)] hover:underline"
            >
              Open diary
            </Link>
          </div>
          {activity.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Rate, like, favorite, or log a title to see it here."
            />
          ) : (
            <ul className="space-y-2">
              {activity.map((event) => {
                const href = event.title ? socialHref(event.title) : null
                const label = formatActivityLabel(event.kind)
                const rating =
                  typeof event.payload.rating === 'number' ? event.payload.rating : null
                const chapterTitle =
                  typeof event.payload.chapterTitle === 'string'
                    ? event.payload.chapterTitle
                    : null
                const row = (
                  <div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-[var(--fy-nav-hover)]">
                    <div className="h-12 w-8 shrink-0 overflow-hidden rounded-sm bg-[var(--fy-bg)]">
                      <RemoteCover
                        path={event.title?.coverPath}
                        placeholder={event.title?.primaryTitle ?? label}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">
                        <span className="text-[var(--fy-text-muted)]">{label}</span>
                        {event.title ? (
                          <>
                            {' '}
                            <span className="font-medium">{event.title.primaryTitle}</span>
                          </>
                        ) : null}
                        {rating != null ? (
                          <span className="text-[var(--fy-text-muted)]"> · {rating}★</span>
                        ) : null}
                      </div>
                      <div className="truncate text-[11px] text-[var(--fy-text-muted)]">
                        {chapterTitle ? `${chapterTitle} · ` : ''}
                        {new Date(event.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )
                return (
                  <li key={event.id}>
                    {href ? <Link to={href}>{row}</Link> : row}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : (
        <p className="text-sm text-[var(--fy-text-muted)]">
          Recent activity is hidden. Turn it on in Edit profile.
        </p>
      )}

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-3 sm:mx-auto sm:max-w-lg">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--fy-border)]" />
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-base">Edit profile</SheetTitle>
            <SheetDescription className="text-xs">
              Local-only — stays on this device.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3">
            <label className="block text-xs font-medium text-[var(--fy-text-muted)]">
              Display name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--fy-text-muted)]">
              Bio
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showActivity}
                onChange={(e) => setShowActivity(e.target.checked)}
              />
              Show recent activity
            </label>
            <Button className="w-full" variant="primary" disabled={saving} onClick={() => void saveProfile()}>
              Save
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={pickSlot != null}
        onOpenChange={(open) => {
          if (!open) {
            setPickSlot(null)
            setLibraryQuery('')
          }
        }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-3 sm:mx-auto sm:max-w-lg">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--fy-border)]" />
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-base">
              Favorite slot {(pickSlot ?? 0) + 1}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Pick a library title. Remote titles can also be favorited from their page.
            </SheetDescription>
          </SheetHeader>
          <input
            value={libraryQuery}
            onChange={(e) => setLibraryQuery(e.target.value)}
            placeholder="Search library…"
            className="mb-3 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2 text-sm"
          />
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {libraryHits.map((item) => (
              <li key={item.title.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-[var(--fy-nav-hover)]',
                  )}
                  onClick={() => void assignFavorite(item)}
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
