import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  CheckCheck,
  Download,
  FolderOpen,
  HardDrive,
  MoreVertical,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'

import { ContinueReadingRail } from '@/components/library/ContinueReadingRail'
import { CoverCard } from '@/components/library/CoverCard'
import { LibraryDisplaySheet } from '@/components/library/LibraryDisplaySheet'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toaster'
import { api, isTauri, toAssetUrl } from '@/lib/api'
import { getAppPrefs, subscribeAppPrefs } from '@/lib/app-prefs'
import { hasNewChapters, subscribeChapterSeen } from '@/lib/chapter-seen'
import { cn } from '@/lib/cn'
import {
  isIncognitoSession,
  setIncognitoSession,
  subscribeIncognito,
} from '@/lib/incognito'
import {
  createCategory,
  deleteCategory,
  getTitleCategoryId,
  listCategories,
  subscribeLibraryCategories,
  type LibraryCategory,
} from '@/lib/library-categories'
import {
  getLibraryDisplayPrefs,
  gridColsClass,
  LIBRARY_OPENED_EVENT,
  setLibraryDisplayPrefs,
  type LibraryDisplayPrefs,
} from '@/lib/library-display'
import {
  isTitlePinned,
  listPinnedTitleIds,
  subscribeLibraryPins,
  toggleTitlePinned,
} from '@/lib/library-pins'
import type { LibraryItem } from '@/lib/types'

function remoteIds(item: LibraryItem): { providerId: string; titleId: string } | null {
  const edition = item.preferredEdition
  if (
    edition?.sourceKind === 'remote' &&
    edition.providerId &&
    edition.providerTitleId
  ) {
    return { providerId: edition.providerId, titleId: edition.providerTitleId }
  }
  return null
}

function itemHasNewChapters(item: LibraryItem): boolean {
  const remote = remoteIds(item)
  if (!remote) return false
  return hasNewChapters(remote.providerId, remote.titleId)
}

export function LibraryPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<LibraryCategory[]>(() => listCategories())
  const [activeCategory, setActiveCategory] = useState('reading')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [query, setQuery] = useState('')
  const [filterOnDevice, setFilterOnDevice] = useState(false)
  const [filterNewChapters, setFilterNewChapters] = useState(false)
  const [filterCompleted, setFilterCompleted] = useState(false)
  const [display, setDisplay] = useState<LibraryDisplayPrefs>(() => getLibraryDisplayPrefs())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [categoryMenu, setCategoryMenu] = useState<{
    x: number
    y: number
    category: LibraryCategory
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pinTick, setPinTick] = useState(0)
  const [prefsTick, setPrefsTick] = useState(0)
  const [incognito, setIncognito] = useState(() => isIncognitoSession())
  const [avatarPath, setAvatarPath] = useState<string | null>(null)

  const showQuickFilters = getAppPrefs().showQuickFilters
  void prefsTick

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    void api
      .getProfile()
      .then((p) => {
        if (!cancelled) setAvatarPath(p.avatarPath ?? null)
      })
      .catch(() => {
        if (!cancelled) setAvatarPath(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    if (!isTauri()) {
      setLoading(false)
      setError('Launch with `npm run tauri:dev` to use the local library.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = await api.listLibrary({
        status: 'all',
        query: '',
        sort: display.sort,
        localOnly: false,
      })
      setItems(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [display.sort])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const refresh = () => {
      void load()
    }
    window.addEventListener('focus', refresh)
    window.addEventListener(LIBRARY_OPENED_EVENT, refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener(LIBRARY_OPENED_EVENT, refresh)
    }
  }, [load])

  useEffect(() => subscribeLibraryPins(() => setPinTick((n) => n + 1)), [])
  useEffect(() => subscribeChapterSeen(() => setPinTick((n) => n + 1)), [])
  useEffect(() => subscribeAppPrefs(() => setPrefsTick((n) => n + 1)), [])
  useEffect(() => subscribeIncognito(() => setIncognito(isIncognitoSession())), [])
  useEffect(
    () =>
      subscribeLibraryCategories(() => {
        setCategories(listCategories())
        setPinTick((n) => n + 1)
      }),
    [],
  )

  useEffect(() => {
    if (!categoryMenu) return
    const close = () => setCategoryMenu(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [categoryMenu])

  function removeCategory(category: LibraryCategory) {
    if (category.builtin) {
      toast.error('Built-in categories can’t be deleted')
      setCategoryMenu(null)
      return
    }
    deleteCategory(category.id)
    setCategories(listCategories())
    if (activeCategory === category.id) setActiveCategory('all')
    setCategoryMenu(null)
    toast.success('Category deleted', { description: category.name })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = items.filter((item) => {
      if (activeCategory !== 'all') {
        const catId = getTitleCategoryId(item.title.id, item.entry.status)
        if (catId !== activeCategory) return false
      }
      if (filterOnDevice && !item.entry.isLocal && !item.entry.isDownloaded) return false
      if (filterCompleted && item.entry.status !== 'completed' && !item.progress?.completed) {
        return false
      }
      if (filterNewChapters && !itemHasNewChapters(item)) return false
      if (q) {
        const hay = `${item.title.primaryTitle} ${item.title.author ?? ''} ${item.title.genres.join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    const pinned = new Set(listPinnedTitleIds())
    list = [...list].sort((a, b) => {
      const ap = pinned.has(a.title.id) ? 0 : 1
      const bp = pinned.has(b.title.id) ? 0 : 1
      if (ap !== bp) return ap - bp
      return 0
    })
    void pinTick
    return list
  }, [
    items,
    activeCategory,
    query,
    filterOnDevice,
    filterNewChapters,
    filterCompleted,
    pinTick,
  ])

  function patchDisplay(patch: Partial<LibraryDisplayPrefs>) {
    setDisplay(setLibraryDisplayPrefs(patch))
  }

  async function importArchives() {
    if (!isTauri()) return
    setBusy(true)
    setNotice(null)
    try {
      const results = await api.pickAndImportArchives()
      if (results.length === 0) setNotice('Import cancelled.')
      else {
        setNotice(`Imported ${results.length} title${results.length === 1 ? '' : 's'}.`)
        await load()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function importFolder() {
    if (!isTauri()) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await api.pickAndImportFolder()
      setNotice(`Imported “${result.primaryTitle}” (${result.pageCount} pages).`)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.toLowerCase().includes('cancelled')) setError(message)
    } finally {
      setBusy(false)
    }
  }

  function toggleSelected(titleId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(titleId)) next.delete(titleId)
      else next.add(titleId)
      return next
    })
  }

  async function removeSelected() {
    if (!isTauri() || selected.size === 0) return
    const count = selected.size
    if (
      !window.confirm(
        `Remove ${count} title${count === 1 ? '' : 's'} from the library? Original files stay on disk.`,
      )
    ) {
      return
    }
    setBusy(true)
    try {
      for (const id of selected) await api.removeFromLibrary(id)
      setSelected(new Set())
      setSelectMode(false)
      setNotice(`Removed ${count} title${count === 1 ? '' : 's'}.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <label className="fy-liquid-control flex h-9 min-w-0 flex-1 items-center gap-2 px-2.5">
          <Search size={14} className="shrink-0 text-[var(--fy-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search manga"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--fy-text-muted)]"
          />
        </label>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Import folder"
          title="Import folder"
          disabled={busy || !isTauri()}
          onClick={() => void importFolder()}
        >
          <FolderOpen size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Import CBZ"
          title="Import CBZ"
          disabled={busy || !isTauri()}
          onClick={() => void importArchives()}
        >
          <Upload size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Downloads"
          onClick={() => navigate('/downloads')}
        >
          <Download size={16} />
        </Button>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Library menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical size={16} />
          </Button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-20 cursor-default"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              />
              <div className="fy-liquid-menu absolute right-0 z-30 mt-1 w-52 overflow-hidden py-1.5 text-sm">
                <button
                  type="button"
                  className="fy-menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    setSheetOpen(true)
                  }}
                >
                  List options
                </button>
                <button
                  type="button"
                  className="fy-menu-item justify-between"
                  onClick={() => {
                    setIncognitoSession(!incognito)
                    setIncognito(!incognito)
                    setMenuOpen(false)
                  }}
                >
                  Incognito mode
                  <span className="font-mono text-[10px] text-[var(--fy-text-muted)]">
                    {incognito ? 'On' : 'Off'}
                  </span>
                </button>
                <button
                  type="button"
                  className="fy-menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    setSelectMode((v) => !v)
                    setSelected(new Set())
                  }}
                >
                  {selectMode ? 'Cancel select' : 'Select titles'}
                </button>
                <button
                  type="button"
                  className="fy-menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/settings')
                  }}
                >
                  Settings
                </button>
                <div className="mx-3 my-1.5 border-t border-[var(--fy-border-subtle)]" />
                <div className="px-3 py-1.5">
                  <div className="mb-1.5 text-[11px] font-medium text-[var(--fy-text-muted)]">
                    Add category
                  </div>
                  <form
                    className="flex gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      try {
                        const created = createCategory(newCategoryName)
                        setCategories(listCategories())
                        setActiveCategory(created.id)
                        setNewCategoryName('')
                        setMenuOpen(false)
                        toast.success('Category created', { description: created.name })
                      } catch (err) {
                        const message = err instanceof Error ? err.message : String(err)
                        toast.error('Couldn’t create category', { description: message })
                        setError(message)
                      }
                    }}
                  >
                    <input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      placeholder="Name…"
                      className="fy-liquid-control h-8 min-w-0 flex-1 px-2 text-xs"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="primary"
                      disabled={!newCategoryName.trim()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Add
                    </Button>
                  </form>
                </div>
              </div>
            </>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Profile"
          title="Profile"
          onClick={() => navigate('/profile')}
          className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-[var(--fy-border-subtle)] bg-[var(--fy-panel-elevated)] text-[var(--fy-text-muted)] transition hover:ring-[var(--fy-accent)] hover:text-[var(--fy-text)]"
        >
          {toAssetUrl(avatarPath) ? (
            <img
              src={toAssetUrl(avatarPath)}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <UserRound size={15} />
          )}
        </button>
      </div>

      <div className="mb-2 flex justify-center border-b border-[var(--fy-border-subtle)]">
        <div className="flex max-w-full gap-4 overflow-x-auto px-1">
          <button
            type="button"
            className={cn(
              'shrink-0 border-b-2 px-0.5 pb-2 text-sm font-medium transition-colors',
              activeCategory === 'all'
                ? 'border-[var(--fy-text)] text-[var(--fy-text)]'
                : 'border-transparent text-[var(--fy-text-muted)] hover:text-[var(--fy-text)]',
            )}
            onClick={() => setActiveCategory('all')}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={cn(
                'shrink-0 border-b-2 px-0.5 pb-2 text-sm font-medium transition-colors',
                activeCategory === cat.id
                  ? 'border-[var(--fy-text)] text-[var(--fy-text)]'
                  : 'border-transparent text-[var(--fy-text-muted)] hover:text-[var(--fy-text)]',
              )}
              onClick={() => setActiveCategory(cat.id)}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setCategoryMenu({ x: event.clientX, y: event.clientY, category: cat })
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {categoryMenu
        ? createPortal(
            <div
              role="menu"
              className="fy-liquid-menu fixed z-[60] w-44 overflow-hidden py-1.5 text-sm shadow-xl"
              style={{
                left: Math.min(categoryMenu.x, window.innerWidth - 190),
                top: Math.min(categoryMenu.y, window.innerHeight - 80),
              }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className="fy-menu-item gap-2 text-[var(--fy-danger)]"
                disabled={Boolean(categoryMenu.category.builtin)}
                title={
                  categoryMenu.category.builtin
                    ? 'Built-in categories can’t be deleted'
                    : undefined
                }
                onClick={() => removeCategory(categoryMenu.category)}
              >
                <Trash2 size={14} />
                {categoryMenu.category.builtin ? 'Can’t delete' : 'Delete category'}
              </button>
            </div>,
            document.body,
          )
        : null}

      {showQuickFilters ? (
        <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
          <FilterChip
            active={filterOnDevice}
            onClick={() => setFilterOnDevice((v) => !v)}
            icon={<HardDrive size={12} />}
            label="On device"
          />
          <FilterChip
            active={filterNewChapters}
            onClick={() => setFilterNewChapters((v) => !v)}
            icon={<Sparkles size={12} />}
            label="New chapters"
          />
          <FilterChip
            active={filterCompleted}
            onClick={() => setFilterCompleted((v) => !v)}
            icon={<CheckCheck size={12} />}
            label="Completed"
          />
          {selectMode ? (
            <Button
              variant="primary"
              size="sm"
              disabled={busy || selected.size === 0}
              onClick={() => void removeSelected()}
            >
              Remove ({selected.size})
            </Button>
          ) : null}
        </div>
      ) : null}

      {!incognito ? <ContinueReadingRail /> : null}

      {notice ? (
        <p className="mb-2.5 fy-liquid-tile px-2.5 py-1.5 text-xs">{notice}</p>
      ) : null}
      {error ? (
        <p className="mb-2.5 rounded-sm border border-[var(--fy-danger)] px-2.5 py-1.5 text-xs text-[var(--fy-danger)]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--fy-text-muted)]">Loading library…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No titles in this category"
          description="Import a CBZ/ZIP or folder, create a category, or clear filters to see more titles."
          action={
            <Button variant="primary" disabled={!isTauri() || busy} onClick={() => void importArchives()}>
              Import CBZ
            </Button>
          }
        />
      ) : display.mode === 'details' ? (
        <div className="space-y-1.5">
          {filtered.map((item) => (
            <div key={item.title.id} className="flex items-center gap-2">
              {selectMode ? (
                <input
                  type="checkbox"
                  checked={selected.has(item.title.id)}
                  onChange={() => toggleSelected(item.title.id)}
                />
              ) : null}
              <div
                className="min-w-0 flex-1"
                onContextMenu={(e) => {
                  e.preventDefault()
                  toggleTitlePinned(item.title.id)
                  setPinTick((n) => n + 1)
                }}
              >
                <CoverCard
                  item={item}
                  view="details"
                  pinned={isTitlePinned(item.title.id)}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn('grid gap-3', gridColsClass(display.gridSize))}>
          {filtered.map((item) => (
            <div
              key={item.title.id}
              className="relative"
              onContextMenu={(e) => {
                e.preventDefault()
                toggleTitlePinned(item.title.id)
                setPinTick((n) => n + 1)
              }}
            >
              {selectMode ? (
                <label className="absolute left-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded bg-[var(--fy-panel-solid)]/90">
                  <input
                    type="checkbox"
                    checked={selected.has(item.title.id)}
                    onChange={() => toggleSelected(item.title.id)}
                  />
                </label>
              ) : null}
              <CoverCard
                item={item}
                view={display.mode === 'compact' ? 'compact' : 'grid'}
                pinned={isTitlePinned(item.title.id)}
              />
            </div>
          ))}
        </div>
      )}

      <LibraryDisplaySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        prefs={display}
        onChange={patchDisplay}
      />
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]',
        active
          ? 'border-[var(--fy-border)] bg-[var(--fy-nav-active)] text-[var(--fy-text)]'
          : 'border-[var(--fy-border-subtle)] text-[var(--fy-text-muted)] hover:text-[var(--fy-text)]',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
