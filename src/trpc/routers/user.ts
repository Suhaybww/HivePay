// trpc/routers/user.ts
import { privateProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { MembershipStatus } from '@prisma/client';

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
});

export type UserRouter = typeof userRouter;
