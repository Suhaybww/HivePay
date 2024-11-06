// src/components/layouts/DashboardLayout.tsx
import { ReactNode } from 'react'
import SideNav from '../SideNav'
import UserAccountNav from '../UserAccountNav'

interface DashboardLayoutProps {
  children: ReactNode
  user: {
    id: string; // Added this to match SideNav requirements
    firstName: string | null;
    lastName: string | null;
    email: string;
    subscriptionStatus: 'Active' | 'Inactive' | 'Canceled';
  }
}

const DashboardLayout = ({ children, user }: DashboardLayoutProps) => {
  return (
    <div className="flex h-screen">
      <SideNav user={user} />
      <div className="flex-1 overflow-auto">
        <header className="h-14 border-b border-gray-200 bg-white/75 backdrop-blur-lg">
          <div className="flex h-full items-center justify-end px-4">
            <UserAccountNav
              name={`${user.firstName} ${user.lastName}`}
              email={user.email}
              subscriptionStatus={user.subscriptionStatus}
            />
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}

export default DashboardLayout