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

 /**
   * deleteGroup
   * Completely removes a group before the cycle starts, including
   * all child references, ensuring no "required relation" errors occur.
   */
 deleteGroup: privateProcedure
 .input(z.object({ groupId: z.string() }))
 .mutation(async ({ ctx, input }) => {
   const { userId } = ctx;
   const { groupId } = input;

   return await db.$transaction(async (tx) => {
     // 1) Load group + memberships
     const group = await tx.group.findUnique({
       where: { id: groupId },
       include: {
         groupMemberships: {
           include: {
             user: {
               select: {
                 id: true,
                 email: true,
                 firstName: true,
                 lastName: true,
               },
             },
           },
         },
         createdBy: {
           select: { firstName: true, lastName: true },
         },
       },
     });

     if (!group) {
       throw new TRPCError({
         code: 'NOT_FOUND',
         message: 'Group not found',
       });
     }

     // 2) Must be an admin
     const isAdmin = group.groupMemberships.some(
       (membership) => membership.user.id === userId && membership.isAdmin,
     );
     if (!isAdmin) {
       throw new TRPCError({
         code: 'FORBIDDEN',
         message: 'Only group admins can delete groups',
       });
     }

     // 3) Group must not have started its cycle
     if (group.cycleStarted) {
       throw new TRPCError({
         code: 'FORBIDDEN',
         message: 'Cannot delete the group after the cycle has started',
       });
     }

     // 4) (Optional) Create a "Group was deleted" transaction record for each member
     //    so the action is logged. Note that these transactions also reference groupId,
     //    so we MUST remove them afterward if your schema enforces that relation.
     await Promise.all(
       group.groupMemberships.map((membership) =>
         tx.transaction.create({
           data: {
             userId: membership.user.id,
             groupId: groupId,
             amount: new Prisma.Decimal(0),
             transactionType: TransactionType.Credit,
             description: 'Group was deleted by admin',
           },
         }),
       ),
     );

     // 5) Delete all Transaction records referencing this group
     //    (including the ones you might have just created above).
     await tx.transaction.deleteMany({ where: { groupId } });

     // 6) Now remove child references from other tables
     await tx.invitation.deleteMany({ where: { groupId } });
     await tx.message.deleteMany({ where: { groupId } });
     await tx.contract.deleteMany({ where: { groupId } });
     await tx.payment.deleteMany({ where: { groupId } });
     await tx.payout.deleteMany({ where: { groupId } });

     // 7) Finally remove groupMembership rows
     await tx.groupMembership.deleteMany({ where: { groupId } });

     // 8) Delete the group itself
     await tx.group.delete({ where: { id: groupId } });

     // 9) Notify members via email
     const adminName = `${group.createdBy.firstName} ${group.createdBy.lastName}`;
     const emailPromises = group.groupMemberships.map((membership) =>
       sendGroupDeletionEmail({
         groupName: group.name,
         adminName,
         recipient: {
           email: membership.user.email,
           firstName: membership.user.firstName,
           lastName: membership.user.lastName,
         },
       }),
     );
     await Promise.allSettled(emailPromises);

     return {
       success: true,
       message: `Group "${group.name}" deleted. All members have been notified.`,
     };
   });
 }),
});

export type GroupSettingsRouter = typeof groupSettingsRouter;
