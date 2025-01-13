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

/**
 * Single-frequency group creation schema:
 * - `cycleFrequency` references your Prisma `Frequency` enum
 * - There's no separate "payoutFrequency" anymore
 */
const newGroupSchema = z.object({
  name: z.string().min(3, "Group name must be at least 3 characters"),
  description: z.string().optional(),
  contributionAmount: z.string().refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    { message: "Please enter a valid amount" }
  ),
  // Single frequency field => cycleFrequency
  cycleFrequency: z.nativeEnum(
    // Import the Frequency enum from your Prisma client
    require('@prisma/client').Frequency
  ),
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
  /**
   * createGroup
   * Creates a new group with:
   *   - Single 'cycleFrequency'
   *   - 'contributionAmount'
   *   - initial membership => Admin (Pending)
   */
  createGroup: privateProcedure
    .input(newGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      // Optionally check user’s plan limit, etc.
      const userGroups = await db.group.count({ where: { createdById: userId } });
      if (userGroups >= 5) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You have reached the maximum number of groups you can create with your current plan.',
        });
      }

      // Create group
      try {
        const group = await db.group.create({
          data: {
            name: input.name,
            description: input.description,
            createdById: userId,

            contributionAmount: new Prisma.Decimal(input.contributionAmount),
            cycleFrequency: input.cycleFrequency,

            groupMemberships: {
              create: {
                userId,
                isAdmin: true,
                payoutOrder: 1,
                status: MembershipStatus.Pending, // admin might still need to sign contract
                acceptedTOSAt: null,
              },
            },
          },
          include: { groupMemberships: true },
        });

        return {
          success: true,
          group,
          // Indicate to the front-end that the user may need to sign an owner contract
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

  /**
   * joinGroup
   * The user joins an existing group. Status becomes Pending until TOS/contract is accepted.
   */
  joinGroup: privateProcedure
    .input(joinGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      return await db.$transaction(async (tx) => {
        // 1) Find group + figure out new payoutOrder
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

        // 2) Check user email
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { email: true },
        });
        if (!user?.email) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found or missing email',
          });
        }

        // 3) Check existing membership
        const existingMembership = await tx.groupMembership.findFirst({
          where: { groupId: input.groupId, userId },
        });

        // Next payoutOrder is 1 beyond current max
        const nextPayoutOrder = group.groupMemberships[0]?.payoutOrder
          ? group.groupMemberships[0].payoutOrder + 1
          : 1;

        let membership;
        if (existingMembership) {
          // Already active => can't rejoin
          if (existingMembership.status === MembershipStatus.Active) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'You are already a member of this group',
            });
          }
          // Update old record => set to Pending
          membership = await tx.groupMembership.update({
            where: { id: existingMembership.id },
            data: {
              status: MembershipStatus.Pending,
              acceptedTOSAt: null,
              payoutOrder: nextPayoutOrder,
            },
          });
        } else {
          // No existing membership => create
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

        // 4) Mark invitation => accepted if it exists
        await tx.invitation.updateMany({
          where: {
            groupId: input.groupId,
            email: user.email,
            status: InvitationStatus.PENDING,
          },
          data: { status: InvitationStatus.ACCEPTED },
        });

        // 5) Log a transaction => user joined
        await tx.transaction.create({
          data: {
            userId,
            groupId: input.groupId,
            amount: new Prisma.Decimal(0),
            transactionType: TransactionType.Credit,
            description: existingMembership
              ? 'Member rejoined group'
              : 'Member joined group',
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

  /**
   * transferAdminRole
   * Allows the current admin to appoint a new admin
   */
  transferAdminRole: privateProcedure
    .input(z.object({ groupId: z.string(), newAdminId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, newAdminId } = input;

      // Must be the current admin
      const currentUserMembership = await db.groupMembership.findFirst({
        where: { groupId, userId, isAdmin: true },
      });
      if (!currentUserMembership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can transfer admin role',
        });
      }

      // The new admin must be in the group
      const newAdminMembership = await db.groupMembership.findFirst({
        where: { groupId, userId: newAdminId },
      });
      if (!newAdminMembership) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'New admin user not found in group',
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

  /**
   * removeMember
   * Admin removes a user from the group if the cycle hasn't started
   */
  removeMember: privateProcedure
    .input(z.object({ groupId: z.string(), memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, memberId } = input;

      // Must be an admin
      const membership = await db.groupMembership.findFirst({
        where: { groupId, userId, isAdmin: true },
        include: { group: true },
      });
      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can remove members',
        });
      }

      // If cycle started => can’t remove
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
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found in group',
        });
      }

      await db.groupMembership.delete({ where: { id: membershipToRemove.id } });
      return { success: true };
    }),

  /**
   * leaveGroup
   * A non-admin or admin can leave if cycle not started.
   * If admin leaves, must appoint new admin.
   */
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
              message: 'Must specify new admin when an admin leaves',
            });
          }
          const newAdminMembership = await tx.groupMembership.findFirst({
            where: { groupId, userId: newAdminId },
          });
          if (!newAdminMembership) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'New admin not found in group',
            });
          }
          // Transfer admin role
          await tx.groupMembership.update({
            where: { id: newAdminMembership.id },
            data: { isAdmin: true },
          });
        }

        // Mark current user membership => Inactive
        await tx.groupMembership.update({
          where: { id: membership.id },
          data: { status: MembershipStatus.Inactive },
        });

        // Log transaction
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

  /**
   * updatePayoutOrder
   * Admin can reorder payouts before cycle starts
   */
  updatePayoutOrder: privateProcedure
    .input(z.object({
      groupId: z.string(),
      memberOrders: z.array(z.object({ memberId: z.string(), newOrder: z.number() })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, memberOrders } = input;

      // Must be admin
      const membership = await db.groupMembership.findFirst({
        where: { groupId, userId, isAdmin: true },
      });
      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can update payout order',
        });
      }

      // If cycle started => no reorder
      const group = await db.group.findUnique({ where: { id: groupId } });
      if (group?.cycleStarted) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot update payout order after cycle has started',
        });
      }

      // Find the relevant memberships
      const membershipsToUpdate = await db.groupMembership.findMany({
        where: {
          groupId,
          userId: { in: memberOrders.map((m) => m.memberId) },
        },
      });

      // Bulk update
      await db.$transaction(
        memberOrders.map(({ memberId, newOrder }) => {
          const mem = membershipsToUpdate.find((m) => m.userId === memberId);
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
