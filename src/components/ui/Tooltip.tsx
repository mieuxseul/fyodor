import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react'
import { forwardRef } from 'react'

import { cn } from '@/lib/cn'

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden fy-liquid-control px-2.5 py-1.5 text-xs text-[var(--fy-text)] shadow-md',
        'animate-in fade-in-0 zoom-in-95',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))

TooltipContent.displayName = TooltipPrimitive.Content.displayName

interface SimpleTooltipProps {
  label: string
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function SimpleTooltip({ label, children, side = 'right' }: SimpleTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
