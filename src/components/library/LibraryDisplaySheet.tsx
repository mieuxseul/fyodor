import { LayoutGrid, List, Rows3 } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/Sheet'
import { cn } from '@/lib/cn'
import {
  type LibraryDisplayMode,
  type LibraryDisplayPrefs,
} from '@/lib/library-display'

interface LibraryDisplaySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefs: LibraryDisplayPrefs
  onChange: (patch: Partial<LibraryDisplayPrefs>) => void
}

const MODES: { id: LibraryDisplayMode; label: string; icon: typeof List }[] = [
  { id: 'compact', label: 'Compact', icon: List },
  { id: 'details', label: 'Details', icon: Rows3 },
  { id: 'grid', label: 'Grid', icon: LayoutGrid },
]

export function LibraryDisplaySheet({
  open,
  onOpenChange,
  prefs,
  onChange,
}: LibraryDisplaySheetProps) {
  function pick(patch: Partial<LibraryDisplayPrefs>) {
    onChange(patch)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-3 sm:max-w-lg sm:mx-auto">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--fy-border)]" />
        <SheetHeader className="mb-4 text-left">
          <SheetTitle className="text-base">List options</SheetTitle>
          <SheetDescription className="text-xs">
            Display mode and grid density apply across Library, Discover, and Suggestions. Sort
            order is for your library only.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          <section>
            <div className="mb-2 text-xs font-medium text-[var(--fy-text-muted)]">List mode</div>
            <div className="flex overflow-hidden rounded-lg border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-elevated)]">
              {MODES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[11px]',
                    prefs.mode === id
                      ? 'bg-[var(--fy-nav-active)] text-[var(--fy-text)]'
                      : 'text-[var(--fy-text-muted)] hover:bg-[var(--fy-nav-hover)]',
                  )}
                  onClick={() => pick({ mode: id })}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {prefs.mode === 'grid' || prefs.mode === 'compact' ? (
            <section>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--fy-text-muted)]">Grid size</span>
                <span className="font-mono text-[var(--fy-text)]">{prefs.gridSize}</span>
              </div>
              <input
                type="range"
                min={2}
                max={8}
                step={1}
                value={prefs.gridSize}
                onChange={(e) => onChange({ gridSize: Number(e.target.value) })}
                onPointerUp={(e) => {
                  onChange({ gridSize: Number((e.target as HTMLInputElement).value) })
                  onOpenChange(false)
                }}
                onKeyUp={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
                    onOpenChange(false)
                  }
                }}
                className="w-full"
              />
            </section>
          ) : null}

          <section>
            <label className="block text-xs font-medium text-[var(--fy-text-muted)]">
              Sorting order
              <select
                className="mt-1.5 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-bg)] px-3 py-2 text-sm text-[var(--fy-text)]"
                value={prefs.sort}
                onChange={(e) =>
                  pick({ sort: e.target.value as LibraryDisplayPrefs['sort'] })
                }
              >
                <option value="added">Added</option>
                <option value="recent">Recently opened</option>
                <option value="title">Title</option>
                <option value="progress">Progress</option>
              </select>
            </label>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
