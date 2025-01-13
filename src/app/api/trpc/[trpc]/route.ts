import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/src/trpc'
import { createContext } from '@/src/trpc/trpc'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext({ headers: req.headers }),
  })

export { handler as GET, handler as POST }