import { Outlet, useLocation } from 'react-router-dom'

import { Sidebar } from '@/components/layout/Sidebar'

export function AppShell() {
  const location = useLocation()
  const isReader = location.pathname.startsWith('/reader')

  if (isReader) {
    return <Outlet />
  }

  return (
    <div className="relative flex h-full overflow-hidden text-[var(--fy-text)]">
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

      <Sidebar />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="fy-fade-in fy-glass-soft w-full rounded-2xl p-5 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
