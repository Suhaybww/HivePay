import { privateProcedure, router } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "../../db";
import { z } from "zod";
import { SchedulerService } from "../../lib/services/schedulerService";
import { GroupStatus, MembershipStatus, Frequency } from "@prisma/client";
import { retryAllPaymentsForGroup } from "@/src/lib/queue/processors";
import { addWeeks, addMonths } from "date-fns";

/**
 * buildFutureCycleDates
 * - e.g. if activeCount=3 => we produce 3 future monthly dates
 */
function buildFutureCycleDates(
  start: Date,
  frequency: Frequency,
  cycleCount: number
): Date[] {
  const result: Date[] = [];
  let current = start;

  for (let i = 0; i < cycleCount; i++) {
    result.push(current);

    switch (frequency) {
      case "Weekly":
        current = addWeeks(current, 1);
        break;
      case "BiWeekly":
        current = addWeeks(current, 2);
        break;
      case "Monthly":
        current = addMonths(current, 1);
        break;
      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }
  }
  return result;
}

export const cycleRouter = router({
  scheduleGroupCycles: privateProcedure
    .input(
      z.object({
        groupId: z.string(),
        cycleDate: z.coerce.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, cycleDate } = input;

      // Must be admin
      const membership = await db.groupMembership.findFirst({
        where: { groupId, userId, isAdmin: true },
      });
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can schedule group cycles",
        });
      }

      // fetch group
      const group = await db.group.findUnique({ where: { id: groupId } });
      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }
      if (!group.cycleFrequency) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Group has no cycleFrequency set",
        });
      }
      if (!group.contributionAmount || group.contributionAmount.lte(0)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or missing contributionAmount",
        });
      }

      // Count active members => produce that many future cycles
      const activeCount = await db.groupMembership.count({
        where: { groupId, status: MembershipStatus.Active },
      });
      if (activeCount === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active members in this group",
        });
      }

      // 1) build array
      const futureDates = buildFutureCycleDates(
        cycleDate,
        group.cycleFrequency,
        activeCount
      );

      // 2) set nextCycleDate to the first date => we’ll run the queue for that date
      const firstCycleDate = futureDates[0];

      // 3) store the entire array => futureCyclesJson
      await db.group.update({
        where: { id: groupId },
        data: {
          cycleStarted: true,
          status: GroupStatus.Active,
          pauseReason: null,
          nextCycleDate: firstCycleDate, // we use this date for the first run
          futureCyclesJson: futureDates, // the entire set
        },
      });

      // 4) schedule the queue => picks up nextCycleDate
      await SchedulerService.scheduleContributionCycle(groupId);

      return {
        success: true,
        message: "Group cycles scheduled successfully",
        firstDate: firstCycleDate,
        futureDates,
      };
    }),

  getGroupSchedule: privateProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      // must be in group
      const membership = await db.groupMembership.findFirst({
        where: {
          groupId: input.groupId,
          userId: ctx.userId,
          status: MembershipStatus.Active,
        },
      });
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Must be an active member to view schedule",
        });
      }

      const group = await db.group.findUnique({
        where: { id: input.groupId },
        select: {
          nextCycleDate: true,
          cycleFrequency: true,
          contributionAmount: true,
          status: true,
          cycleStarted: true,
          futureCyclesJson: true,
        },
      });
      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }

      let futureCycles: string[] = [];
      if (Array.isArray(group.futureCyclesJson)) {
        futureCycles = group.futureCyclesJson
          .map((val) =>
            typeof val === "string" && val.trim() !== ""
              ? new Date(val).toISOString()
              : null
          )
          .filter((x): x is string => !!x);
      }

      return {
        currentSchedule: {
          nextCycleDate: group.nextCycleDate
            ? group.nextCycleDate.toISOString()
            : null,
          cycleFrequency: group.cycleFrequency,
          contributionAmount: group.contributionAmount?.toString() ?? null,
          status: group.status,
          cycleStarted: group.cycleStarted,
        },
        futureCycleDates: futureCycles,
      };
    }),

  retryAllPayments: privateProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const membership = await db.groupMembership.findFirst({
        where: { groupId: input.groupId, userId: ctx.userId, isAdmin: true },
      });
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can retry group payments",
        });
      }

      try {
        await retryAllPaymentsForGroup(input.groupId);
        return { success: true, message: "Retry triggered successfully" };
      } catch (error) {
        console.error("Failed to retry payments:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retry payments",
        });
      }
    }),
});
