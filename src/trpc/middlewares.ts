import { TRPCError } from '@trpc/server';
import { db } from '../db';

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
