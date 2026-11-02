import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[280px] flex-col items-center justify-center px-6 py-16 text-center',
        className,
      )}
    >
      <div className="mb-5 h-px w-24 bg-[var(--fy-border-subtle)]" />
      <h2 className="text-2xl font-semibold tracking-tight text-[var(--fy-text)]">{title}</h2>
      <p className="mt-3 max-w-md text-sm text-[var(--fy-text-muted)]">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
      <div className="mt-8 h-px w-24 bg-[var(--fy-border-subtle)]" />
    </div>
  )
}
