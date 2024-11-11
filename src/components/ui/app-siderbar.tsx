
"use client"

import * as React from "react"
import {
  Bot,
  Command,
  CreditCard,
  Frame,
  LifeBuoy,
  Map,
  PieChart,
  Send,
  Settings2,
  SquareTerminal,
} from "lucide-react"

import { NavMain } from "./nav-main"
import { NavProjects } from "./nav-projects"
import { NavSecondary } from "./nav-secondary"
import { NavUser } from "./nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/src/components/ui/sidebar"

interface UserProps {
  firstName: string | null
  lastName: string | null
  email: string
  avatarUrl?: string
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: UserProps
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const data = {
    user: {
      name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
      email: user.email,
      avatar: user.avatarUrl ?? "/avatars/default.jpg",
    },
    navMain: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: SquareTerminal,
        isActive: true,
        items: [],
      },
      {
        title: "Groups",
        url: "/groups",
        icon: Bot,
        items: [],
      },
      {
        title: "Payments",
        url: "/payments",
        icon: CreditCard,
        items: [],
      },
      {
        title: "Settings",
        url: "/settings",
        icon: Settings2,
        items: [],
      },
    ],
    navSecondary: [
      {
        title: "Support",
        url: "#",
        icon: LifeBuoy,
      },
      {
        title: "Feedback",
        url: "#",
        icon: Send,
      },
    ],
    projects: [
      {
        name: "Project One",
        url: "#",
        icon: Frame,
      },
      {
        name: "Project Two",
        url: "#",
        icon: PieChart,
      },
      {
        name: "Project Three",
        url: "#",
        icon: Map,
      },
    ],
  }

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Roundly</span>
                  <span className="truncate text-xs">Dashboard</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
