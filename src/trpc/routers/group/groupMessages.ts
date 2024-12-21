// src/trpc/routers/group/groupMessages.ts

import { privateProcedure, router } from '../../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../../db';
import { z } from 'zod';
import { MembershipStatus } from '@prisma/client';
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true
});

export const groupMessagesRouter = router({
  // sendMessage: Allows a member to send a message to the group
  sendMessage: privateProcedure
    .input(z.object({
      groupId: z.string(),
      content: z.string().min(1).max(1000)
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, content } = input;

      const membership = await db.groupMembership.findFirst({
        where: { groupId, userId, status: MembershipStatus.Active },
        include: { user: { select: { firstName: true, lastName: true } } }
      });

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Must be a member to send messages' });
      }

      const message = await db.message.create({
        data: { content, groupId, senderId: userId },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true } }
        }
      });

      await pusher.trigger(`group-${groupId}`, 'new-message', {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        sender: {
          id: message.sender.id,
          firstName: message.sender.firstName,
          lastName: message.sender.lastName
        }
      });

      return message;
    }),

  // getGroupMessages: Retrieves messages for a group with pagination
  getGroupMessages: privateProcedure
    .input(z.object({
      groupId: z.string(),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, limit, cursor } = input;

      const membership = await db.groupMembership.findFirst({
        where: { groupId, userId, status: MembershipStatus.Active }
      });

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this group' });
      }

      const messages = await db.message.findMany({
        where: { groupId },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true } }
        }
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (messages.length > limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem!.id;
      }

      await db.groupMembership.update({
        where: { id: membership.id },
        data: { lastReadAt: new Date() }
      });

      return {
        messages: messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          createdAt: msg.createdAt.toISOString(),
          sender: {
            id: msg.sender.id,
            firstName: msg.sender.firstName,
            lastName: msg.sender.lastName
          }
        })),
        nextCursor
      };
    }),

  // getNewMessagesCount: Fetches count of new messages for all groups the user is in
  getNewMessagesCount: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    try {
      const memberships = await db.groupMembership.findMany({
        where: { userId, status: MembershipStatus.Active },
        select: {
          id: true,
          groupId: true,
          lastReadAt: true,
          group: { select: { id: true, name: true, status: true } }
        }
      });

      const validMemberships = memberships.filter(
        m => m.group !== null && m.group.status === 'Active'
      );

      const newMessagesCounts = await Promise.all(
        validMemberships.map(async m => {
          const count = await db.message.count({
            where: {
              groupId: m.groupId,
              createdAt: { gt: m.lastReadAt ?? new Date(0) },
            },
          });
          return {
            groupId: m.groupId,
            groupName: m.group!.name,
            newMessageCount: count,
          };
        })
      );

      return newMessagesCounts.filter(item => item.newMessageCount > 0);
    } catch (error) {
      console.error('Failed to fetch new messages count:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch new messages count',
      });
    }
  }),
});

export type GroupMessagesRouter = typeof groupMessagesRouter;
