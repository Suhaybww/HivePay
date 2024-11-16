import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Providers from '../components/Providers'
import { cn, constructMetadata } from '../lib/utils'
import { Inter } from 'next/font/google'
import './globals.css'
import { AppSidebar } from '../components/ui/app-siderbar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../components/ui/sidebar'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { db } from '@/src/db'
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
  const pathname = headersList.get('x-invoke-path') || ''

  const user = kindeUser
    ? await db.user.findUnique({
        where: { id: kindeUser.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          subscriptionStatus: true,
        },
      })
    : null

  const protectedRoutes = [
    '/dashboard',
    '/groups',
    '/messages',
    '/payments',
    '/analytics',
    '/settings',
    '/onboarding',
  ]
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )
  const isPricingPage = pathname.startsWith('/pricing')
  const shouldShowDashboardLayout = user && (isProtectedRoute || isPricingPage)
  const shouldShowNavbarAndFooter = !user && !isProtectedRoute

  return (
    <html lang="en" className="light">
      <body className={cn('min-h-screen bg-background', inter.className)}>
        <Providers>
          <Toaster />
          
          {shouldShowDashboardLayout ? (
            <SidebarProvider>
              <AppSidebar user={user} />
              <SidebarInset>
                <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <div className="flex items-center px-4">
                    <SidebarTrigger className="-ml-1" />
                  </div>
                </header>
                <main className="flex-1">
                  <div className="px-8 py-6">
                    {children}
                  </div>
                </main>
              </SidebarInset>
            </SidebarProvider>
          ) : (
            <>
              {shouldShowNavbarAndFooter && <Navbar />}
              <main className="flex-1">
                <div className="container max-w-7xl mx-auto p-8">
                  {children}
                </div>
              </main>
              {shouldShowNavbarAndFooter && <Footer />}
            </>
          )}
        </Providers>
      </body>
    </html>
  )
}
