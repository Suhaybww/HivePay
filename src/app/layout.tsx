// src/app/layout.tsx
import Navbar from '../components/Navbar'
import Providers from '../components/Providers'
import { cn, constructMetadata } from '../lib/utils'
import { Inter } from 'next/font/google'
import './globals.css'
import SideNav from '@/src/components/SideNav'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { db } from '@/src/db'
import 'react-loading-skeleton/dist/skeleton.css'
import 'simplebar-react/dist/simplebar.min.css'
import { headers } from 'next/headers'
import { Toaster } from '../components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata = constructMetadata()

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { getUser } = getKindeServerSession()
  const kindeUser = await getUser()
  const headersList = headers()
  const pathname = headersList.get("x-invoke-path") || ""

  const user = kindeUser ? await db.user.findUnique({
    where: { id: kindeUser.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      subscriptionStatus: true
    }
  }) : null

  const protectedRoutes = ['/dashboard', '/groups', '/messages', '/payments', '/analytics', '/settings', '/onboarding']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isPricingPage = pathname.startsWith('/pricing')

  return (
    <html lang='en' className='light'>
      <Providers>
        <body
          className={cn(
            'min-h-screen font-sans antialiased grainy',
            inter.className
          )}>
          <Toaster />
          {/* Only show Navbar if:
              1. User is not logged in OR
              2. Not on a protected route AND not on pricing page when logged in */}
          {(!user || (!isProtectedRoute && !isPricingPage)) && <Navbar />}
          {/* Show SideNav when:
              1. User is logged in AND (on protected route OR pricing page) */}
          {user && (isProtectedRoute || isPricingPage) && <SideNav user={user} />}
          <div className={cn(user && (isProtectedRoute || isPricingPage) ? "md:pl-64" : "")}>
            {children}
          </div>
        </body>
      </Providers>
    </html>
  )
}