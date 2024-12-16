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
import { redirect } from 'next/navigation'
import { SubscriptionStatus } from '@prisma/client'

// Define the types based on your schema
type UserProps = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl?: string;
  subscriptionStatus: SubscriptionStatus;
}

const inter = Inter({ subsets: ['latin'] })

export const metadata = constructMetadata()

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { getUser } = getKindeServerSession();
  const kindeUser = await getUser();
  const headersList = headers();
  const pathname = headersList.get('x-invoke-path') || '';

  const protectedRoutes = [
    '/dashboard',
    '/groups',
    '/messages',
    '/payments',
    '/analytics',
    '/settings',
    '/onboarding',
  ];

  const companyRoutes = [
    '/company/contact',
    '/company/about',
    '/company/faqs',
    '/company/pricing',
  ];

  // Check if current path is a protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  
  const isCompanyRoute = companyRoutes.some((route) => 
    pathname.startsWith(route)
  );

  // If user tries to access protected route without authentication, redirect to sign in
  if (isProtectedRoute && !kindeUser) {
    redirect('/sign-in');
  }

  // Only fetch user data if we have a Kinde user
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
    : null;

  // If we have a Kinde user but no DB user on a protected route, redirect to onboarding
  if (isProtectedRoute && kindeUser && !user) {
    redirect('/onboarding');
  }

  // Early return for public layout if no user or no DB user
  if (!user) {
    return (
      <html lang="en" className="light">
        <body className={cn('min-h-screen bg-background', inter.className)}>
          <Providers>
            <Toaster />
            <Navbar />
            <main className="flex-1">
              <div className="container max-w-7xl mx-auto p-8">{children}</div>
            </main>
            <Footer />
          </Providers>
        </body>
      </html>
    );
  }

  // At this point, user is guaranteed to be non-null
  const sidebarUser: UserProps = {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    subscriptionStatus: user.subscriptionStatus
  };

  return (
    <html lang="en" className="light">
      <body className={cn('min-h-screen bg-background', inter.className)}>
        <Providers>
          <Toaster />
          <SidebarProvider>
            <AppSidebar user={sidebarUser} />
            <SidebarInset>
              <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center px-4">
                  <SidebarTrigger className="-ml-1" />
                </div>
              </header>
              <main className="flex-1">
                <div className="px-8 py-6">{children}</div>
              </main>
            </SidebarInset>
          </SidebarProvider>
        </Providers>
      </body>
    </html>
  );
}