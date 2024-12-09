import { privateProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { z } from 'zod';
import { absoluteUrl } from '../../lib/utils';
import { stripe } from '../../lib/stripe';
import { PLANS } from '../../config/stripe';

export const subscriptionRouter = router({
  createStripeSession: privateProcedure
    .input(z.object({ planSlug: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { planSlug } = input;
      const { userId } = ctx;

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User ID is missing' });
      }

      const dbUser = await db.user.findFirst({ where: { id: userId } });

      if (!dbUser) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not found in database' });
      }

      const billingUrl = absoluteUrl('/dashboard');
      const plan = PLANS.find((plan) => plan.slug === planSlug);
      if (!plan) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Plan not found' });
      }

      const priceId =
        process.env.NODE_ENV === 'production'
          ? plan.price.priceIds.production
          : plan.price.priceIds.test;

      if (!priceId) {
        console.error(`No price ID for plan: ${planSlug}`);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `No price ID found for plan: ${planSlug}`,
        });
      }

      let stripeCustomer;
      if (dbUser.stripeCustomerId) {
        stripeCustomer = await stripe.customers.retrieve(dbUser.stripeCustomerId);
      } else {
        stripeCustomer = await stripe.customers.create({
          email: dbUser.email,
          metadata: { userId: dbUser.id },
        });

        await db.user.update({
          where: { id: userId },
          data: { stripeCustomerId: stripeCustomer.id },
        });
      }

      const stripeSession = await stripe.checkout.sessions.create({
        customer: stripeCustomer.id,
        success_url: billingUrl,
        cancel_url: billingUrl,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { 
          userId: userId,
          priceId: priceId,
          planSlug: planSlug 
        },
        subscription_data: {
          metadata: { 
            userId: userId,
            priceId: priceId,
            planSlug: planSlug 
          },
        },
      });

      return { url: stripeSession.url };
    }),

  checkSubscriptionStatus: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    const dbUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        stripeSubscriptionId: true,
      },
    });

    return {
      isSubscribed:
        dbUser?.subscriptionStatus === 'Active' && !!dbUser?.stripeSubscriptionId,
      status: dbUser?.subscriptionStatus,
    };
  }),
});

export type SubscriptionRouter = typeof subscriptionRouter;
