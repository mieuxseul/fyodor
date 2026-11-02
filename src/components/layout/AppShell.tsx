import { Outlet, useLocation } from 'react-router-dom'

import { AppSidebar } from '@/components/layout/Sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/Sidebar'
import { Separator } from '@/components/ui/Separator'

export function AppShell() {
  const location = useLocation()
  const isReader = location.pathname.startsWith('/reader')

  if (isReader) {
    return <Outlet />
  }

  return (
    <SidebarProvider className="relative h-full min-h-0 overflow-hidden text-[var(--fy-text)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'var(--fy-bg-glow)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-[var(--fy-accent-soft)] opacity-70 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-[var(--fy-accent-soft)] opacity-50 blur-3xl"
      />

      <AppSidebar />

      <SidebarInset className="relative z-10 min-w-0 bg-transparent">
        <header className="flex h-12 shrink-0 items-center gap-2 px-3 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <span className="truncate text-sm text-[var(--fy-text-muted)]">
            Fyodor
          </span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 sm:px-6">
          <div className="fy-fade-in fy-glass-soft w-full rounded-2xl p-5 sm:p-6">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
