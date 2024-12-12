import { privateProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { z } from 'zod';
import { absoluteUrl } from '../../lib/utils';
import { stripe } from '../../lib/stripe';
import { PLANS } from '../../config/stripe';
import { SubscriptionStatus, GroupStatus } from '@prisma/client';

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


  cancelSubscription: privateProcedure
    .mutation(async ({ ctx }) => {
      const { userId } = ctx;

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      try {
        const user = await db.user.findUnique({
          where: { id: userId },
          select: { 
            stripeSubscriptionId: true,
            stripeCustomerId: true
          }
        });

        if (!user?.stripeSubscriptionId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No active subscription found',
          });
        }

        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

        if (subscription.status === 'active') {
          await stripe.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
        } else {
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        }

        await db.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: SubscriptionStatus.PendingCancel,
          },
        });

        return { success: true, message: 'Subscription will be canceled at the end of the billing period.' };
      } catch (error) {
        console.error('Failed to cancel subscription:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cancel subscription.',
        });
      }
    }),

  reactivateSubscription: privateProcedure
    .mutation(async ({ ctx }) => {
      const { userId } = ctx;

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      try {
        const user = await db.user.findUnique({
          where: { id: userId },
          select: { 
            stripeSubscriptionId: true,
            stripeCustomerId: true 
          }
        });

        if (!user?.stripeSubscriptionId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No subscription found',
          });
        }

        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

        if (!subscription.cancel_at_period_end) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Subscription is not scheduled for cancellation',
          });
        }

        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          cancel_at_period_end: false,
        });

        await db.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: SubscriptionStatus.Active,
          },
        });

        return { success: true, message: 'Subscription reactivated successfully.' };
      } catch (error) {
        console.error('Failed to reactivate subscription:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reactivate subscription.',
        });
      }
    }),

  reactivateGroup: privateProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      try {
        const group = await db.group.findUnique({
          where: { id: input.groupId },
          include: {
            groupMemberships: {
              include: {
                user: {
                  select: {
                    subscriptionStatus: true,
                  },
                },
              },
            },
          },
        });

        if (!group) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Group not found',
          });
        }

        const allMembersActive = group.groupMemberships.every(
          (membership) => membership.user.subscriptionStatus === SubscriptionStatus.Active
        );

        if (!allMembersActive) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'All members must have active subscriptions to reactivate the group',
          });
        }

        await db.group.update({
          where: { id: input.groupId },
          data: { status: GroupStatus.Active },
        });

        const notificationPromises = group.groupMemberships.map((membership) =>
          db.notification.create({
            data: {
              userId: membership.userId,
              content: `Group "${group.name}" has been reactivated.`,
            },
          })
        );

        await Promise.all(notificationPromises);

        return { success: true };
      } catch (error) {
        console.error('Failed to reactivate group:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reactivate group',
        });
      }
    }),
});

export type SubscriptionRouter = typeof subscriptionRouter;
