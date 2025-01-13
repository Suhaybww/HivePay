import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { TRPCError, initTRPC } from '@trpc/server';
import { db } from '@/src/db';

// Updated Context type without NextApiRequest/Response
export type Context = {
  userId?: string;
  user?: any;
  db: typeof db;
  headers?: Headers;
};

// Updated createContext to accept a Request
export async function createContext(opts: { headers?: Headers } = {}): Promise<Context> {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  return {
    userId: user?.id,
    user,
    db,
    headers: opts.headers,
  };
}

export const t = initTRPC.context<Context>().create();
export const middleware = t.middleware;

const isAuth = middleware(async (opts) => {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if (!user || !user.id) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      userId: user.id,
      user,
      db: opts.ctx.db,
    },
  });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const privateProcedure = t.procedure.use(isAuth);