import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Button } from './ui/button'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Icons } from './Icons'
import Link from 'next/link'
import { 
  Gem, 
  Settings,
  LayoutDashboard,
  WalletCards,
} from 'lucide-react'
import { LogoutLink } from '@kinde-oss/kinde-auth-nextjs/server'
import { SubscriptionStatus } from '@prisma/client'

interface UserAccountNavProps {
  email: string
  name: string
  subscriptionStatus: SubscriptionStatus
}

const UserAccountNav = ({
  email,
  name,
  subscriptionStatus,
}: UserAccountNavProps) => {
  const isSubscribed = subscriptionStatus === 'Active' || subscriptionStatus === 'PendingCancel'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        className='overflow-visible'>
        <Button className='rounded-full h-8 w-8 aspect-square bg-slate-400'>
          <Avatar className='relative w-8 h-8'>
            <AvatarFallback>
              <span className='sr-only'>{name}</span>
              <Icons.user className='h-4 w-4 text-zinc-900' />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className='bg-white' align='end'>
        <div className='flex items-center justify-start gap-2 p-2'>
          <div className='flex flex-col space-y-0.5 leading-none'>
            {name && (
              <p className='font-medium text-sm text-black'>
                {name}
              </p>
            )}
            {email && (
              <p className='w-[200px] truncate text-xs text-zinc-700'>
                {email}
              </p>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href='/dashboard' className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href='/settings' className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          {isSubscribed ? (
            <Link href='/billing' className="flex items-center gap-2">
              <WalletCards className="h-4 w-4" />
              {subscriptionStatus === 'PendingCancel' ? 'Reactivate Subscription' : 'Manage Subscription'}
            </Link>
          ) : (
            <Link href='/pricing' className="flex items-center gap-2">
              Upgrade{' '}
              <Gem className='text-violet-600 h-4 w-4 ml-1.5' />
            </Link>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem className='cursor-pointer'>
          <LogoutLink className="w-full flex items-center gap-2">
            Log out
          </LogoutLink>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UserAccountNav