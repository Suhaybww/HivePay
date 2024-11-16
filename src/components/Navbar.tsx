import Link from 'next/link'
import MaxWidthWrapper from './MaxWidthWrapper'
import { buttonVariants } from './ui/button'
import {
  LoginLink,
  RegisterLink,
  getKindeServerSession,
} from '@kinde-oss/kinde-auth-nextjs/server'
import { ArrowRight } from 'lucide-react'
import UserAccountNav from './UserAccountNav'
import MobileNav from './MobileNav'
import { db } from '@/src/db'
import Image from 'next/image'

const Navbar = async () => {
  const { getUser } = getKindeServerSession()
  const kindeUser = await getUser()

  const user = kindeUser ? await db.user.findUnique({
    where: { id: kindeUser.id }
  }) : null

  return (
    <nav className='sticky h-14 inset-x-0 top-0 z-30 w-full border-b border-gray-200 bg-white/75 backdrop-blur-lg transition-all'>
      <MaxWidthWrapper>
        <div className='flex h-14 items-center justify-between'>
          <Link href='/' className='flex items-center z-40 space-x-2'>
            {/* HivePay Logo */}
            <div className="relative w-20 h-20">
              <Image
                src='/images/HivePay.svg'
                alt='HivePay Logo'
                fill
                className='object-contain'
                priority
              />
            </div>
            {/* Text */}
            <span className='text-2xl font-semibold text-gray-900'>HivePay</span>
          </Link>

          <MobileNav isAuth={!!user} />

          <div className='hidden items-center space-x-4 sm:flex'>
            {!user ? (
              <>
                <Link
                  href='/pricing'
                  className={buttonVariants({
                    variant: 'ghost',
                    size: 'sm',
                  })}>
                  Pricing
                </Link>
                <LoginLink
                  className={buttonVariants({
                    variant: 'ghost',
                    size: 'sm',
                  })}>
                  Sign in
                </LoginLink>
                <RegisterLink
                  className={buttonVariants({
                    size: 'sm',
                  })}>
                  Get started{' '}
                  <ArrowRight className='ml-1.5 h-5 w-5' />
                </RegisterLink>
              </>
            ) : (
              <UserAccountNav
                name={`${user.firstName} ${user.lastName}`}
                email={user.email}
                subscriptionStatus={user.subscriptionStatus}
              />
            )}
          </div>
        </div>
      </MaxWidthWrapper>
    </nav>
  )
}

export default Navbar