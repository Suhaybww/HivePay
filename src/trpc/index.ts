import { router } from './trpc';
import { authRouter } from './routers/auth';
import { subscriptionRouter } from './routers/subscription';
import { groupRouter } from './routers/group';
import { userRouter } from './routers/user';
import { supportRouter } from './routers/support';
import { contractRouter } from './routers/contract';
import { paymentRouter } from './routers/payment';
import { invitationRouter } from './routers/invitation';


export const appRouter = router({
  auth: authRouter,
  subscription: subscriptionRouter,
  group: groupRouter,
  user: userRouter,
  support: supportRouter,
  contract: contractRouter,
  payment: paymentRouter,
  invitation: invitationRouter,
});

export type AppRouter = typeof appRouter;
