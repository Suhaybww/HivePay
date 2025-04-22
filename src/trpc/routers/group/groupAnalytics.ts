import { privateProcedure, router } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "../../../db";
import { z } from "zod";
import { MembershipStatus, PaymentStatus, GroupStatus } from "@prisma/client";

  export const groupAnalyticsRouter = router({
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
  
        // Fetch data for analytics
        const [contributions, memberships, payouts, payments] = await Promise.all([
          // 1) Fix: Changed createdAt to paymentDate
          db.payment.groupBy({
            by: ["paymentDate"],
            where: { 
              groupId, 
              paymentDate: {  // Changed from createdAt
                gte: startDate, 
                lte: endDate 
              }
            },
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
        ]);
  
        // Calculate total members
        const totalMembers = memberships.length;
  
        // Calculate expected payments
        const expectedPayments = futureCycles.reduce((count, cycleDate) => {
          const cycleEndDate = new Date(cycleDate);
          const membersInCycle = memberships.filter(
            (member) => new Date(member.joinDate) <= cycleEndDate
          );
          return count + membersInCycle.length;
        }, 0);
  
        // Calculate actual payments
        const actualPayments = payments.length;
  
        // Calculate missed payments
        const missedPayments = expectedPayments - actualPayments;
  
        // On-time and late payments
        const onTimePayments = payments.filter(
          (p) => new Date(p.paymentDate) <= new Date(p.createdAt)
        ).length;
        const latePayments = payments.filter(
          (p) => new Date(p.paymentDate) > new Date(p.createdAt)
        ).length;
  
        // Payment status
        const paymentStatus = {
          onTime: onTimePayments,
          late: latePayments,
          missed: missedPayments > 0 ? missedPayments : 0, // Ensure no negative values
        };
  
        // Member activity (example placeholder logic)
        const memberActivity = memberships.map((member) => ({
          month: new Date(member.joinDate).toLocaleDateString("en-US", { month: "short" }),
          activeMembers: totalMembers,
          newMembers: 1, // Placeholder
          leftMembers: 0, // Placeholder
        }));
  
        // Payout distribution (example placeholder logic)
        const payoutDistribution = payouts.map((payout) => ({
          member: `${payout.user.firstName} ${payout.user.lastName}`,
          amount: Number(payout.amount),
          percentage: (Number(payout.amount) / totalMembers) * 100,
          payoutOrder: payouts.indexOf(payout) + 1,
        }));
  
        // Metrics (example placeholder logic)
        const metrics = {
          totalMembers,
          memberGrowth: 0, // Add logic for growth if needed
          averageContribution: payments.reduce((sum, p) => sum + Number(p.amount), 0) / payments.length || 0,
          contributionGrowth: 0, // Add logic for growth if needed
          retentionRate: 100, // Placeholder
          totalPaidOut: payments.reduce((sum, p) => sum + Number(p.amount), 0),
          onTimePaymentRate: (onTimePayments / payments.length) * 100 || 0,
          averagePayoutTime: payouts.reduce((sum, p) => sum + (new Date(p.createdAt).getTime() - new Date(p.scheduledPayoutDate).getTime()) / (1000 * 3600 * 24), 0) / payouts.length || 0,
        };
  
        return {
          contributions: contributions.map((c) => ({
            date: c.paymentDate.toISOString(),
            amount: Number(c._sum.amount) || 0,
            count: c._count,
          })),
          memberActivity,
          payoutDistribution,
          metrics,
          paymentStatus,
          futureCycles,
        };
      }),
  });