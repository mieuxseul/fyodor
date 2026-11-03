import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-[var(--fy-primary)] text-[var(--fy-bg)] shadow-sm hover:bg-[var(--fy-primary-hover)]',
        secondary:
          'fy-liquid-control text-[var(--fy-text)] hover:border-[var(--fy-border-subtle)]',
        outline:
          'fy-liquid-control text-[var(--fy-text)] hover:border-[var(--fy-border-subtle)]',
        ghost:
          'border-transparent bg-transparent text-[var(--fy-text-muted)] hover:bg-white/10 hover:text-[var(--fy-text)]',
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
