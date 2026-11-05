import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { cn } from '@/lib/cn'

export type SelectOption = {
  value: string
  label: string
}

type SelectProps = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
  disabled?: boolean
  'aria-label'?: string
  id?: string
  /** Open the menu above the trigger (useful near the bottom of the viewport). */
  placement?: 'bottom' | 'top'
}

export function Select({
  value,
  onChange,
  options,
  className,
  disabled,
  'aria-label': ariaLabel,
  id,
  placement = 'bottom',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((option) => option.value === value) ?? options[0]

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

  const stretch =
    /\bw-full\b/.test(className ?? '') ||
    /\bflex-1\b/.test(className ?? '') ||
    /\bmin-w-0\b/.test(className ?? '')

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative inline-flex max-w-full',
        stretch && 'w-full min-w-0',
        /\bflex-1\b/.test(className ?? '') && 'flex-1',
      )}
    >
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex w-full items-center justify-between gap-2 text-left text-[var(--fy-text)] outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? ''}</span>
        <ChevronDown
          size={14}
          className={cn(
            'shrink-0 text-[var(--fy-text-muted)] transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            'fy-liquid-menu absolute z-[70] max-h-60 min-w-full overflow-y-auto py-1 text-sm shadow-xl',
            placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
            'left-0 right-auto',
          )}
        >
          {options.map((option) => {
            const active = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                className={cn(
                  'fy-menu-item relative z-[1] flex w-full items-center justify-between gap-2 text-[var(--fy-text)]',
                  active && 'bg-[var(--fy-nav-active)]',
                )}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <span className="min-w-0 flex-1 truncate text-left">{option.label}</span>
                {active ? <Check size={14} className="shrink-0 text-[var(--fy-accent)]" /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
