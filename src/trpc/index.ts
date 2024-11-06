import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { privateProcedure, publicProcedure, router } from './trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../db';
import { z } from 'zod';
import { Frequency, PayoutOrderMethod, SubscriptionStatus, MembershipStatus } from '@prisma/client';
import { absoluteUrl } from '../lib/utils';
import {
  getUserSubscriptionPlan,
  stripe,
} from '../lib/stripe'
import { PLANS } from '../config/stripe';

// Middleware to check for active subscription
const subscriptionCheck = async (userId: string) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      stripeSubscriptionId: true
    }
  });

  if (!user || user.subscriptionStatus !== 'Active' || !user.stripeSubscriptionId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This action requires an active subscription. Please upgrade your plan.',
    });
  }
};

export const appRouter = router({
  authCallback: publicProcedure.query(async () => {
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user || !user.id || !user.email) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    try {
      let dbUser = await db.user.findFirst({
        where: {
          id: user.id,
        },
      });

      let isNewUser = false;

      if (!dbUser) {
        dbUser = await db.user.create({
          data: {
            id: user.id,
            email: user.email,
            firstName: user.given_name ?? '',
            lastName: user.family_name ?? '',
            phoneNumber: '',
            passwordHash: '',
            subscriptionStatus: SubscriptionStatus.Inactive,
            emailVerified: false,
            idVerified: false,
            twoFactorEnabled: false,
            verificationMethod: null,
          },
        });

        isNewUser = true;
      }

      const needsOnboarding = !dbUser.phoneNumber;

      return { 
        success: true, 
        isNewUser: isNewUser,
        needsOnboarding: needsOnboarding 
      };
    } catch (error) {
      console.error('Error in authCallback:', error);
      throw new TRPCError({ 
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create/update user'
      });
    }
  }),

// src/app/_trpc/index.ts
createStripeSession: privateProcedure
.input(z.object({ planSlug: z.string() }))
.mutation(async ({ input, ctx }) => {
  const { planSlug } = input;
  const { userId } = ctx;

  if (!userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User ID is missing' });
  }

  const dbUser = await db.user.findFirst({
    where: { id: userId },
  });

  if (!dbUser) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not found in database' });
  }

  const billingUrl = absoluteUrl('/dashboard/billing');

  const plan = PLANS.find(plan => plan.slug === planSlug);
  if (!plan) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Plan not found' });
  }

  const priceId = process.env.NODE_ENV === 'production'
    ? plan.price.priceIds.production
    : plan.price.priceIds.test;

  if (!priceId) {
    console.error(`No price ID found for plan: ${planSlug}. NODE_ENV: ${process.env.NODE_ENV}`);
    console.error(`Available price IDs: ${JSON.stringify(plan.price.priceIds)}`);
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `No price ID found for plan: ${planSlug}` });
  }

  let stripeCustomer;
  
  // Check if user already has a Stripe customer ID
  if (dbUser.stripeCustomerId) {
    stripeCustomer = await stripe.customers.retrieve(dbUser.stripeCustomerId);
  } else {
    // Create a new Stripe customer if they don't have one
    stripeCustomer = await stripe.customers.create({
      email: dbUser.email,
      metadata: {
        userId: dbUser.id,
      },
    });

    // Save the Stripe customer ID to the database
    await db.user.update({
      where: { id: userId },
      data: {
        stripeCustomerId: stripeCustomer.id,
      },
    });
  }

  const stripeSession = await stripe.checkout.sessions.create({
    customer: stripeCustomer.id,
    success_url: billingUrl,
    cancel_url: billingUrl,
    payment_method_types: ['card'],
    mode: 'subscription',
    billing_address_collection: 'auto',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      userId: userId,
      priceId: priceId,
      planSlug: planSlug,
    },
    subscription_data: {
      metadata: {
        userId: userId,
        priceId: priceId,
        planSlug: planSlug,
      },
    },
  });

  return { url: stripeSession.url };
}),

  updateUserDetails: publicProcedure
    .input(
      z.object({
        phoneNumber: z.string(),
        age: z.number().min(18).max(120).optional(),
        gender: z.enum(['Male', 'Female']).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { getUser } = getKindeServerSession();
      const user = await getUser();

      if (!user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      try {
        const updatedUser = await db.user.update({
          where: { id: user.id },
          data: {
            phoneNumber: input.phoneNumber,
            age: input.age,
            gender: input.gender,
          },
        });

        return {
          success: true,
          user: updatedUser,
        };
      } catch (error) {
        console.error('Failed to update user:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user details',
        });
      }
    }),

  // Get all groups for the current user
  getAllGroups: privateProcedure.query(async ({ ctx }) => {
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user?.id) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    try {
      return await db.group.findMany({
        where: {
          OR: [
            { createdById: user.id },
            {
              groupMemberships: {
                some: {
                  userId: user.id,
                  status: MembershipStatus.Active,
                },
              },
            },
          ],
        },
        include: {
          _count: {
            select: { groupMemberships: true },
          },
          groupMemberships: {
            where: {
              status: MembershipStatus.Active,
            },
          },
        },
      });
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch groups',
      });
    }
  }),

  // Get recent activity
  getRecentActivity: privateProcedure.query(async ({ ctx }) => {
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user?.id) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    try {
      // Fetch recent payments and member joins
      const recentActivity = await db.transaction.findMany({
        where: {
          OR: [
            { userId: user.id },
            {
              group: {
                groupMemberships: {
                  some: {
                    userId: user.id,
                    status: MembershipStatus.Active,
                  },
                },
              },
            },
          ],
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        include: {
          user: true,
          group: true,
        },
      });

      return recentActivity;
    } catch (error) {
      console.error('Failed to fetch recent activity:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch recent activity',
      });
    }
  }),

  // Get user stats
  getUserStats: privateProcedure.query(async ({ ctx }) => {
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user?.id) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    try {
      const groupCount = await db.groupMembership.count({
        where: {
          userId: user.id,
          status: MembershipStatus.Active,
        },
      });

      return {
        groupCount,
      };
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch user stats',
      });
    }
  }),

  createGroup: privateProcedure
    .input(
      z.object({
        name: z.string().min(3),
        description: z.string().optional(),
        contributionAmount: z.string(),
        contributionFrequency: z.enum(['Daily', 'Weekly', 'BiWeekly', 'Monthly', 'Custom']),
        payoutFrequency: z.enum(['Daily', 'Weekly', 'BiWeekly', 'Monthly', 'Custom']),
        payoutOrderMethod: z.enum(['Admin_Selected', 'First_Come_First_Serve']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { getUser } = getKindeServerSession();
      const user = await getUser();

      if (!user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      await subscriptionCheck(user.id);

      try {
        const userGroups = await db.group.count({
          where: {
            createdById: user.id
          }
        });

        if (userGroups >= 5) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You have reached the maximum number of groups you can create with your current plan.',
          });
        }

        const group = await db.group.create({
          data: {
            name: input.name,
            description: input.description,
            createdById: user.id,
            contributionAmount: parseFloat(input.contributionAmount),
            contributionFrequency: input.contributionFrequency as Frequency,
            payoutFrequency: input.payoutFrequency as Frequency,
            payoutOrderMethod: input.payoutOrderMethod as PayoutOrderMethod,
          },
        });

        await db.groupMembership.create({
          data: {
            groupId: group.id,
            userId: user.id,
            isAdmin: true,
            payoutOrder: 1,
            status: MembershipStatus.Active,
          },
        });

        return {
          success: true,
          group,
          redirectUrl: `/group/${group.id}`, // Added for redirection
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Failed to create group:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create group',
        });
      }
    }),

  joinGroup: privateProcedure
    .input(
      z.object({
        groupId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { getUser } = getKindeServerSession();
      const user = await getUser();

      if (!user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      await subscriptionCheck(user.id);

      try {
        const userMemberships = await db.groupMembership.count({
          where: {
            userId: user.id
          }
        });

        if (userMemberships >= 5) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You have reached the maximum number of groups you can join with your current plan.',
          });
        }

        const group = await db.group.findUnique({
          where: { id: input.groupId },
          include: {
            groupMemberships: true,
          },
        });

        if (!group) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Group not found',
          });
        }

        const existingMembership = await db.groupMembership.findFirst({
          where: {
            groupId: input.groupId,
            userId: user.id,
          },
        });

        if (existingMembership) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'You are already a member of this group',
          });
        }

        const membership = await db.groupMembership.create({
          data: {
            groupId: input.groupId,
            userId: user.id,
            isAdmin: false,
            payoutOrder: group.groupMemberships.length + 1,
            status: MembershipStatus.Active,
          },
        });

        return {
          success: true,
          membership,
          redirectUrl: `/group/${input.groupId}`, // Added for redirection
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to join group',
        });
      }
    }),

  checkSubscriptionStatus: privateProcedure
    .query(async ({ ctx }) => {
      const { getUser } = getKindeServerSession();
      const user = await getUser();

      if (!user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: {
          subscriptionStatus: true,
          stripeSubscriptionId: true
        }
      });

      return {
        isSubscribed: dbUser?.subscriptionStatus === 'Active' && !!dbUser?.stripeSubscriptionId,
        status: dbUser?.subscriptionStatus
      };
    }),

    
});

export type AppRouter = typeof appRouter;