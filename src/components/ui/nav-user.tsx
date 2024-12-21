"use client"

import React from 'react'
import Link from 'next/link'
import {
  ChevronsUpDown,
  LogOut,
  Gem,
  Settings,
  WalletCards,
} from "lucide-react"
import { LogoutLink } from '@kinde-oss/kinde-auth-nextjs'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/src/components/ui/sidebar"

interface NavUserProps {
  name: string
  email: string
  picture?: string | null
  subscriptionStatus: 'Active' | 'Inactive' | 'Canceled'
}

const NavUser: React.FC<NavUserProps> = ({
  name,
  email,
  picture,
  subscriptionStatus,
}) => {
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex items-center"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={picture || undefined} alt={name} />
                <AvatarFallback className="rounded-lg">
                  {name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="ml-2 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{name}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 rounded-lg bg-white shadow-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={picture || undefined} alt={name} />
                  <AvatarFallback>
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold">{name}</span>
                  <span className="text-xs text-muted-foreground">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
              <Link
              href={
                subscriptionStatus === 'Active' ? '/settings?section=billing' : '/pricing'
              }
              className="flex items-center gap-2 p-2"
            >
              {subscriptionStatus === 'Active' ? (
                <>
                  <WalletCards className="h-4 w-4" />
                  Manage Subscription
                </>
              ) : (
                <>
                  <Gem className="h-4 w-4 text-yellow-400" />
                  Upgrade to Pro
                </>
              )}
            </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <LogoutLink className="flex items-center gap-2 p-2 w-full">
                <LogOut className="h-4 w-4" />
                Log out
              </LogoutLink>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export default NavUser
