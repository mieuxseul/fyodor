import type { ComponentProps } from 'react'
import { Toaster as Sonner, toast } from 'sonner'

import { useTheme } from '@/app/ThemeProvider'
import { cn } from '@/lib/cn'

type ToasterProps = ComponentProps<typeof Sonner>

export function Toaster({ ...props }: ToasterProps) {
  const { resolved } = useTheme()

  return (
    <Sonner
      theme={resolved}
      position="top-center"
      offset={18}
      gap={8}
      visibleToasts={3}
      duration={2800}
      closeButton={false}
      richColors={false}
      expand={false}
      className="fy-toaster"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: cn(
            'fy-liquid-menu pointer-events-auto flex w-max max-w-[min(90vw,22rem)] items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm shadow-lg',
            'data-[type=success]:text-[var(--fy-text)]',
            'data-[type=error]:text-[var(--fy-danger)]',
          ),
          title: 'text-[13px] font-medium leading-snug',
          description: 'text-xs text-[var(--fy-text-muted)]',
        },
      }}
      {...props}
    />
  )
}

export { toast }
