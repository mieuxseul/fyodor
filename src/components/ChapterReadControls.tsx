import { Check, MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/cn'

interface ChapterReadControlsProps {
  isRead: boolean
  onToggleRead: () => void
  onMarkPrevious: () => void
  className?: string
}

export function ChapterReadControls({
  isRead,
  onToggleRead,
  onMarkPrevious,
  className,
}: ChapterReadControlsProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative flex shrink-0 items-center gap-0.5', className)}>
      <button
        type="button"
        aria-label={isRead ? 'Mark as unread' : 'Mark as read'}
        title={isRead ? 'Mark as unread' : 'Mark as read'}
        className={cn(
          'flex size-7 items-center justify-center rounded-md transition',
          isRead
            ? 'text-[var(--fy-text-muted)] hover:bg-[var(--fy-nav-active)] hover:text-[var(--fy-text)]'
            : 'text-[var(--fy-text-muted)] hover:bg-[var(--fy-nav-active)] hover:text-[var(--fy-text)]',
        )}
        onClick={(event) => {
          event.stopPropagation()
          onToggleRead()
        }}
      >
        <Check
          size={14}
          className={cn(isRead ? 'opacity-100' : 'opacity-35')}
          strokeWidth={isRead ? 2.5 : 2}
        />
      </button>
      <button
        type="button"
        aria-label="Chapter read options"
        aria-expanded={open}
        className="flex size-7 items-center justify-center rounded-md text-[var(--fy-text-muted)] transition hover:bg-[var(--fy-nav-active)] hover:text-[var(--fy-text)]"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
      >
        <MoreHorizontal size={14} />
      </button>
      {open ? (
        <div className="fy-liquid-menu absolute right-0 top-full z-20 mt-1 min-w-[10.5rem] overflow-hidden rounded-xl py-1 text-sm">
          <button
            type="button"
            className="fy-menu-item relative z-[1] text-[var(--fy-text)]"
            onClick={(event) => {
              event.stopPropagation()
              onToggleRead()
              setOpen(false)
            }}
          >
            {isRead ? 'Mark as unread' : 'Mark as read'}
          </button>
          <button
            type="button"
            className="fy-menu-item relative z-[1] text-[var(--fy-text)]"
            onClick={(event) => {
              event.stopPropagation()
              onMarkPrevious()
              setOpen(false)
            }}
          >
            Mark previous as read
          </button>
        </div>
      ) : null}
    </div>
  )
}
