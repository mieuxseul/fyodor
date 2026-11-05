import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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

type MenuCoords = {
  top: number
  left: number
  width: number
  maxHeight: number
  placement: 'bottom' | 'top'
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
  const [coords, setCoords] = useState<MenuCoords | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((option) => option.value === value) ?? options[0]

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setCoords(null)
      return
    }

    const update = () => {
      const trigger = rootRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const gap = 4
      const spaceBelow = window.innerHeight - rect.bottom - gap - 8
      const spaceAbove = rect.top - gap - 8
      const preferTop =
        placement === 'top' || (placement === 'bottom' && spaceBelow < 160 && spaceAbove > spaceBelow)
      const maxHeight = Math.min(240, preferTop ? spaceAbove : spaceBelow)
      setCoords({
        top: preferTop ? rect.top - gap : rect.bottom + gap,
        left: rect.left,
        width: Math.max(rect.width, 140),
        maxHeight: Math.max(120, maxHeight),
        placement: preferTop ? 'top' : 'bottom',
      })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, placement, options.length])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
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

  const menu =
    open && coords
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="fy-liquid-menu fixed z-[80] overflow-y-auto py-1 text-sm shadow-xl"
            style={{
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
              top: coords.placement === 'top' ? undefined : coords.top,
              bottom:
                coords.placement === 'top' ? window.innerHeight - coords.top : undefined,
            }}
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
                  {active ? (
                    <Check size={14} className="shrink-0 text-[var(--fy-accent)]" />
                  ) : null}
                </button>
              )
            })}
          </div>,
          document.body,
        )
      : null

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
      {menu}
    </div>
  )
}
