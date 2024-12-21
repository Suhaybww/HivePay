// src/trpc/routers/group/groupMembership.ts

import { privateProcedure, router } from '../../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { z } from 'zod';
import {
  Prisma,
  MembershipStatus,
  InvitationStatus,
  TransactionType,
} from '@prisma/client';

// Schemas used for group creation and joining
const newGroupSchema = z.object({
  name: z.string().min(3, "Group name must be at least 3 characters"),
  description: z.string().optional(),
  contributionAmount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Please enter a valid amount",
  }),
  contributionFrequency: z.nativeEnum(require('@prisma/client').Frequency),
  payoutFrequency: z.nativeEnum(require('@prisma/client').Frequency),
  acceptedTOS: z.boolean().refine((val) => val === true, {
    message: "You must accept the Terms and Conditions to proceed.",
  }),
});

const joinGroupSchema = z.object({
  groupId: z.string().min(1, "Please enter a group ID"),
  acceptedTOS: z.boolean().refine((val) => val === true, {
    message: "You must accept the Terms and Conditions to proceed.",
  }),
});

export const groupMembershipRouter = router({
  // createGroup: Creates a new group
  createGroup: privateProcedure
    .input(newGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      // Check group creation limit
      const userGroups = await db.group.count({
        where: { createdById: userId },
      });

      if (userGroups >= 5) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You have reached the maximum number of groups you can create with your current plan.',
        });
      }

      try {
        const group = await db.group.create({
          data: {
            name: input.name,
            description: input.description,
            createdById: userId,
            contributionAmount: new Prisma.Decimal(input.contributionAmount),
            contributionFrequency: input.contributionFrequency,
            payoutFrequency: input.payoutFrequency,
            groupMemberships: {
              create: {
                userId,
                isAdmin: true,
                payoutOrder: 1,
                status: MembershipStatus.Pending,
                acceptedTOSAt: null,
              },
            },
          },
          include: { groupMemberships: true },
        });

        return {
          success: true,
          group,
          requiresContract: true,
        };
      } catch (error) {
        console.error('Failed to create group:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create group',
        });
      }
    }),

  // joinGroup: Allows a user to join a group
  joinGroup: privateProcedure
    .input(joinGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      return await db.$transaction(async (tx) => {
        const group = await tx.group.findUnique({
          where: { id: input.groupId },
          include: {
            groupMemberships: {
              orderBy: { payoutOrder: 'desc' },
              take: 1,
            },
          },
        });

        if (!group) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
        }

        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });

        if (!user || !user.email) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found or email is missing.',
          });
        }

        const existingMembership = await tx.groupMembership.findFirst({
          where: { groupId: input.groupId, userId },
        });

        const nextPayoutOrder = group.groupMemberships[0]?.payoutOrder
          ? group.groupMemberships[0].payoutOrder + 1
          : 1;

        let membership;

        if (existingMembership) {
          if (existingMembership.status === MembershipStatus.Active) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'You are already a member of this group',
            });
          }

          membership = await tx.groupMembership.update({
            where: { id: existingMembership.id },
            data: {
              status: MembershipStatus.Pending,
              acceptedTOSAt: null,
              payoutOrder: nextPayoutOrder,
            },
          });
        } else {
          membership = await tx.groupMembership.create({
            data: {
              groupId: input.groupId,
              userId,
              isAdmin: false,
              payoutOrder: nextPayoutOrder,
              status: MembershipStatus.Pending,
              acceptedTOSAt: null,
            },
          });
        }

        // Update invitation status
        await tx.invitation.updateMany({
          where: {
            groupId: input.groupId,
            email: user.email,
            status: InvitationStatus.PENDING,
          },
          data: { status: InvitationStatus.ACCEPTED },
        });

        // Transaction record for joining
        await tx.transaction.create({
          data: {
            userId,
            groupId: input.groupId,
            amount: new Prisma.Decimal(0),
            transactionType: TransactionType.Credit,
            description: existingMembership ? 'Member rejoined group' : 'Member joined group',
          },
        });

        return {
          success: true,
          membership,
          requiresContract: true,
          redirectUrl: `/groups/${input.groupId}/contract`,
        };
      });
    }),

  // transferAdminRole: Transfers admin privileges to another user
  transferAdminRole: privateProcedure
    .input(z.object({ groupId: z.string(), newAdminId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, newAdminId } = input;

      const currentUserMembership = await db.groupMembership.findFirst({
        where: { groupId, userId, isAdmin: true },
      });

      if (!currentUserMembership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can transfer admin role',
        });
      }

      const newAdminMembership = await db.groupMembership.findFirst({
        where: { groupId, userId: newAdminId },
      });

      if (!newAdminMembership) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'New admin not found in group',
        });
      }

      await db.$transaction([
        db.groupMembership.update({
          where: { id: currentUserMembership.id },
          data: { isAdmin: false },
        }),
        db.groupMembership.update({
          where: { id: newAdminMembership.id },
          data: { isAdmin: true },
        }),
      ]);

      return { success: true };
    }),

  // removeMember: Removes a member from the group (before cycle starts)
  removeMember: privateProcedure
    .input(z.object({ groupId: z.string(), memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, memberId } = input;

      const membership = await db.groupMembership.findFirst({
        where: { groupId, userId, isAdmin: true },
        include: { group: true },
      });

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can remove members' });
      }

      if (membership.group.cycleStarted) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot remove members after cycle has started',
        });
      }

      const membershipToRemove = await db.groupMembership.findFirst({
        where: { groupId, userId: memberId },
      });

      if (!membershipToRemove) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      await db.groupMembership.delete({ where: { id: membershipToRemove.id } });
      return { success: true };
    }),

  // leaveGroup: Allows a member to leave the group (if cycle not started)
  leaveGroup: privateProcedure
    .input(z.object({ groupId: z.string(), newAdminId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, newAdminId } = input;

      const membership = await db.groupMembership.findFirst({
        where: { groupId, userId },
        include: { group: true },
      });

      if (!membership) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Membership not found' });
      }

      if (membership.group.cycleStarted) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot leave group after cycle has started',
        });
      }

      return await db.$transaction(async (tx) => {
        if (membership.isAdmin) {
          if (!newAdminId) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Must specify new admin when leaving as admin',
            });
          }

          const newAdminMembership = await tx.groupMembership.findFirst({
            where: { groupId, userId: newAdminId },
          });

          if (!newAdminMembership) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'New admin not found in group' });
          }

          await tx.groupMembership.update({
            where: { id: newAdminMembership.id },
            data: { isAdmin: true },
          });
        }

        await tx.groupMembership.update({
          where: { id: membership.id },
          data: { status: MembershipStatus.Inactive },
        });

        await tx.transaction.create({
          data: {
            userId,
            groupId,
            amount: new Prisma.Decimal(0),
            transactionType: TransactionType.Credit,
            description: 'Member left the group',
          },
        });

        return { success: true };
      });
    }),

  // updatePayoutOrder: Updates the payout order of group members before cycle starts
  updatePayoutOrder: privateProcedure
    .input(z.object({
      groupId: z.string(),
      memberOrders: z.array(z.object({ memberId: z.string(), newOrder: z.number() })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, memberOrders } = input;

      const membership = await db.groupMembership.findFirst({
        where: { groupId, userId, isAdmin: true },
      });

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can update payout order' });
      }

      const group = await db.group.findUnique({ where: { id: groupId } });

      if (group?.cycleStarted) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot update payout order after cycle has started',
        });
      }

      const membershipsToUpdate = await db.groupMembership.findMany({
        where: {
          groupId,
          userId: { in: memberOrders.map(m => m.memberId) },
        },
      });

      await db.$transaction(
        memberOrders.map(({ memberId, newOrder }) => {
          const mem = membershipsToUpdate.find(m => m.userId === memberId);
          if (!mem) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Member ${memberId} not found in group`,
            });
          }
          return db.groupMembership.update({
            where: { id: mem.id },
            data: { payoutOrder: newOrder },
          });
        })
      );

      return { success: true };
    }),
});

export type GroupMembershipRouter = typeof groupMembershipRouter;
