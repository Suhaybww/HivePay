// src/server/routers/invitationRouter.ts

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, privateProcedure } from '../trpc';
import { sendInvitationEmail } from '@/src/lib/emailService';
import type { Context } from '../trpc';

export const invitationRouter = router({
  // Get all invitations for a group
  getGroupInvitations: privateProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { groupId } = input;

      // Verify user has permission to view invitations
      const membership = await ctx.db.groupMembership.findFirst({
        where: {
          groupId,
          userId: ctx.userId,
          isAdmin: true,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view invitations for this group',
        });
      }

      return ctx.db.invitation.findMany({
        where: {
          groupId,
          status: 'PENDING',
        },
        include: {
          invitedBy: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }),

  // Send invitation
  sendInvitation: privateProcedure
    .input(z.object({
      email: z.string().email(),
      groupId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { email, groupId } = input;

      // Check if the invited user exists in the DB
      const invitedUser = await ctx.db.user.findUnique({
        where: { email },
      });

      if (!invitedUser) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This email is not registered with HivePay. Please ask them to create an account first.',
        });
      }

      // **Check if the invited user has an active subscription**
      if (invitedUser.subscriptionStatus !== 'Active') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'The user does not have an active subscription and cannot be invited.',
        });
      }

      // Verify user has permission to invite members to this group
      const membership = await ctx.db.groupMembership.findFirst({
        where: {
          groupId,
          userId: ctx.userId,
          isAdmin: true,
        },
        include: {
          group: true,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to invite members to this group',
        });
      }

      // Check if user already exists in the group
      const existingMember = await ctx.db.groupMembership.findFirst({
        where: {
          groupId,
          user: {
            email,
          },
        },
      });

      if (existingMember) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This user is already a member of the group',
        });
      }

      // Check if there's already a pending invitation
      const existingInvitation = await ctx.db.invitation.findFirst({
        where: {
          email,
          groupId,
          status: 'PENDING',
        },
      });

      if (existingInvitation) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'An invitation has already been sent to this email',
        });
      }

      // Get inviter details
      const inviter = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: {
          firstName: true,
          lastName: true,
        },
      });

      if (!inviter) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Inviter not found',
        });
      }

      // Create invitation without a token
      const invitation = await ctx.db.invitation.create({
        data: {
          email,
          groupId,
          invitedById: ctx.userId!,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      // Send invitation email with groupId
      await sendInvitationEmail(
        email,
        groupId,
        membership.group.name,
        `${inviter.firstName} ${inviter.lastName}`
      );

      return invitation;
    }),

  // Cancel invitation
  cancelInvitation: privateProcedure
    .input(z.object({
      invitationId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.invitation.findUnique({
        where: { id: input.invitationId },
        include: {
          group: {
            include: {
              groupMemberships: {
                where: {
                  userId: ctx.userId,
                  isAdmin: true,
                },
              },
            },
          },
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invitation not found',
        });
      }

      if (invitation.group.groupMemberships.length === 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to cancel this invitation',
        });
      }

      return ctx.db.invitation.update({
        where: { id: input.invitationId },
        data: { status: 'CANCELLED' },
      });
    }),
});
