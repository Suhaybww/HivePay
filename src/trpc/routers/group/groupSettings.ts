import { privateProcedure, router } from '../../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { z } from 'zod';
import { MembershipStatus, Prisma, GroupStatus, TransactionType } from '@prisma/client';
import { sendGroupDeletionEmail } from '@/src/lib/emailService';

export const groupSettingsRouter = router({
  // updateGroupDates: Updates scheduling-related dates for the group
  updateGroupDates: privateProcedure
    .input(z.object({
      groupId: z.string(),
      scheduleDate: z.union([z.date(), z.string()]).transform((val) =>
        typeof val === 'string' ? new Date(val) : val
      ).optional(),
      payoutDate: z.union([z.date(), z.string()]).transform((val) =>
        typeof val === 'string' ? new Date(val) : val
      ).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { groupId, scheduleDate, payoutDate } = input;
      const { userId } = ctx;

      try {
        const group = await db.group.findUnique({
          where: { id: groupId },
          include: { createdBy: { select: { id: true } } },
        });

        if (!group) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
        }

        if (group.createdBy.id !== userId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to update this group',
          });
        }

        const dataToUpdate: any = {};
        if (scheduleDate) dataToUpdate.nextContributionDate = scheduleDate;
        if (payoutDate) dataToUpdate.nextPayoutDate = payoutDate;

        if (Object.keys(dataToUpdate).length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No dates provided to update',
          });
        }

        const updatedGroup = await db.group.update({
          where: { id: groupId },
          data: dataToUpdate,
        });

        return {
          success: true,
          message: 'Group dates updated successfully',
          group: updatedGroup,
        };
      } catch (error) {
        console.error('Failed to update group dates:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update group dates',
        });
      }
    }),

  // updateGroupSettings: Update basic group info like name or description
  updateGroupSettings: privateProcedure
    .input(z.object({
      groupId: z.string(),
      name: z.string().min(3).optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, name, description } = input;

      const membership = await db.groupMembership.findFirst({
        where: { groupId, userId, isAdmin: true },
      });

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can update group settings',
        });
      }

      const updatedGroup = await db.group.update({
        where: { id: groupId },
        data: { name, description },
      });

      return updatedGroup;
    }),

  // deleteGroup: Deletes a group entirely before the cycle starts
  deleteGroup: privateProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId } = input;

      return await db.$transaction(async (tx) => {
        const group = await tx.group.findUnique({
          where: { id: groupId },
          include: {
            groupMemberships: {
              include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true } }
              }
            },
            createdBy: { select: { firstName: true, lastName: true } }
          }
        });

        if (!group) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Group not found' });
        }

        const isAdmin = group.groupMemberships.some(
          membership => membership.user.id === userId && membership.isAdmin
        );

        if (!isAdmin) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only group admins can delete groups'
          });
        }

        if (group.cycleStarted) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Cannot delete group after cycle has started'
          });
        }

        // Set all memberships to inactive
        await tx.groupMembership.updateMany({
          where: { groupId, status: MembershipStatus.Active },
          data: { status: MembershipStatus.Inactive }
        });

        // Create transaction records for all members
        await Promise.all(
          group.groupMemberships.map(membership =>
            tx.transaction.create({
              data: {
                userId: membership.user.id,
                groupId,
                amount: new Prisma.Decimal(0),
                transactionType: TransactionType.Credit,
                description: 'Group was deleted by admin'
              }
            })
          )
        );

        // Delete related records
        await tx.invitation.deleteMany({ where: { groupId } });
        await tx.message.deleteMany({ where: { groupId } });
        await tx.contract.deleteMany({ where: { groupId } });
        await tx.payment.deleteMany({ where: { groupId } });
        await tx.payout.deleteMany({ where: { groupId } });

        // Delete the group
        await tx.group.delete({ where: { id: groupId } });

        // Create notifications for all members
        await tx.notification.createMany({
          data: group.groupMemberships.map(membership => ({
            userId: membership.user.id,
            content: `The group "${group.name}" has been deleted by ${group.createdBy.firstName} ${group.createdBy.lastName}.`
          }))
        });

        const adminName = `${group.createdBy.firstName} ${group.createdBy.lastName}`;

        const emailPromises = group.groupMemberships.map(membership =>
          sendGroupDeletionEmail({
            groupName: group.name,
            adminName,
            recipient: {
              email: membership.user.email,
              firstName: membership.user.firstName,
              lastName: membership.user.lastName
            }
          })
        );

        await Promise.allSettled(emailPromises);

        return {
          success: true,
          message: 'Group successfully deleted and all members notified'
        };
      });
    }),
});

export type GroupSettingsRouter = typeof groupSettingsRouter;
