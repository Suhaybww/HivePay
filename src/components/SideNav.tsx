// src/components/SideNav.tsx
"use client";

import { Sidebar, SidebarBody, SidebarLink } from "./ui/sidebar";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LogoutLink } from "@kinde-oss/kinde-auth-nextjs/components";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";

interface SideNavProps {
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    subscriptionStatus: 'Active' | 'Inactive' | 'Canceled';
  }
}

const SideNav = ({ user }: SideNavProps) => {
  const [open, setOpen] = useState(false);

  const links = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-5 w-5 text-neutral-700 dark:text-neutral-200 flex-shrink-0" />,
    },
    {
      label: "Groups",
      href: "/groups",
      icon: <Users className="h-5 w-5 text-neutral-700 dark:text-neutral-200 flex-shrink-0" />,
    },
    {
      label: "Messages",
      href: "/messages",
      icon: <MessageSquare className="h-5 w-5 text-neutral-700 dark:text-neutral-200 flex-shrink-0" />,
    },
    {
      label: "Payments",
      href: "/payments",
      icon: <CreditCard className="h-5 w-5 text-neutral-700 dark:text-neutral-200 flex-shrink-0" />,
    },
    user.subscriptionStatus === 'Active' && {
      label: "Analytics",
      href: "/analytics",
      icon: <BarChart3 className="h-5 w-5 text-neutral-700 dark:text-neutral-200 flex-shrink-0" />,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: <Settings className="h-5 w-5 text-neutral-700 dark:text-neutral-200 flex-shrink-0" />,
    },
  ].filter(Boolean);

  return (
    <div className="fixed left-0 top-0 h-full">
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link as any} />
              ))}
              
              <LogoutLink>
                <div className="flex items-center gap-2 py-2 group/sidebar hover:translate-x-1 transition duration-150">
                  <LogOut className="h-5 w-5 text-neutral-700 dark:text-neutral-200 flex-shrink-0" />
                  <motion.span
                    animate={{
                      display: open ? "inline-block" : "none",
                      opacity: open ? 1 : 0,
                    }}
                    className="text-neutral-700 dark:text-neutral-200 text-sm whitespace-pre"
                  >
                    Logout
                  </motion.span>
                </div>
              </LogoutLink>
            </div>
          </div>
          <div>
            <SidebarLink
              link={{
                label: `${user.firstName} ${user.lastName}`,
                href: "/settings",
                icon: (
                  <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {user.firstName?.[0]}
                      {user.lastName?.[0]}
                    </span>
                  </div>
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>
    </div>
  );
};

const Logo = () => {
  return (
    <Link
      href="/dashboard"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium text-black dark:text-white whitespace-pre"
      >
        Roundly.
      </motion.span>
    </Link>
  );
};

const LogoIcon = () => {
  return (
    <Link
      href="/dashboard"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    </Link>
  );
};

export default SideNav;