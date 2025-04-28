import { privateProcedure, router } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "../../db";
import { z } from "zod";
import { SchedulerService } from "../../lib/services/schedulerService";
import { GroupStatus, MembershipStatus, Frequency } from "@prisma/client";
import { retryAllPaymentsForGroup } from "@/src/lib/queue/processors";
import { addWeeks, addMonths } from "date-fns";
import { sendGroupCycleStartedEmail } from "@/src/lib/emailService";
import { contributionQueue } from "@/src/lib/queue/contributionQueue";

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

      // 2) set nextCycleDate to the first date => we'll run the queue for that date
      const firstCycleDate = futureDates[0];

      // 3) Update the group with all necessary data in a single operation
      const updatedGroup = await db.group.update({
        where: { id: groupId },
        data: {
          cycleStarted: true,
          status: GroupStatus.Active,
          pauseReason: null,
          nextCycleDate: firstCycleDate,
          // Make sure dates are properly serialized
          futureCyclesJson: futureDates.map(date => date.toISOString()),
        },
        include: {
          groupMemberships: {
            where: { status: MembershipStatus.Active },
            include: { user: true }
          }
        }
      });

      // NEW: Get active members for email
      const activeMembers = updatedGroup.groupMemberships.map(m => ({
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
      }));

      // NEW: Send cycle started emails
      await sendGroupCycleStartedEmail(updatedGroup.name, activeMembers);

      // 5) schedule the queue - using multiple methods to ensure it works
      try {
        // Try the SchedulerService approach first
        console.log(`🔄 Calling SchedulerService.scheduleContributionCycle for group ${groupId}`);
        await SchedulerService.scheduleContributionCycle(groupId);
        
        // DIRECT QUEUE ADDITION as a backup approach
        console.log(`🔄 Adding direct queue job for group ${groupId}`);
        const jobId = `direct-contribution-${groupId}-${Date.now()}`;
        await contributionQueue.add(
          "start-contribution",
          { 
            groupId, 
            timestamp: new Date().toISOString(),
            directAdd: true // flag to identify this method
          },
          { 
            attempts: 3,
            jobId,
            delay: 0 // immediate execution
          }
        );
        console.log(`✅ Direct queue job added with ID: ${jobId}`);
      } catch (queueError) {
        console.error(`⚠️ Failed to add queue job, but continuing:`, queueError);
        // Don't throw - still return success to the user
      }

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
      console.log('Getting schedule for group:', input.groupId);
      
      // Check membership
      const membership = await db.groupMembership.findFirst({
        where: {
          groupId: input.groupId,
          userId: ctx.userId,
          status: MembershipStatus.Active,
        },
      });
      console.log('Membership found:', membership);
  
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Must be an active member to view schedule",
        });
      }
  
      // Get group
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
      console.log('Group found:', group);
      console.log('Future cycles JSON:', group?.futureCyclesJson);
  
      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }
  
      let futureCycles: string[] = [];
      if (Array.isArray(group.futureCyclesJson)) {
        futureCycles = group.futureCyclesJson
          .map((val) => {
            console.log('Processing future cycle value:', val);
            if (typeof val === "string" && val.trim() !== "") {
              const dateStr = new Date(val).toISOString();
              console.log('Converted to ISO string:', dateStr);
              return dateStr;
            }
            return null;
          })
          .filter((x): x is string => !!x);
      }
      console.log('Final future cycles:', futureCycles);
  
      const response = {
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
      console.log('Returning response:', response);
  
      return response;
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
        // Attempt to add directly to the queue first
        console.log(`🔄 Adding direct retry job for group ${input.groupId}`);
        const jobId = `direct-retry-payments-${input.groupId}-${Date.now()}`;
        await contributionQueue.add(
          "start-contribution",
          { 
            groupId: input.groupId, 
            timestamp: new Date().toISOString(),
            retryPayments: true
          },
          { 
            attempts: 3,
            jobId,
            delay: 0
          }
        );
        console.log(`✅ Direct retry job added with ID: ${jobId}`);

        // Then try the service method as backup
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