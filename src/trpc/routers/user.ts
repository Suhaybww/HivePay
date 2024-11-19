import { privateProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { MembershipStatus, PaymentStatus } from '@prisma/client';

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

});

export type UserRouter = typeof userRouter;
