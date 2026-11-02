import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-[var(--fy-primary)] text-[var(--fy-panel-solid)] shadow-sm hover:bg-[var(--fy-primary-hover)]',
        secondary:
          'border-[var(--fy-border-subtle)] bg-[var(--fy-panel-solid)]/70 text-[var(--fy-text)] backdrop-blur-sm hover:bg-[var(--fy-nav-hover)]',
        outline:
          'border-[var(--fy-border)] bg-white text-[var(--fy-text)] shadow-sm hover:bg-[var(--fy-bg)]',
        ghost:
          'border-transparent bg-transparent text-[var(--fy-text-muted)] hover:bg-[var(--fy-nav-hover)] hover:text-[var(--fy-text)]',
        danger:
          'border-transparent bg-[var(--fy-danger)] text-white hover:opacity-90',
      },
      size: {
        sm: 'px-2.5 py-1.5 text-xs',
        md: 'px-3 py-2 text-sm',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
}
