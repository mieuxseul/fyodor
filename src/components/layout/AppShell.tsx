import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { SearchPalette } from '@/app/SearchPalette'
import { SearchUiProvider } from '@/app/SearchUiContext'
import { AppSidebar } from '@/components/layout/Sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/Sidebar'

export function AppShell() {
  const location = useLocation()
  const isReader = location.pathname.startsWith('/reader')
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (isReader) {
    return <Outlet />
  }

  return (
    <SidebarProvider className="relative h-full min-h-0 overflow-hidden text-[var(--fy-text)]">
      <div aria-hidden className="fy-app-ambient pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-28 top-6 h-80 w-80 rounded-full bg-[var(--fy-orb-a)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-10 h-96 w-96 rounded-full bg-[var(--fy-orb-b)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/3 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[var(--fy-orb-c)] blur-3xl"
      />

      <AppSidebar />

      <SidebarInset className="relative z-10 min-w-0 bg-transparent">
        <main className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-2 sm:px-3">
          <div className="fy-fade-in fy-liquid-glass relative w-full overflow-hidden rounded-[24px] p-3 sm:p-4">
            <div className="relative z-[1]">
              <SearchUiProvider openSearch={() => setSearchOpen(true)}>
                <Outlet />
              </SearchUiProvider>
            </div>
          </div>
        </main>
      </SidebarInset>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </SidebarProvider>
  )
}
