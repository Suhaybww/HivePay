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
 * For an N-member ROSCA => build N future dates, one per user
 * (e.g. if there are 3 members, build [Jan 10, Feb 10, Mar 10]).
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
  /**
   * scheduleGroupCycles
   *  1) Admin picks a date = 'cycleDate'
   *  2) We build N future dates => store in futureCyclesJson
   *  3) We set `cycleStarted = true`, `status=Active`, `pauseReason=null`.
   *  4) We queue "start-contribution" immediately for the **first** date in the array.
   */
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

      // Grab the group
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

      // If N=activeCount => produce N future cycles
      const activeCount = await db.groupMembership.count({
        where: { groupId, status: MembershipStatus.Active },
      });
      if (activeCount === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active members in this group",
        });
      }

      // Build array
      const futureDates = buildFutureCycleDates(cycleDate, group.cycleFrequency, activeCount);

      // Update the group => store array in futureCyclesJson, set cycleStarted= true, status=Active
      await db.group.update({
        where: { id: groupId },
        data: {
          cycleStarted: true,
          status: GroupStatus.Active,
          pauseReason: null,
          futureCyclesJson: futureDates,
          // We remove nextCycleDate usage entirely => set it to null or remove from your schema
          nextCycleDate: null, // or remove if you dropped from schema
        },
      });

      // Now schedule the first cycle => we rely on the queue reading from futureCyclesJson
      // We'll do an immediate "scheduleContributionCycle"
      await SchedulerService.scheduleContributionCycle(groupId);

      return {
        success: true,
        message: "Group cycles scheduled successfully",
        firstDate: futureDates[0],
        futureDates,
      };
    }),

  /**
   * getGroupSchedule => returns the futureCyclesJson only.
   */
  getGroupSchedule: privateProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
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
          .map((val) => (typeof val === "string" ? new Date(val).toISOString() : null))
          .filter((x): x is string => !!x);
      }

      return {
        currentSchedule: {
          // No nextCycleDate => we rely on futureCycles
          cycleFrequency: group.cycleFrequency,
          contributionAmount: group.contributionAmount?.toString() ?? null,
          status: group.status,
          cycleStarted: group.cycleStarted,
        },
        futureCycleDates: futureCycles,
      };
    }),

  /**
   * retryAllPayments => unpause + re-schedule
   */
  retryAllPayments: privateProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId } = input;

      const membership = await db.groupMembership.findFirst({
        where: { groupId, userId, isAdmin: true },
      });
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can retry group payments",
        });
      }

      try {
        await retryAllPaymentsForGroup(groupId);
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
