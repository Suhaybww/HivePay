import { privateProcedure, publicProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { z } from 'zod';
import { stripe } from '../../lib/stripe';

export const stripeRouter = router({
  createStripeConnectAccount: privateProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId } = input;

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
      }

      // Fetch user data
      const dbUser = await db.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          firstName: true,
          lastName: true,
          stripeAccountId: true,
        },
      });

      if (!dbUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      try {
        let accountId = dbUser.stripeAccountId;

        if (!accountId) {
          // Create an Express Connect account
          const account = await stripe.accounts.create({
            type: 'express',
            country: 'AU',
            email: dbUser.email,
            business_type: 'individual',
            individual: {
              first_name: dbUser.firstName,
              last_name: dbUser.lastName,
            },
            capabilities: {
              transfers: { requested: true },
              card_payments: { requested: true },
            },
            settings: {
              payouts: {
                schedule: {
                  delay_days: 2,
                },
              },
            },
          });

          accountId = account.id;

          // Save to DB
          await db.user.update({
            where: { id: userId },
            data: {
              stripeAccountId: accountId,
              onboardingStatus: 'Pending',
              onboardingDate: null,
            },
          });
        }

        // Build the link that returns user specifically to ?tab=settings
        const accountLink = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/groups/${groupId}?tab=settings&onboarding=failed`,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/groups/${groupId}?tab=settings&onboarding=completed`,
          type: 'account_onboarding',
        });

        return { url: accountLink.url };
      } catch (error) {
        console.error('Stripe Connect account creation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create Stripe Connect account',
        });
      }
    }),

  getStripeDashboardLink: privateProcedure.mutation(async ({ ctx }) => {
    const { userId } = ctx;

    // Fetch the user's Stripe Connect account ID
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        stripeAccountId: true,
        onboardingStatus: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    if (!user.stripeAccountId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No Stripe Connect account found for this user',
      });
    }

    if (user.onboardingStatus !== 'Completed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Please complete your Stripe Connect onboarding first',
      });
    }

    try {
      // Create a login link for the connected account
      const loginLink = await stripe.accounts.createLoginLink(user.stripeAccountId);
      return { url: loginLink.url };
    } catch (error) {
      console.error('Error creating Stripe login link:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create Stripe dashboard login link',
      });
    }
  }),

  getStripeAccountStatus: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        stripeAccountId: true,
        onboardingStatus: true,
      },
    });

    if (!user || !user.stripeAccountId) {
      return {
        hasConnectedAccount: false,
        isOnboardingComplete: false,
      };
    }

    try {
      // Fetch the account details from Stripe
      const account = await stripe.accounts.retrieve(user.stripeAccountId);

      return {
        hasConnectedAccount: true,
        isOnboardingComplete: Boolean(account.details_submitted && account.charges_enabled),
        accountStatus: {
          detailsSubmitted: account.details_submitted ?? false,
          chargesEnabled: account.charges_enabled ?? false,
          payoutsEnabled: account.payouts_enabled ?? false,
          currentlyDue: account.requirements?.currently_due ?? [],
          pastDue: account.requirements?.past_due ?? [],
          eventuallyDue: account.requirements?.eventually_due ?? [],
          pendingVerification: account.requirements?.pending_verification ?? [],
        },
      };
    } catch (error) {
      console.error('Error fetching Stripe account status:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch Stripe account status',
      });
    }
  }),

  setupBECSDirectDebit: privateProcedure.mutation(async ({ ctx }) => {
    const { userId } = ctx;

    if (!userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
    }

    // Fetch user with existing BECS setup info
    const dbUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        stripeCustomerId: true,
        email: true,
        stripeBecsPaymentMethodId: true,
        stripeMandateId: true,
        becsSetupStatus: true,
      },
    });

    if (!dbUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    let stripeCustomerId = dbUser.stripeCustomerId;

    // Create Stripe Customer if needed
    if (!stripeCustomerId) {
      try {
        const customer = await stripe.customers.create({
          email: dbUser.email,
          metadata: { userId },
        });
        stripeCustomerId = customer.id;

        await db.user.update({
          where: { id: userId },
          data: { stripeCustomerId },
        });
      } catch (error) {
        console.error(`Failed to create Stripe customer for user ${userId}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create Stripe customer',
        });
      }
    }

    try {
      // Create a new SetupIntent (for initial or updated setup)
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['au_becs_debit'],
        usage: 'off_session',
      });

      await db.user.update({
        where: { id: userId },
        data: {
          stripeSetupIntentId: setupIntent.id,
          becsSetupStatus: 'Pending',
        },
      });

      return {
        success: true,
        setupIntentClientSecret: setupIntent.client_secret,
        isUpdate: dbUser.becsSetupStatus === 'Completed',
      };
    } catch (error) {
      console.error(`Failed to create BECS setup intent for user ${userId}:`, error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create BECS setup intent',
      });
    }
  }),

  handleBECSSetupWebhook: privateProcedure
    .input(
      z.object({
        setupIntentId: z.string(),
        status: z.enum(['succeeded', 'failed']),
        paymentMethodId: z.string().optional(),
        mandateId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { setupIntentId, status, paymentMethodId, mandateId } = input;

      try {
        const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
        if (!setupIntent.customer) {
          throw new Error('No customer associated with SetupIntent');
        }

        const user = await db.user.findFirst({
          where: { stripeCustomerId: setupIntent.customer as string },
        });

        if (!user) {
          throw new Error('No user found for this SetupIntent');
        }

        if (status === 'succeeded' && paymentMethodId && mandateId) {
          await db.user.update({
            where: { id: user.id },
            data: {
              stripeBecsPaymentMethodId: paymentMethodId,
              stripeMandateId: mandateId,
              becsSetupStatus: 'Completed',
            },
          });
        } else {
          await db.user.update({
            where: { id: user.id },
            data: {
              becsSetupStatus: 'Failed',
            },
          });
        }

        return { success: true };
      } catch (error) {
        console.error('Failed to handle BECS setup webhook:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process BECS setup webhook',
        });
      }
    }),

  getBECSStatus: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        becsSetupStatus: true,
        stripeBecsPaymentMethodId: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return {
      status: user.becsSetupStatus,
      hasExistingSetup: user.stripeBecsPaymentMethodId !== null,
    };
  }),
});

export type StripeRouter = typeof stripeRouter;
