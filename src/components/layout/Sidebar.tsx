import {
  Bookmark,
  Compass,
  History,
  Library,
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
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/Sidebar'

// Downloads nav stays hidden until remote offline downloads ship.
const items = [
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/history', label: 'History', icon: History },
  { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { to: '/sources', label: 'Sources', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppSidebar() {
  const location = useLocation()

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="items-center gap-1 px-2 py-4 group-data-[collapsible=icon]:px-0">
        <div className="font-brand text-center text-[1.85rem] leading-none text-sidebar-foreground group-data-[collapsible=icon]:hidden">
          Fyodor
        </div>
        <div className="font-brand hidden text-center text-lg leading-none text-sidebar-foreground group-data-[collapsible=icon]:block">
          F
        </div>
        <p className="text-center text-[11px] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          A library of worlds.
        </p>
      </SidebarHeader>

      <SidebarSeparator />

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
      <SidebarRail />
    </Sidebar>
  )
}
