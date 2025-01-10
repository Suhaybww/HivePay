// src/app/(wherever)/cycle.ts
import { privateProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { z } from 'zod';
import { SchedulerService } from '../../lib/services/schedulerService';
import { GroupStatus, MembershipStatus, Frequency } from '@prisma/client';
import { retryAllPaymentsForGroup } from '@/src/lib/queue/processors';
import { addWeeks, addMonths } from 'date-fns';

/**
 * A helper to build a list of future cycle dates, one per user,
 * or as many times as the group needs (like a ROSCA).
 * e.g., if you have N active members => N cycles.
 * We only keep Weekly, BiWeekly, Monthly per your updated Frequency.
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
      case 'Weekly':
        current = addWeeks(current, 1);
        break;
      case 'BiWeekly':
        current = addWeeks(current, 2);
        break;
      case 'Monthly':
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
   * 1) Admin picks a future date/time = 'cycleDate'.
   * 2) We set the group's nextCycleDate.
   * 3) We build futureCyclesJson with as many items as active members (or more).
   * 4) We start the queue job for the first cycle.
   */
  scheduleGroupCycles: privateProcedure
    .input(
      z.object({
        groupId: z.string(),
        cycleDate: z.coerce.date(), // parse string => Date
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, cycleDate } = input;

      // Must be an admin
      const membership = await db.groupMembership.findFirst({
        where: { groupId, userId, isAdmin: true },
      });
      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can schedule group cycles',
        });
      }

      // Grab group
      const group = await db.group.findUnique({ where: { id: groupId } });
      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
      }

      if (!group.cycleFrequency) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Group has no cycleFrequency set',
        });
      }
      if (!group.contributionAmount || group.contributionAmount.lte(0)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or missing contributionAmount',
        });
      }

      // If there are N active members => N cycles
      const activeCount = await db.groupMembership.count({
        where: { groupId, status: MembershipStatus.Active },
      });
      if (activeCount === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No active members in this group',
        });
      }

      // Build array of future cycle dates
      const futureDates = buildFutureCycleDates(
        cycleDate,
        group.cycleFrequency,
        activeCount
      );

      // Update the group
      await db.group.update({
        where: { id: groupId },
        data: {
          nextCycleDate: cycleDate,
          cycleStarted: true,
          status: GroupStatus.Active,
          pauseReason: null,
          futureCyclesJson: futureDates,
        },
      });

      // Then schedule the queue to process the first cycle
      await SchedulerService.scheduleContributionCycle(groupId);

      return {
        success: true,
        message: 'Group cycles scheduled successfully',
        nextCycleDate: cycleDate,
        futureDates,
      };
    }),

  /**
   * getGroupSchedule
   * Returns nextCycleDate + futureCyclesJson for the group.
   */
  getGroupSchedule: privateProcedure
  .input(z.object({ groupId: z.string() }))
  .query(async ({ ctx, input }) => {
    // 1) Must be an active member
    const membership = await db.groupMembership.findFirst({
      where: { groupId: input.groupId, userId: ctx.userId, status: MembershipStatus.Active },
    });
    if (!membership) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Must be an active member to view schedule',
      });
    }

    // 2) Grab minimal fields from Group
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
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
    }

    // 3) Convert futureCyclesJson => string[] of ISO dates
    let futureCycles: string[] = [];
    if (Array.isArray(group.futureCyclesJson)) {
      // e.g. group.futureCyclesJson = ["2024-08-01T00:00:00.000Z", ...]
      // but just in case, we coerce them to ISO strings:
      futureCycles = (group.futureCyclesJson as string[]).map(dateStr => {
        // optionally parse -> Date -> toISOString() again
        const d = new Date(dateStr);
        return d.toISOString();
      });
    }

    return {
      currentSchedule: {
        // Convert single date => string or keep it as string
        nextCycleDate: group.nextCycleDate ? group.nextCycleDate.toISOString() : null,
        cycleFrequency: group.cycleFrequency,
        contributionAmount: group.contributionAmount?.toString() ?? null,
        status: group.status,
        cycleStarted: group.cycleStarted,
      },
      futureCycleDates: futureCycles,
    };
  }),


  /**
   * retryAllPayments
   * Admin unpauses the group & tries collecting again.
   */
  retryAllPayments: privateProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId } = input;

      // Must be admin
      const membership = await db.groupMembership.findFirst({
        where: { groupId, userId, isAdmin: true },
      });
      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can retry group payments',
        });
      }

      try {
        await retryAllPaymentsForGroup(groupId);
        return { success: true, message: 'Retry triggered successfully' };
      } catch (error) {
        console.error('Failed to retry payments:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retry payments',
        });
      }
    }),
});
