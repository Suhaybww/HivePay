// src/trpc/routers/group/groupAnalytics.ts
import { privateProcedure, router } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "../../../db";
import { z } from "zod";
import { MembershipStatus, PaymentStatus, GroupStatus } from "@prisma/client";

export const groupAnalyticsRouter = router({
  // getGroupAnalytics: Provides various analytics about the group's performance over a timeframe
  getGroupAnalytics: privateProcedure
    .input(
      z.object({
        groupId: z.string(),
        timeframe: z.enum(["week", "month", "year"]).default("month"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, timeframe } = input;

      // Validate membership
      const membership = await db.groupMembership.findFirst({
        where: { groupId, userId, status: MembershipStatus.Active },
      });
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not an active member of this group.",
        });
      }

      // Grab the group record for futureCyclesJson
      const groupRecord = await db.group.findUnique({
        where: { id: groupId },
        select: {
          status: true,
          futureCyclesJson: true,
        },
      });
      if (!groupRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Group not found",
        });
      }
      if (groupRecord.status !== GroupStatus.Active && groupRecord.status !== GroupStatus.Paused) {
        // or handle logic if needed
      }

      // Convert futureCyclesJson => string[]
      let futureCycles: string[] = [];
      if (Array.isArray(groupRecord.futureCyclesJson)) {
        futureCycles = (groupRecord.futureCyclesJson as string[]).map((iso) => iso.trim());
      }

      // Time range logic
      const startDate = new Date();
      const endDate = new Date();
      switch (timeframe) {
        case "week":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case "year":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      // We run queries for analytics
      const [contributions, memberships, payouts, payments, historicalMembers] = await Promise.all([
        // 1) Summaries for payment amounts
        db.payment.groupBy({
          by: ["paymentDate"],
          where: { groupId, createdAt: { gte: startDate, lte: endDate } },
          _sum: { amount: true },
          _count: true,
        }),

        // 2) All current active memberships
        db.groupMembership.findMany({
          where: { groupId, status: MembershipStatus.Active },
          include: { user: { select: { firstName: true, lastName: true } } },
        }),

        // 3) Payouts in that timeframe
        db.payout.findMany({
          where: { groupId, createdAt: { gte: startDate, lte: endDate } },
          include: { user: { select: { firstName: true, lastName: true } } },
        }),

        // 4) Payments in that timeframe
        db.payment.findMany({
          where: { groupId, createdAt: { gte: startDate, lte: endDate } },
          include: { user: true },
        }),

        // 5) Historical membership changes
        db.groupMembership.groupBy({
          by: ["joinDate"],
          where: { groupId, joinDate: { gte: startDate, lte: endDate } },
          _count: true,
        }),
      ]);

      // Basic analytics
      const totalMembers = memberships.length;
      const previousCount = await db.groupMembership.count({
        where: {
          groupId,
          status: MembershipStatus.Active,
          joinDate: { lt: startDate },
        },
      });
      const memberGrowth =
        previousCount > 0 ? ((totalMembers - previousCount) / previousCount) * 100 : 100;

      const totalContributions = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const averageContribution = payments.length > 0 ? totalContributions / payments.length : 0;

      // On-time payment rate logic
      const onTimePayments = payments.filter(
        (p) => new Date(p.paymentDate) <= new Date(p.createdAt)
      ).length;
      const onTimePaymentRate = payments.length
        ? (onTimePayments / payments.length) * 100
        : 0;

      // Retention
      const leftMembers = await db.groupMembership.count({
        where: {
          groupId,
          status: MembershipStatus.Inactive,
          updatedAt: { gte: startDate, lte: endDate },
        },
      });
      const retentionRate = totalMembers
        ? ((totalMembers - leftMembers) / totalMembers) * 100
        : 100;

      // Payout times
      const payoutTimes = payouts.map((p) => {
        const scheduledDate = new Date(p.scheduledPayoutDate);
        const actualDate = new Date(p.createdAt);
        return Math.ceil(
          (actualDate.getTime() - scheduledDate.getTime()) / (1000 * 3600 * 24)
        );
      });
      const averagePayoutTime =
        payoutTimes.length > 0
          ? payoutTimes.reduce((sum, t) => sum + t, 0) / payoutTimes.length
          : 0;

      // Format for contributions
      const formattedContributions = contributions.map((c) => ({
        date: c.paymentDate.toISOString(),
        amount: Number(c._sum.amount) || 0,
        count: c._count,
      }));

      // Minimal member activity logic
      const memberActivity = historicalMembers.map((m) => ({
        month: new Date(m.joinDate).toLocaleDateString("en-US", { month: "short" }),
        activeMembers: totalMembers,
        newMembers: m._count,
        leftMembers: 0, // Additional logic needed if you track who left
      }));

      // Payout distribution among current members
      const payoutDistribution = memberships
        .map((member) => {
          const memberPayouts = payouts.filter((p) => p.userId === member.userId);
          const totalPayout = memberPayouts.reduce((sum, p) => sum + Number(p.amount), 0);
          const percentage =
            totalContributions > 0 ? (totalPayout / totalContributions) * 100 : 0;

          return {
            member: `${member.user.firstName} ${member.user.lastName}`,
            amount: totalPayout,
            percentage: Math.round(percentage * 10) / 10,
          };
        })
        .sort((a, b) => b.amount - a.amount);

      // Payment status
      const paymentStatus = {
        onTime: onTimePayments,
        late: payments.filter((p) => new Date(p.paymentDate) > new Date(p.createdAt)).length,
        missed: totalMembers * payments.length - payments.length, // or your own logic
      };

      return {
        contributions: formattedContributions,
        memberActivity,
        payoutDistribution,
        metrics: {
          totalMembers,
          memberGrowth: Math.round(memberGrowth * 10) / 10,
          averageContribution,
          contributionGrowth: 0, // or logic to measure vs. previous month
          retentionRate: Math.round(retentionRate * 10) / 10,
          totalPaidOut: totalContributions,
          onTimePaymentRate: Math.round(onTimePaymentRate * 10) / 10,
          averagePayoutTime: Math.round(averagePayoutTime * 10) / 10,
        },
        paymentStatus,
        // IMPORTANT: Return futureCycles so the frontend can display them
        futureCycles,
      };
    }),
});

export type GroupAnalyticsRouter = typeof groupAnalyticsRouter;
