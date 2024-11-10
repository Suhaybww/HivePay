import { router } from './trpc';
import { authRouter } from './routers/auth';
import { subscriptionRouter } from './routers/subscription';
import { groupRouter } from './routers/group';
import { userRouter } from './routers/user';

export const appRouter = router({
  auth: authRouter,
  subscription: subscriptionRouter,
  group: groupRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
