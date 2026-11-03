import {
  Bookmark,
  Compass,
  History,
  Library,
  PanelLeft,
  Settings,
  Sparkles,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/Sidebar'
import { cn } from '@/lib/cn'

const items = [
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/library', label: 'Library', icon: Library },
  // Downloads hidden until offline remote downloads ship.
  { to: '/history', label: 'History', icon: History },
  { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { to: '/sources', label: 'Sources', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppSidebar() {
  const location = useLocation()
  const { state, toggleSidebar } = useSidebar()
  const collapsed = state === 'collapsed'

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader
        className={cn(
          'gap-1 px-2 py-3',
          collapsed ? 'items-center px-0' : 'items-stretch',
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="group/brand relative mx-auto flex size-9 items-center justify-center rounded-xl text-[var(--fy-text)] transition hover:bg-[var(--fy-nav-active)]"
          >
            <span className="font-brand text-lg leading-none transition-opacity group-hover/brand:opacity-0">
              F
            </span>
            <PanelLeft
              size={16}
              className="absolute opacity-0 transition-opacity group-hover/brand:opacity-100"
              aria-hidden
            />
          </button>
        ) : (
          <div className="flex items-start gap-2 px-1">
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="font-brand text-[1.85rem] leading-none text-[var(--fy-text)]">
                Fyodor
              </div>
              <p className="mt-1 text-[11px] text-[var(--fy-text-muted)]">
                A library of worlds.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--fy-text-muted)] transition hover:bg-[var(--fy-nav-active)] hover:text-[var(--fy-text)]"
            >
              <PanelLeft size={16} />
            </button>
          </div>
        )}
      </SidebarHeader>

      <SidebarSeparator className={cn(collapsed && 'mx-auto w-6')} />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = item.icon
                const isActive =
                  location.pathname === item.to ||
                  location.pathname.startsWith(`${item.to}/`)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <NavLink to={item.to}>
                        <Icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-md px-2 py-2 text-[11px] text-sidebar-foreground/60 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-sidebar-primary" />
          <span className="font-mono tracking-tight group-data-[collapsible=icon]:hidden">
            Local library ready
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
