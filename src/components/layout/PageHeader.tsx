import type { ReactNode } from 'react'

import { Separator } from '@/components/ui/Separator'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--fy-text)]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-[var(--fy-text-muted)]">{subtitle}</p>
        ) : null}
        <Separator className="mt-4 max-w-xs" />
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
