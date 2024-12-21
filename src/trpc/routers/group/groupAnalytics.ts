// src/trpc/routers/group/groupAnalytics.ts

import { privateProcedure, router } from '../../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { z } from 'zod';
import { MembershipStatus, PaymentStatus } from '@prisma/client';

export const groupAnalyticsRouter = router({
  // getGroupAnalytics: Provides various analytics about the group's performance over a timeframe
  getGroupAnalytics: privateProcedure
    .input(z.object({
      groupId: z.string(),
      timeframe: z.enum(['week', 'month', 'year']).default('month')
    }))
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, timeframe } = input;

      const startDate = new Date();
      const endDate = new Date();

      switch (timeframe) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const membership = await db.groupMembership.findFirst({
        where: { groupId, userId, status: MembershipStatus.Active },
      });

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this group' });
      }

      const [contributions, memberships, payouts, payments, historicalMembers] = await Promise.all([
        db.payment.groupBy({
          by: ['paymentDate'],
          where: { groupId, createdAt: { gte: startDate, lte: endDate } },
          _sum: { amount: true },
          _count: true,
        }),

        db.groupMembership.findMany({
          where: { groupId, status: MembershipStatus.Active },
          include: { user: { select: { firstName: true, lastName: true } } }
        }),

        db.payout.findMany({
          where: { groupId, createdAt: { gte: startDate, lte: endDate } },
          include: { user: { select: { firstName: true, lastName: true } } }
        }),

        db.payment.findMany({
          where: { groupId, createdAt: { gte: startDate, lte: endDate } },
          include: { user: true }
        }),

        db.groupMembership.groupBy({
          by: ['joinDate'],
          where: { groupId, joinDate: { gte: startDate, lte: endDate } },
          _count: true
        }),
      ]);

      const totalMembers = memberships.length;
      const previousCount = await db.groupMembership.count({
        where: { groupId, status: MembershipStatus.Active, joinDate: { lt: startDate } }
      });

      const memberGrowth = previousCount > 0 ? ((totalMembers - previousCount) / previousCount) * 100 : 100;
      const totalContributions = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const averageContribution = totalContributions / payments.length || 0;

      const onTimePayments = payments.filter(p =>
        new Date(p.paymentDate) <= new Date(p.createdAt)
      ).length;
      const onTimePaymentRate = (onTimePayments / payments.length) * 100 || 0;

      const leftMembers = await db.groupMembership.count({
        where: { groupId, status: MembershipStatus.Inactive, updatedAt: { gte: startDate, lte: endDate } }
      });
      const retentionRate = ((totalMembers - leftMembers) / totalMembers) * 100 || 0;

      const payoutTimes = payouts.map(p => {
        const scheduledDate = new Date(p.scheduledPayoutDate);
        const actualDate = new Date(p.createdAt);
        return Math.ceil((actualDate.getTime() - scheduledDate.getTime()) / (1000 * 3600 * 24));
      });
      const averagePayoutTime = payoutTimes.reduce((sum, t) => sum + t, 0) / payoutTimes.length || 0;

      const formattedContributions = contributions.map(c => ({
        date: c.paymentDate.toISOString(),
        amount: Number(c._sum.amount),
        count: c._count
      }));

      const memberActivity = historicalMembers.map(m => ({
        month: new Date(m.joinDate).toLocaleDateString('en-US', { month: 'short' }),
        activeMembers: totalMembers,
        newMembers: m._count,
        leftMembers: 0 // Additional logic can be implemented here
      }));

      const payoutDistribution = memberships.map(member => {
        const memberPayouts = payouts.filter(p => p.userId === member.userId);
        const totalPayout = memberPayouts.reduce((sum, p) => sum + Number(p.amount), 0);
        const percentage = (totalPayout / totalContributions) * 100 || 0;

        return {
          member: `${member.user.firstName} ${member.user.lastName}`,
          amount: totalPayout,
          percentage: Math.round(percentage * 10) / 10
        };
      }).sort((a, b) => b.amount - a.amount);

      const paymentStatus = {
        onTime: onTimePayments,
        late: payments.filter(p =>
          new Date(p.paymentDate) > new Date(p.createdAt)
        ).length,
        missed: totalMembers * payments.length - payments.length
      };

      return {
        contributions: formattedContributions,
        memberActivity,
        payoutDistribution,
        metrics: {
          totalMembers,
          memberGrowth: Math.round(memberGrowth * 10) / 10,
          averageContribution,
          contributionGrowth: 0,
          retentionRate: Math.round(retentionRate * 10) / 10,
          totalPaidOut: totalContributions,
          onTimePaymentRate: Math.round(onTimePaymentRate * 10) / 10,
          averagePayoutTime: Math.round(averagePayoutTime * 10) / 10,
        },
        paymentStatus,
      };
    }),
});

export type GroupAnalyticsRouter = typeof groupAnalyticsRouter;
