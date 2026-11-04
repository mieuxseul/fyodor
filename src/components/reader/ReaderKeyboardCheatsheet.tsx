import { Keyboard, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import {
  READER_SHORTCUT_GROUPS,
  shortcutsByGroup,
} from '@/lib/reader-shortcuts'

interface ReaderKeyboardCheatsheetProps {
  open: boolean
  onClose: () => void
}

export function ReaderKeyboardCheatsheet({ open, onClose }: ReaderKeyboardCheatsheetProps) {
  if (!open) return null

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 px-4 pl-[304px]"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className="fy-liquid-glass fy-reader-glass relative w-full max-w-md overflow-hidden rounded-[24px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative z-[1] flex items-center justify-between border-b border-[var(--fy-border-subtle)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-[var(--fy-text-muted)]" />
            <h2 className="text-sm font-semibold tracking-tight">Keyboard shortcuts</h2>
          </div>
          <button
            type="button"
            aria-label="Close shortcuts"
            className="rounded-md p-1 text-[var(--fy-text-muted)] hover:bg-[var(--fy-nav-active)] hover:text-[var(--fy-text)]"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative z-[1] max-h-[min(70vh,28rem)] space-y-4 overflow-y-auto px-4 py-3">
          {READER_SHORTCUT_GROUPS.map((group) => (
            <section key={group}>
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wide text-[var(--fy-text-muted)]">
                {group}
              </h3>
              <ul className="space-y-1.5">
                {shortcutsByGroup(group).map((item) => (
                  <li
                    key={`${group}-${item.action}`}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <span className="text-[var(--fy-text-muted)]">{item.action}</span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      {item.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded border border-[var(--fy-border-subtle)] bg-[var(--fy-nav-active)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--fy-text)]"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="relative z-[1] border-t border-[var(--fy-border-subtle)] px-4 py-3">
          <Button size="sm" variant="secondary" className="w-full" onClick={onClose}>
            Close · press ?
          </Button>
        </div>
      </div>
    </div>
  )
}
