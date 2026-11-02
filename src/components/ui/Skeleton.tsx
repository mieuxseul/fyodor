import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-[var(--fy-accent-soft)]', className)}
      {...props}
    />
  )
}

export { Skeleton }
