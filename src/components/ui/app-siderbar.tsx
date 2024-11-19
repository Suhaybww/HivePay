"use client"

import * as React from "react"
import {
  Bot,
  CreditCard,
  LifeBuoy,
  Send,
  Settings2,
  SquareTerminal,
} from "lucide-react"

import { NavMain } from "./nav-main"
import { NavSecondary } from "./nav-secondary"
import NavUser from "./nav-user"
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
  subscriptionStatus: 'Active' | 'Inactive' | 'Canceled'
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
      subscriptionStatus: user.subscriptionStatus,
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
        url: "/dashboard/support",
        icon: LifeBuoy,
      },
      {
        title: "Feedback",
        url: "/dashboard/feedback",
        icon: Send,
      },
    ],
  }

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/dashboard" className="flex items-center gap-3 px-2">
                <div className="flex aspect-square size-10 items-center justify-center">
                  <img 
                    src="/images/HivePay.svg" 
                    alt="HivePay Logo" 
                    className="w-10 h-10 transform scale-150"
                    style={{
                      filter: "drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.1))"
                    }}
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">HivePay</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          name={data.user.name}
          email={data.user.email}
          picture={data.user.avatar}
          subscriptionStatus={data.user.subscriptionStatus}
        />
      </SidebarFooter>
    </Sidebar>
  )
}