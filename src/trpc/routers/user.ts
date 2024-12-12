import { privateProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { MembershipStatus, PaymentStatus, GroupStatus, SubscriptionStatus, OnboardingStatus } from '@prisma/client';
import { z } from "zod";
import { stripe } from '../../lib/stripe';

export const userRouter = router({
  getRecentActivity: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    try {
      const recentActivity = await db.transaction.findMany({
        where: {
          OR: [
            { userId },
            {
              group: {
                groupMemberships: {
                  some: {
                    userId,
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

  getCurrentUser: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          gender: true,
          age: true,
          stripeCustomerId: true,
          stripeAccountId: true,
          subscriptionStatus: true,
          stripeSubscriptionId: true,
          stripePriceId: true,
          stripeCurrentPeriodEnd: true,
          onboardingStatus: true,
          onboardingDate: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      // Transform null values to undefined
      const formattedUser = {
        ...user,
        gender: user.gender ?? undefined,
        age: user.age ?? undefined,
        stripeCustomerId: user.stripeCustomerId ?? undefined,
        stripeAccountId: user.stripeAccountId ?? undefined,
      };

      return formattedUser;
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch current user',
      });
    }
  }),

  getUserStats: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    try {
      const groupCount = await db.groupMembership.count({
        where: {
          userId,
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

  getUserSetupStatus: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          onboardingStatus: true,
          becsSetupStatus: true,
        },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      return {
        stripeOnboardingStatus: user.onboardingStatus,
        becsSetupStatus: user.becsSetupStatus,
      };
    } catch (error) {
      console.error('Failed to fetch user setup status:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch user setup status',
      });
    }
  }),

  getSavingsStats: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    try {
      // Get all successful payments
      const payments = await db.payment.findMany({
        where: {
          userId,
          status: PaymentStatus.Successful,
        },
        include: {
          group: {
            include: {
              groupMemberships: true,
            },
          },
        },
      });

      // Calculate total contributions
      const totalContributed = payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0
      );

      // Get active groups and their expected payouts
      const activeGroups = await db.group.findMany({
        where: {
          groupMemberships: {
            some: {
              userId,
              status: MembershipStatus.Active,
            },
          },
        },
        include: {
          groupMemberships: true,
        },
      });

      // Calculate expected payouts
      const expectedPayout = activeGroups.reduce((sum, group) => {
        const contributionAmount = Number(group.contributionAmount || 0);
        const memberCount = group.groupMemberships.length;
        return sum + (contributionAmount * memberCount);
      }, 0);

      return {
        totalContributed,
        expectedPayout,
      };
    } catch (error) {
      console.error('Failed to fetch savings stats:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch savings stats',
      });
    }
  }),

  getPaymentHistory: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    try {
      const payments = await db.payment.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          group: true,
        },
      });

      // Calculate monthly average
      const monthlyPayments = payments.reduce((acc, payment) => {
        const month = payment.createdAt.getMonth();
        const year = payment.createdAt.getFullYear();
        const key = `${year}-${month}`;
        
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(payment);
        return acc;
      }, {} as Record<string, typeof payments>);

      const monthlyAverages = Object.values(monthlyPayments).map(monthPayments => 
        monthPayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
      );

      const averageMonthlyPayment = monthlyAverages.length > 0
        ? monthlyAverages.reduce((sum, amount) => sum + amount, 0) / monthlyAverages.length
        : 0;

      return {
        payments,
        averageMonthlyPayment,
        successRate: payments.length > 0 
          ? (payments.filter(p => p.status === PaymentStatus.Successful).length / payments.length) * 100 
          : 0
      };
    } catch (error) {
      console.error('Failed to fetch payment history:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch payment history',
      });
    }
  }),


  deleteAccount: privateProcedure
  .input(
    z.object({
      reason: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { userId } = ctx;
  
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          stripeSubscriptionId: true,
          stripeCustomerId: true,
          email: true,
        },
      });
  
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }
  
      // Check for active group memberships with cycleStarted condition
      const activeGroupMemberships = await db.groupMembership.findMany({
        where: {
          userId,
          status: MembershipStatus.Active,
          group: {
            cycleStarted: true,
          },
        },
        select: {
          id: true,
          groupId: true,
          group: {
            select: {
              id: true,
              name: true,
              cycleStarted: true,
            },
          },
        },
      });
  
      const activeGroupsWithStartedCycle = activeGroupMemberships.filter(
        membership => membership.group?.cycleStarted
      );
  
      if (activeGroupsWithStartedCycle.length > 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot delete account while you have active groups with started cycles. Please leave these groups first.',
        });
      }
  
      // Start a transaction for soft deletion
      await db.$transaction(async (tx) => {
        // Cancel Stripe subscription if exists
        if (user.stripeCustomerId) {
          try {
            const subscriptions = await stripe.subscriptions.list({
              customer: user.stripeCustomerId,
              status: 'active',
            });
  
            // Cancel all active subscriptions
            for (const subscription of subscriptions.data) {
              try {
                await stripe.subscriptions.cancel(subscription.id);
              } catch (stripeError) {
                console.error(`Failed to cancel subscription ${subscription.id}:`, stripeError);
              }
            }
          } catch (stripeError) {
            console.error('Failed to list/cancel Stripe subscriptions:', stripeError);
          }
        }
  
        // Update groups where user is admin but cycle hasn't started
        await tx.group.updateMany({
          where: {
            createdById: userId,
            cycleStarted: false,
          },
          data: {
            status: GroupStatus.Paused,
          },
        });
  
        // Mark group memberships as inactive
        await tx.groupMembership.updateMany({
          where: { userId },
          data: { status: MembershipStatus.Inactive },
        });
  
        // Cancel subscriptions in database
        await tx.subscription.updateMany({
          where: { userId },
          data: { 
            status: SubscriptionStatus.Canceled,
            endDate: new Date()
          },
        });
  
        // Update user state
        await tx.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: SubscriptionStatus.Canceled,
            email: `deleted_${user.email}_${Date.now()}`,
            stripeCustomerId: null,
            stripeAccountId: null,
            stripeSubscriptionId: null,
            stripePriceId: null,
            stripeSetupIntentId: null,
            stripeBecsPaymentMethodId: null,
            stripeMandateId: null,
            onboardingStatus: OnboardingStatus.Failed,
            // Flag as deleted in database
            isDeleted: true,
            deletedAt: new Date(),
            deletionReason: input.reason,
          },
        });
      });
  
      return { 
        success: true, 
        message: 'Account successfully deactivated',
        isLogoutRequired: true
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      
      console.error('Failed to delete account:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete account. Please try again or contact support.',
      });
    }
  }),

canDeleteAccount: privateProcedure
.query(async ({ ctx }) => {
  const { userId } = ctx;

  try {
    // Check for active memberships in groups with started cycles
    const activeGroupMemberships = await db.groupMembership.count({
      where: {
        userId,
        status: MembershipStatus.Active,
        group: {
          cycleStarted: true,
        },
      },
    });

    // Check for created groups with active cycles
    const activeGroupsCreated = await db.group.count({
      where: {
        createdById: userId,
        cycleStarted: true,
        groupMemberships: {
          some: {
            status: MembershipStatus.Active,
          },
        },
      },
    });

    const canDelete = activeGroupMemberships === 0 && activeGroupsCreated === 0;

    return {
      canDelete,
      hasActiveGroupMemberships: activeGroupMemberships > 0,
      hasActiveCreatedGroups: activeGroupsCreated > 0,
    };
  } catch (error) {
    console.error('Failed to check account deletion status:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to check account deletion status',
    });
  }
}),


updateProfile: privateProcedure
.input(
  z.object({
    firstName: z.string().min(2, "First name must be at least 2 characters.").optional(),
    lastName: z.string().min(2, "Last name must be at least 2 characters.").optional(),
    phoneNumber: z.string().min(10, "Phone number must be at least 10 characters.").optional(),
    age: z.number().optional(),
    gender: z.enum(["Male", "Female"]).optional(),
  })
)
.mutation(async ({ ctx, input }) => {
  const { userId } = ctx;

  try {
    // Only include fields that were actually provided in the input
    const updateData = {
      ...(input.firstName && { firstName: input.firstName }),
      ...(input.lastName && { lastName: input.lastName }),
      ...(input.phoneNumber && { phoneNumber: input.phoneNumber }),
      ...(input.age && { age: input.age }),
      ...(input.gender && { gender: input.gender }),
    };

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    return updatedUser;
  } catch (error) {
    console.error('Failed to update user profile:', error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update profile',
    });
  }
})

});

export type UserRouter = typeof userRouter;
