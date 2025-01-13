import { cn } from '@/src/lib/utils'
import { ReactNode } from 'react'

const SideBarWrapper = ({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) => {
  return (
<div className={cn('mx-auto w-full max-w-screen-2xl px-4 md:px-24', className)}>
  {children}
</div>

  )
}

export default SideBarWrapper