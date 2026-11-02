import {
  Bookmark,
  BookOpen,
  Compass,
  Download,
  History,
  Library,
  Settings,
  Sparkles,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { ScrollArea } from '@/components/ui/ScrollArea'
import { Separator } from '@/components/ui/Separator'
import { cn } from '@/lib/cn'

const groups = [
  {
    label: 'Browse',
    items: [
      { to: '/discover', label: 'Discover', icon: Compass },
      { to: '/library', label: 'Library', icon: Library },
      { to: '/reading', label: 'Reading', icon: BookOpen },
    ],
  },
  {
    label: 'Collection',
    items: [
      { to: '/downloads', label: 'Downloads', icon: Download },
      { to: '/history', label: 'History', icon: History },
      { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/sources', label: 'Sources', icon: Sparkles },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function Sidebar() {
  return (
    <aside className="fy-glass relative z-10 flex h-full w-[248px] flex-col rounded-none border-y-0 border-l-0">
      <div className="flex flex-col items-center px-3 pb-4 pt-6">
        <div className="font-brand text-center text-[2.4rem] leading-none text-[var(--fy-text)]">
          Fyodor
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--fy-text-muted)]">
          A library of worlds.
        </p>
      </div>

      <div className="px-4">
        <Separator />
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2.5 py-3">
        <nav>
          {groups.map((group, groupIndex) => (
            <div key={group.label} className={cn(groupIndex > 0 && 'mt-4')}>
              <div className="mb-1.5 px-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--fy-text-muted)]">
                {group.label}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          cn(
                            'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors',
                            isActive
                              ? 'bg-[var(--fy-nav-active)] font-medium text-[var(--fy-text)] shadow-[inset_0_0_0_1px_var(--fy-border-subtle)]'
                              : 'text-[var(--fy-text-muted)] hover:bg-[var(--fy-nav-hover)] hover:text-[var(--fy-text)]',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span
                              className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
                                isActive
                                  ? 'bg-[var(--fy-panel-solid)] text-[var(--fy-text)] shadow-sm'
                                  : 'text-[var(--fy-text-muted)] group-hover:text-[var(--fy-text)]',
                              )}
                            >
                              <Icon size={16} strokeWidth={1.75} />
                            </span>
                            <span className="truncate">{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
              {groupIndex < groups.length - 1 ? (
                <div className="mt-3 px-2">
                  <Separator />
                </div>
              ) : null}
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t border-[var(--fy-border-subtle)] px-3 py-3">
        <div className="fy-glass-soft flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] text-[var(--fy-text-muted)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--fy-primary)]" />
          <span className="font-mono tracking-tight">Local library ready</span>
        </div>
      </div>
    </aside>
  )
}
