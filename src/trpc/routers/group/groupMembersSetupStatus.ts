// src/trpc/routers/group/groupMembersSetupStatus.ts

import { privateProcedure, router } from '../../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { z } from 'zod';
import { MembershipStatus } from '@prisma/client';

export const groupMembersSetupStatusRouter = router({
  // getGroupMembersSetupStatus: Returns the onboarding and BECS setup status of group members
  getGroupMembersSetupStatus: privateProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { userId } = ctx;
      const { groupId } = input;

      const isMember = await db.groupMembership.findFirst({
        where: { groupId, userId, status: MembershipStatus.Active },
      });

      if (!isMember) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You are not a member of this group',
        });
      }

      try {
        const groupMembers = await db.groupMembership.findMany({
          where: { groupId, status: MembershipStatus.Active },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                gender: true,
                onboardingStatus: true,
                becsSetupStatus: true,
              },
            },
          },
          orderBy: { payoutOrder: 'asc' },
        });

        return groupMembers.map((m) => ({
          id: m.user.id,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          email: m.user.email,
          gender: m.user.gender,
          isAdmin: m.isAdmin,
          payoutOrder: m.payoutOrder,
          onboardingStatus: m.user.onboardingStatus,
          becsSetupStatus: m.user.becsSetupStatus,
        }));
      } catch (error) {
        console.error('Failed to fetch group members setup status:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch group members setup status',
        });
      }
    }),
});

export type GroupMembersSetupStatusRouter = typeof groupMembersSetupStatusRouter;
