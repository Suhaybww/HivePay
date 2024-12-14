'use client';

import * as React from "react";
import Image from 'next/image';
import {
  Users,
  CreditCard,
  LifeBuoy,
  Send,
  Settings2,
  SquareTerminal,
} from "lucide-react";

import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import NavUser from "./nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/src/components/ui/sidebar";

// Update UserProps to match your schema's SubscriptionStatus
interface UserProps {
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl?: string;
  subscriptionStatus: "Active" | "PendingCancel" | "Inactive" | "Canceled";
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: UserProps;
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  // Map the subscription status to what NavUser expects
  const mapSubscriptionStatus = (status: UserProps['subscriptionStatus']): "Active" | "Inactive" | "Canceled" => {
    switch (status) {
      case "Active":
        return "Active";
      case "PendingCancel":
        return "Active"; // Treat pending cancellations as still active
      case "Canceled":
        return "Canceled";
      case "Inactive":
      default:
        return "Inactive";
    }
  };

  const data = {
    user: {
      name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
      email: user.email,
      avatar: user.avatarUrl ?? "/avatars/default.jpg",
      subscriptionStatus: mapSubscriptionStatus(user.subscriptionStatus),
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
        icon: Users,
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
  };

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/dashboard" className="flex items-center gap-3 px-2">
                <div className="relative flex aspect-square size-10 items-center justify-center">
                  <Image
                    src="/images/HivePay.svg"
                    alt="HivePay Logo"
                    width={40}
                    height={40}
                    className="transform scale-150"
                    style={{
                      filter: "drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.1))",
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
  );
}