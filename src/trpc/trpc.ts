import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { TRPCError, initTRPC } from '@trpc/server'

const t = initTRPC.create()
const middleware = t.middleware

// Middleware to check if the user is authenticated
const isAuth = middleware(async (opts: { next: (args: { ctx: { userId: string, user: any } }) => any }) => {
 const { getUser } = getKindeServerSession()
 const user = await getUser()

 // Throw an unauthorized error if the user is not authenticated
 if (!user || !user.id) {
   throw new TRPCError({ code: 'UNAUTHORIZED' })
 }

 // Pass the user ID and user object to the context for further use
 return opts.next({
   ctx: {
     userId: user.id,
     user,
   },
 })
})

export const router = t.router
export const publicProcedure = t.procedure
export const privateProcedure = t.procedure.use(isAuth)