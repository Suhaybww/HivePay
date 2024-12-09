import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { TRPCError, initTRPC } from '@trpc/server';
import { CreateNextContextOptions } from '@trpc/server/adapters/next';

// Update Context type to remove IP
export type Context = {
  userId?: string;
  user?: any;
  req?: CreateNextContextOptions['req'];
  res?: CreateNextContextOptions['res'];
};

// Add context creator
export async function createContext({ req, res }: CreateNextContextOptions): Promise<Context> {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  return {
    req,
    res,
    userId: user?.id,
    user,
  };
}

export const t = initTRPC.context<Context>().create();
export const middleware = t.middleware; // Export middleware

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
    },
  });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const privateProcedure = t.procedure.use(isAuth);
