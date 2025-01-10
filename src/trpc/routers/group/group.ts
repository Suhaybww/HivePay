import { privateProcedure, router } from '../../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { Decimal } from '@prisma/client/runtime/library';
import { MembershipStatus, GroupStatus } from '@prisma/client';
import type { GroupWithStats } from '../../../types/groups';
import { z } from 'zod';

/**
 * Example: single frequency is stored in `cycleFrequency`
 * and single date is `nextCycleDate`.
 * (No more separate `payoutFrequency` or `nextPayoutDate`).
 */
export const groupBaseRouter = router({
  /**
   * getAllGroups
   * Retrieves all groups the user is a member of
   */
  getAllGroups: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;
    try {
      const groups = await db.group.findMany({
        where: {
          groupMemberships: {
            some: {
              userId,
              status: MembershipStatus.Active,
            },
          },
        },
        include: {
          _count: { select: { groupMemberships: true } },
          payments: { select: { amount: true } },
          payouts: { select: { amount: true } },
          createdBy: { select: { id: true } },
          groupMemberships: {
            where: { status: MembershipStatus.Active },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  gender: true,
                  stripeAccountId: true,
                },
              },
            },
            orderBy: { payoutOrder: 'asc' },
          },
        },
      });

      const groupsWithStats: GroupWithStats[] = groups.map((group) => {
        // sum of all payments
        const totalContributions = group.payments.reduce(
          (sum: Decimal, payment) => sum.plus(payment.amount),
          new Decimal(0)
        );
        // sum of all payouts
        const totalPayouts = group.payouts.reduce(
          (sum: Decimal, payout) => sum.plus(payout.amount),
          new Decimal(0)
        );
        // current balance
        const currentBalance = totalContributions.minus(totalPayouts);

        // Build array of members
        const validMemberships = group.groupMemberships.filter(m => m.user !== null);
        const members = validMemberships.map((membership) => ({
          id: membership.user!.id,
          firstName: membership.user!.firstName,
          lastName: membership.user!.lastName,
          email: membership.user!.email,
          gender: membership.user!.gender,
          isAdmin: membership.isAdmin,
          payoutOrder: membership.payoutOrder,
          stripeAccountId: membership.user!.stripeAccountId,
        }));

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          createdById: group.createdById,
          contributionAmount: group.contributionAmount?.toFixed(2) ?? null,
          cycleFrequency: group.cycleFrequency,
          nextCycleDate: group.nextCycleDate?.toISOString() ?? null,

          cycleStarted: group.cycleStarted,
          status: group.status,
          pauseReason: group.pauseReason ?? null,

          _count: {
            groupMemberships: group._count.groupMemberships,
          },
          totalContributions: totalContributions.toFixed(2),
          currentBalance: currentBalance.toFixed(2),

          isAdmin: group.createdById === userId,
          members,
        };
      });

      return groupsWithStats;
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch groups',
      });
    }
  }),

  /**
   * getGroupById
   * Retrieves a single group by ID with stats
   */
  getGroupById: privateProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;
      const group = await db.group.findUnique({
        where: { id: input.groupId },
        include: {
          _count: { select: { groupMemberships: true } },
          payments: true,
          payouts: true,
          createdBy: { select: { id: true } },
          groupMemberships: {
            where: { status: MembershipStatus.Active },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  gender: true,
                  stripeAccountId: true,
                },
              },
            },
            orderBy: { payoutOrder: 'asc' },
          },
        },
      });

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }

      // Check membership
      const userMembership = group.groupMemberships.find(m => m.user?.id === userId);
      if (!userMembership && group.createdById !== userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not a member of this group',
        });
      }

      // Stats
      const totalContributions = group.payments.reduce(
        (sum: Decimal, payment) => sum.plus(payment.amount),
        new Decimal(0)
      );
      const totalPayouts = group.payouts.reduce(
        (sum: Decimal, payout) => sum.plus(payout.amount),
        new Decimal(0)
      );
      const currentBalance = totalContributions.minus(totalPayouts);

      const validMemberships = group.groupMemberships.filter((m) => m.user !== null);
      const members = validMemberships.map((membership) => ({
        id: membership.user!.id,
        firstName: membership.user!.firstName,
        lastName: membership.user!.lastName,
        email: membership.user!.email,
        gender: membership.user!.gender,
        isAdmin: membership.isAdmin,
        payoutOrder: membership.payoutOrder,
        stripeAccountId: membership.user!.stripeAccountId,
      }));

      const groupWithStats: GroupWithStats = {
        id: group.id,
        name: group.name,
        description: group.description,
        createdById: group.createdById,

        contributionAmount: group.contributionAmount?.toString() || null,
        cycleFrequency: group.cycleFrequency,
        nextCycleDate: group.nextCycleDate?.toISOString() || null,

        cycleStarted: group.cycleStarted,
        status: group.status,
        pauseReason: group.pauseReason ?? null,

        _count: {
          groupMemberships: group._count.groupMemberships,
        },
        totalContributions: totalContributions.toString(),
        currentBalance: currentBalance.toString(),

        isAdmin: userMembership?.isAdmin || (group.createdById === userId),
        members,
      };

      return groupWithStats;
    }),

  /**
   * getGroupDetails
   * Another approach to fetch group with stats
   */
  getGroupDetails: privateProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { groupId } = input;
      const { userId } = ctx;
      try {
        const group = await db.group.findUnique({
          where: { id: groupId },
          include: {
            _count: { select: { groupMemberships: true } },
            payments: { select: { amount: true } },
            payouts: { select: { amount: true } },
            createdBy: { select: { id: true } },
            groupMemberships: {
              where: { status: MembershipStatus.Active },
              include: {
                user: { 
                  select: { 
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    gender: true,
                    stripeAccountId: true 
                  }
                },
              },
              orderBy: { payoutOrder: 'asc' },
            },
          },
        });

        if (!group) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Group not found',
          });
        }

        // Must be the owner or an active member
        const isMember = group.groupMemberships.some(m => m.user.id === userId);
        const isOwner = (group.createdBy.id === userId);
        if (!isMember && !isOwner) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this group',
          });
        }

        const totalContributions = group.payments.reduce(
          (sum: Decimal, payment) => sum.plus(payment.amount),
          new Decimal(0)
        );
        const totalPayouts = group.payouts.reduce(
          (sum: Decimal, payout) => sum.plus(payout.amount),
          new Decimal(0)
        );
        const currentBalance = totalContributions.minus(totalPayouts);

        const members = group.groupMemberships.map((membership) => ({
          id: membership.user.id,
          firstName: membership.user.firstName,
          lastName: membership.user.lastName,
          email: membership.user.email,
          gender: membership.user.gender,
          isAdmin: membership.isAdmin,
          payoutOrder: membership.payoutOrder,
          stripeAccountId: membership.user.stripeAccountId,
        }));

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          createdById: group.createdBy.id,

          contributionAmount: group.contributionAmount?.toFixed(2) ?? null,
          cycleFrequency: group.cycleFrequency,
          nextCycleDate: group.nextCycleDate?.toISOString() ?? null,

          cycleStarted: group.cycleStarted,
          status: group.status,
          pauseReason: group.pauseReason ?? null,

          _count: { groupMemberships: group._count.groupMemberships },
          totalContributions: totalContributions.toFixed(2),
          currentBalance: currentBalance.toFixed(2),
          isAdmin: isOwner,
          members,
        };
      } catch (error) {
        console.error('Failed to fetch group details:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch group details',
        });
      }
    }),
});

export type GroupBaseRouter = typeof groupBaseRouter;
