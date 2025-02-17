import { PLANS } from '../config/stripe';
import { db } from '../db';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import Stripe from 'stripe';

// Verify environment
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY missing from environment');
}


export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-01-27.acacia',
  typescript: true,
});

export async function getUserSubscriptionPlan() {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if (!user || !user.id) {
    return {
      ...PLANS[0],
      isSubscribed: false,
      stripeCustomerId: null,
      stripePriceId: null,
    };
  }

  const dbUser = await db.user.findFirst({
    where: {
      id: user.id,
    },
  });

  if (!dbUser) {
    return {
      ...PLANS[0],
      isSubscribed: false,
      stripeCustomerId: null,
      stripePriceId: null,
    };
  }

  const isSubscribed = Boolean(dbUser.stripePriceId);

  const plan = isSubscribed
    ? PLANS.find((plan: typeof PLANS[0]) => plan.price.priceIds.test === dbUser.stripePriceId)
    : null;

  return {
    ...plan,
    stripeCustomerId: dbUser.stripeCustomerId,
    stripePriceId: dbUser.stripePriceId,
    isSubscribed,
  };
}