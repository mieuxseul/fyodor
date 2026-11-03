import { Search } from 'lucide-react'
import type { ReactNode } from 'react'

import { useSearchUi } from '@/app/SearchUiContext'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  /** Show global search opposite the title (default true). */
  showSearch?: boolean
}

export function PageHeader({
  title,
  subtitle,
  actions,
  showSearch = true,
}: PageHeaderProps) {
  const searchUi = useSearchUi()

  return (
    <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--fy-text)]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-0.5 max-w-xl text-xs text-[var(--fy-text-muted)]">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {showSearch && searchUi ? (
          <button
            type="button"
            onClick={searchUi.openSearch}
            className="fy-liquid-control flex h-8 w-[11.5rem] items-center gap-2 px-2.5 text-left text-sm text-[var(--fy-text-muted)] transition-colors hover:text-[var(--fy-text)] sm:w-[13rem]"
            aria-label="Search library"
          >
            <Search size={14} className="shrink-0 opacity-80" />
            <span className="truncate">Search…</span>
            <kbd className="ml-auto hidden rounded px-1 font-mono text-[10px] text-[var(--fy-text-muted)] sm:inline">
              Ctrl+K
            </kbd>
          </button>
        ) : null}
        {actions ? <div className="flex flex-wrap items-center gap-1.5">{actions}</div> : null}
      </div>
    </header>
  )
}
