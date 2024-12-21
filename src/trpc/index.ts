import { router } from './trpc';
import { authRouter } from './routers/auth';
import { subscriptionRouter } from './routers/subscription';
import { groupRouter } from './routers/group'; 
import { userRouter } from './routers/user';
import { supportRouter } from './routers/support';
import { contractRouter } from './routers/contract';
import { paymentRouter } from './routers/payment';
import { invitationRouter } from './routers/invitation';
import { cycleRouter } from './routers/cycle';   
import { stripeRouter } from './routers/stripe';

export const appRouter = router({
  auth: authRouter,
  subscription: subscriptionRouter,
  group: groupRouter,
  user: userRouter,
  support: supportRouter,
  contract: contractRouter,
  payment: paymentRouter,
  invitation: invitationRouter,
  cycle: cycleRouter,      
  stripe: stripeRouter,    
});

export type AppRouter = typeof appRouter;
