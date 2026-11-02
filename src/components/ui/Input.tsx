import * as React from 'react'

import { cn } from '@/lib/cn'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)] px-3 py-1 text-sm shadow-sm transition-colors',
          'placeholder:text-[var(--fy-text-muted)]',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--fy-focus)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
