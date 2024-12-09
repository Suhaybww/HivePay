import { TRPCError } from '@trpc/server';
import { db } from '../db';
import { middleware } from './trpc';
import type { Context } from './trpc';

// Middleware to check if the user has an active subscription
export const subscriptionCheck = async (userId: string) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      stripeSubscriptionId: true,
    },
  });

  if (!user || user.subscriptionStatus !== 'Active' || !user.stripeSubscriptionId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This action requires an active subscription. Please upgrade your plan.',
    });
  }
};

// Middleware for subscription check only
export const withSubscription = middleware(async (opts) => {
  const { ctx } = opts;

  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // Perform subscription check
  await subscriptionCheck(ctx.userId);

  return opts.next({
    ctx,
  });
});
