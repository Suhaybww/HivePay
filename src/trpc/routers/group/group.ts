// src/trpc/routers/group/group.ts

import { privateProcedure, router } from '../../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { Decimal } from '@prisma/client/runtime/library';
import { MembershipStatus } from '@prisma/client';
import type { GroupWithStats } from '../../../types/groups';
import { z } from 'zod';

export const groupBaseRouter = router({
  // getAllGroups: Retrieves all groups the user is a member of
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

      const groupsWithStats = groups.map((group) => {
        const totalContributions = group.payments.reduce(
          (sum: Decimal, payment) => sum.plus(payment.amount),
          new Decimal(0)
        );

        const totalPayouts = group.payouts.reduce(
          (sum: Decimal, payout) => sum.plus(payout.amount),
          new Decimal(0)
        );

        const currentBalance = totalContributions.minus(totalPayouts);
        const validMemberships = group.groupMemberships.filter((membership) => membership.user !== null);

        const members = validMemberships.map(membership => ({
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
          contributionFrequency: group.contributionFrequency,
          payoutFrequency: group.payoutFrequency,
          nextContributionDate: group.nextContributionDate?.toISOString() ?? null,
          nextPayoutDate: group.nextPayoutDate?.toISOString() ?? null,
          cycleStarted: group.cycleStarted,
          status: group.status,
          _count: group._count,
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

  // getGroupById: Retrieves a single group by ID with stats
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

      const userMembership = group.groupMemberships.find(m => m.user?.id === userId);
      if (!userMembership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not a member of this group',
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

      const validMemberships = group.groupMemberships.filter((membership) => membership.user !== null);

      const members = validMemberships.map(membership => ({
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
        contributionFrequency: group.contributionFrequency,
        payoutFrequency: group.payoutFrequency,
        nextContributionDate: group.nextContributionDate?.toISOString() || null,
        nextPayoutDate: group.nextPayoutDate?.toISOString() || null,
        cycleStarted: group.cycleStarted,
        status: group.status,
        _count: {
          groupMemberships: group._count.groupMemberships,
        },
        totalContributions: totalContributions.toString(),
        currentBalance: totalContributions.minus(totalPayouts).toString(),
        isAdmin: userMembership.isAdmin,
        members,
      };

      return groupWithStats;
    }),

  // getGroupDetails: Fetches detailed group info
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
              where: { status: 'Active' },
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

        const isMember = group.groupMemberships.some((membership) => membership.user.id === userId);
        if (!isMember && group.createdBy.id !== userId) {
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
          contributionFrequency: group.contributionFrequency,
          payoutFrequency: group.payoutFrequency,
          nextContributionDate: group.nextContributionDate?.toISOString() ?? null,
          nextPayoutDate: group.nextPayoutDate?.toISOString() ?? null,
          cycleStarted: group.cycleStarted,
          status: group.status,
          _count: group._count,
          totalContributions: totalContributions.toFixed(2),
          currentBalance: currentBalance.toFixed(2),
          isAdmin: group.createdBy.id === userId,
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
