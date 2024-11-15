import { privateProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { z } from 'zod';
import {
  Prisma,
  MembershipStatus,
  Frequency,
  PayoutOrderMethod,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { GroupWithStats } from '../../types/groups';
import { subscriptionCheck } from '../middlewares';

import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true
});

export const groupRouter = router({
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
          _count: {
            select: { groupMemberships: true },
          },
          payments: {
            select: {
              amount: true,
            },
          },
          payouts: {
            select: {
              amount: true,
            },
          },
          createdBy: {
            select: {
              id: true,
            },
          },
          groupMemberships: {
            where: {
              status: MembershipStatus.Active,
            },
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
            orderBy: {
              payoutOrder: 'asc',
            },
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
  
        // Transform the members data
        const members = group.groupMemberships.map(membership => ({
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
          createdById: group.createdById,
          payoutOrderMethod: group.payoutOrderMethod,
          contributionAmount: group.contributionAmount?.toFixed(2) ?? null,
          contributionFrequency: group.contributionFrequency,
          payoutFrequency: group.payoutFrequency,
          nextContributionDate:
            group.nextContributionDate?.toISOString() ?? null,
          nextPayoutDate: group.nextPayoutDate?.toISOString() ?? null,
          cycleStarted: group.cycleStarted, 
          _count: group._count,
          totalContributions: totalContributions.toFixed(2),
          currentBalance: currentBalance.toFixed(2),
          isAdmin: group.createdById === userId,
          members, // Add the members array to the response
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
  
  getGroupById: privateProcedure
  .input(z.object({ groupId: z.string() }))
  .query(async ({ ctx, input }) => {
    const { userId } = ctx;

    const group = await db.group.findUnique({
      where: { id: input.groupId },
      include: {
        _count: {
          select: { groupMemberships: true },
        },
        payments: true,
        payouts: true,
        groupMemberships: {
          where: {
            status: MembershipStatus.Active,
          },
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
        },
      },
    });

    console.log('Raw group memberships:', JSON.stringify(group?.groupMemberships, null, 2));

    if (!group) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    // Check if the current user is a member
    const userMembership = group.groupMemberships.find(m => m.user.id === userId);
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

    // Transform members data
    const members = group.groupMemberships.map(membership => ({
      id: membership.user.id,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      email: membership.user.email,
      gender: membership.user.gender,
      isAdmin: membership.isAdmin,
      payoutOrder: membership.payoutOrder, 
      stripeAccountId: membership.user.stripeAccountId  
    }));

    console.log('Transformed members:', JSON.stringify(members, null, 2));


    const groupWithStats: GroupWithStats = {
      id: group.id,
      name: group.name,
      description: group.description,
      createdById: group.createdById,
      payoutOrderMethod: group.payoutOrderMethod,
      contributionAmount: group.contributionAmount?.toString() || null,
      contributionFrequency: group.contributionFrequency,
      payoutFrequency: group.payoutFrequency,
      nextContributionDate: group.nextContributionDate?.toISOString() || null,
      nextPayoutDate: group.nextPayoutDate?.toISOString() || null,
      cycleStarted: group.cycleStarted, // **Added Property**
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


  createGroup: privateProcedure
    .input(
      z.object({
        name: z.string().min(3),
        description: z.string().optional(),
        contributionAmount: z.string(),
        contributionFrequency: z.enum([
          'Daily',
          'Weekly',
          'BiWeekly',
          'Monthly',
          'Custom',
        ]),
        payoutFrequency: z.enum([
          'Daily',
          'Weekly',
          'BiWeekly',
          'Monthly',
          'Custom',
        ]),
        payoutOrderMethod: z.enum(['Admin_Selected', 'First_Come_First_Serve']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      await subscriptionCheck(userId);

      try {
        // Check group creation limit
        const userGroups = await db.group.count({
          where: {
            createdById: userId,
          },
        });

        if (userGroups >= 5) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message:
              'You have reached the maximum number of groups you can create with your current plan.',
          });
        }

        // Create group
        const group = await db.group.create({
          data: {
            name: input.name,
            description: input.description,
            createdById: userId,
            contributionAmount: parseFloat(input.contributionAmount),
            contributionFrequency: input.contributionFrequency as Frequency,
            payoutFrequency: input.payoutFrequency as Frequency,
            payoutOrderMethod: input.payoutOrderMethod as PayoutOrderMethod,
          },
        });

        // Create membership
        await db.groupMembership.create({
          data: {
            groupId: group.id,
            userId: userId,
            isAdmin: true,
            payoutOrder: 1,
            status: MembershipStatus.Active,
          },
        });

        return {
          success: true,
          group,
          redirectUrl: `/group/${group.id}`,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('Failed to create group:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create group',
        });
      }
    }),

  joinGroup: privateProcedure
    .input(
      z.object({
        groupId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      await subscriptionCheck(userId);

      try {
        // Check membership limit
        const userMemberships = await db.groupMembership.count({
          where: {
            userId: userId,
          },
        });

        if (userMemberships >= 5) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message:
              'You have reached the maximum number of groups you can join with your current plan.',
          });
        }

        // Check if group exists
        const group = await db.group.findUnique({
          where: { id: input.groupId },
          include: {
            groupMemberships: true,
          },
        });

        if (!group) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Group not found',
          });
        }

        // Check for existing membership
        const existingMembership = await db.groupMembership.findFirst({
          where: {
            groupId: input.groupId,
            userId: userId,
          },
        });

        if (existingMembership) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'You are already a member of this group',
          });
        }

        // Create membership
        const membership = await db.groupMembership.create({
          data: {
            groupId: input.groupId,
            userId: userId,
            isAdmin: false,
            payoutOrder: group.groupMemberships.length + 1,
            status: MembershipStatus.Active,
          },
        });

        return {
          success: true,
          membership,
          redirectUrl: `/group/${input.groupId}`,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('Failed to join group:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to join group',
        });
      }
    }),

getGroupAnalytics: privateProcedure
  .input(z.object({ 
    groupId: z.string(),
    timeframe: z.enum(['week', 'month', 'year']).default('month')
  }))
  .query(async ({ ctx, input }) => {
    const { userId } = ctx;
    const startDate = new Date();
    const endDate = new Date();

    // Set date range based on timeframe
    switch (input.timeframe) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    // Verify membership
    const membership = await db.groupMembership.findFirst({
      where: {
        groupId: input.groupId,
        userId,
        status: MembershipStatus.Active
      }
    });

    if (!membership) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Not a member of this group'
      });
    }

    // Fetch all required data
    const [
      contributions,
      memberships,
      payouts,
      payments,
      historicalMembers
    ] = await Promise.all([
      // Contributions over time
      db.payment.groupBy({
        by: ['paymentDate'],
        where: {
          groupId: input.groupId,
          createdAt: { 
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          amount: true
        },
        _count: true,
      }),

      // Current member activity
      db.groupMembership.findMany({
        where: {
          groupId: input.groupId,
          status: MembershipStatus.Active
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }),

      // Payouts
      db.payout.findMany({
        where: {
          groupId: input.groupId,
          createdAt: { 
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }),

      // All payments for status analysis
      db.payment.findMany({
        where: {
          groupId: input.groupId,
          createdAt: { 
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          user: true
        }
      }),

      // Historical member data for growth calculation
      db.groupMembership.groupBy({
        by: ['joinDate'],
        where: {
          groupId: input.groupId,
          joinDate: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: true
      })
    ]);

    // Calculate metrics
    const totalMembers = memberships.length;
    const previousCount = await db.groupMembership.count({
      where: {
        groupId: input.groupId,
        status: MembershipStatus.Active,
        joinDate: {
          lt: startDate
        }
      }
    });

    // Calculate member growth
    const memberGrowth = previousCount > 0 
      ? ((totalMembers - previousCount) / previousCount) * 100
      : 100;

    // Calculate average contribution
    const totalContributions = payments.reduce((sum, payment) => 
      sum + Number(payment.amount), 0
    );
    const averageContribution = totalContributions / payments.length || 0;

    // Calculate on-time payment rate
    const onTimePayments = payments.filter(payment => 
      new Date(payment.paymentDate) <= new Date(payment.createdAt)
    ).length;
    const onTimePaymentRate = (onTimePayments / payments.length) * 100 || 0;

    // Calculate member retention
    const leftMembers = await db.groupMembership.count({
      where: {
        groupId: input.groupId,
        status: MembershipStatus.Inactive,
        updatedAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });
    
    const retentionRate = ((totalMembers - leftMembers) / totalMembers) * 100 || 0;

    // Calculate average payout time
    const payoutTimes = payouts.map(payout => {
      const scheduledDate = new Date(payout.scheduledPayoutDate);
      const actualDate = new Date(payout.createdAt);
      return Math.ceil((actualDate.getTime() - scheduledDate.getTime()) / (1000 * 3600 * 24));
    });
    const averagePayoutTime = payoutTimes.reduce((sum, time) => sum + time, 0) / payoutTimes.length || 0;

    // Format contribution data
    const formattedContributions = contributions.map(c => ({
      date: c.paymentDate.toISOString(),
      amount: Number(c._sum.amount),
      count: c._count
    }));

    // Calculate member activity
    const memberActivity = historicalMembers.map(m => {
      const monthData = {
        month: new Date(m.joinDate).toLocaleDateString('en-US', { month: 'short' }),
        activeMembers: totalMembers,
        newMembers: m._count,
        leftMembers: 0 // You'll need to add logic to calculate this
      };
      return monthData;
    });

    // Calculate payout distribution
    const payoutDistribution = memberships.map(member => {
      const memberPayouts = payouts.filter(p => p.userId === member.userId);
      const totalPayout = memberPayouts.reduce((sum, p) => sum + Number(p.amount), 0);
      const percentage = (totalPayout / totalContributions) * 100 || 0;
      
      return {
        member: `${member.user.firstName} ${member.user.lastName}`,
        amount: totalPayout,
        percentage: Math.round(percentage * 10) / 10
      };
    }).sort((a, b) => b.amount - a.amount);

    // Payment status distribution
    const paymentStatus = {
      onTime: onTimePayments,
      late: payments.filter(payment => 
        new Date(payment.paymentDate) > new Date(payment.createdAt)
      ).length,
      missed: totalMembers * payments.length - payments.length
    };

    return {
      contributions: formattedContributions,
      memberActivity,
      payoutDistribution,
      metrics: {
        totalMembers,
        memberGrowth: Math.round(memberGrowth * 10) / 10,
        averageContribution,
        contributionGrowth: 0, // You can add logic to calculate this
        retentionRate: Math.round(retentionRate * 10) / 10,
        totalPaidOut: totalContributions,
        onTimePaymentRate: Math.round(onTimePaymentRate * 10) / 10,
        averagePayoutTime: Math.round(averagePayoutTime * 10) / 10,
      },
      paymentStatus,
  };
  }),


// Update the sendMessage mutation:
sendMessage: privateProcedure
  .input(z.object({
    groupId: z.string(),
    content: z.string().min(1).max(1000)
  }))
  .mutation(async ({ ctx, input }) => {
    const { userId } = ctx;

    // First check membership
    const membership = await db.groupMembership.findFirst({
      where: {
        groupId: input.groupId,
        userId,
        status: MembershipStatus.Active
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!membership) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Must be a member to send messages'
      });
    }

    // Create message
    const message = await db.message.create({
      data: {
        content: input.content,
        groupId: input.groupId,
        senderId: userId
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Trigger Pusher event with the new message
    await pusher.trigger(`group-${input.groupId}`, 'new-message', {
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

// Update getGroupMessages to include sender id
getGroupMessages: privateProcedure
  .input(z.object({ 
    groupId: z.string(),
    limit: z.number().min(1).max(100).default(50),
    cursor: z.string().optional()
  }))
  .query(async ({ ctx, input }) => {
    const { userId } = ctx;

    // Verify membership
    const membership = await db.groupMembership.findFirst({
      where: {
        groupId: input.groupId,
        userId,
        status: MembershipStatus.Active
      }
    });

    if (!membership) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Not a member of this group'
      });
    }

    const messages = await db.message.findMany({
      where: { groupId: input.groupId },
      take: input.limit + 1,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true, // Added this
            firstName: true,
            lastName: true
          }
        }
      }
    });

    let nextCursor: typeof input.cursor | undefined = undefined;
    if (messages.length > input.limit) {
      const nextItem = messages.pop();
      nextCursor = nextItem!.id;
    }

    return {
      messages: messages.map(message => ({
        id: message.id,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        sender: {
          id: message.sender.id,
          firstName: message.sender.firstName,
          lastName: message.sender.lastName
        }
      })),
      nextCursor
    };
  }),

  getGroupMembersSetupStatus: privateProcedure
  .input(z.object({ groupId: z.string() }))
  .query(async ({ input, ctx }) => {
    const { userId } = ctx;

    // Verify that the user is a member of the group
    const isMember = await db.groupMembership.findFirst({
      where: {
        groupId: input.groupId,
        userId,
        status: MembershipStatus.Active,
      },
    });

    if (!isMember) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not a member of this group',
      });
    }

    try {
      // Fetch group members with their setup statuses
      const groupMembers = await db.groupMembership.findMany({
        where: { groupId: input.groupId, status: MembershipStatus.Active },
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
        orderBy: {
          payoutOrder: 'asc',
        },
      });

      // Map the members to include necessary data
      const members = groupMembers.map((membership) => ({
        id: membership.user.id,
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        email: membership.user.email,
        gender: membership.user.gender,
        isAdmin: membership.isAdmin,
        payoutOrder: membership.payoutOrder,
        onboardingStatus: membership.user.onboardingStatus,
        becsSetupStatus: membership.user.becsSetupStatus,
      }));

      return members;
    } catch (error) {
      console.error('Failed to fetch group members setup status:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch group members setup status',
      });
    }
  }),

// Get Group Details by ID
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
              user: { select: { id: true, firstName: true, lastName: true, email: true, gender: true, stripeAccountId: true } },
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

      const groupDetails: GroupWithStats = {
        id: group.id,
        name: group.name,
        description: group.description,
        createdById: group.createdBy.id,
        payoutOrderMethod: group.payoutOrderMethod,
        contributionAmount: group.contributionAmount?.toFixed(2) ?? null,
        contributionFrequency: group.contributionFrequency,
        payoutFrequency: group.payoutFrequency,
        nextContributionDate: group.nextContributionDate?.toISOString() ?? null,
        nextPayoutDate: group.nextPayoutDate?.toISOString() ?? null,
        cycleStarted: group.cycleStarted, // **Added Property**
        _count: group._count,
        totalContributions: totalContributions.toFixed(2),
        currentBalance: currentBalance.toFixed(2),
        isAdmin: group.createdBy.id === userId,
        members,
      };

      return groupDetails;
    } catch (error) {
      console.error('Failed to fetch group details:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch group details',
      });
    }
}),

// Update Group Dates
updateGroupDates: privateProcedure
  .input(
    z.object({
      groupId: z.string(),
      scheduleDate: z.union([z.date(), z.string()]).transform((val) => 
        typeof val === 'string' ? new Date(val) : val
      ).optional(),
      payoutDate: z.union([z.date(), z.string()]).transform((val) => 
        typeof val === 'string' ? new Date(val) : val
      ).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { groupId, scheduleDate, payoutDate } = input;
    const { userId } = ctx;

    try {
      const group = await db.group.findUnique({
        where: { id: groupId },
        include: {
          createdBy: { select: { id: true } },
        },
      });

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }

      const isAdmin = group.createdBy.id === userId;
      if (!isAdmin) {
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








  updateGroupSettings: privateProcedure
    .input(z.object({
      groupId: z.string(),
      name: z.string().min(3).optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      // Check if user is admin
      const membership = await db.groupMembership.findFirst({
        where: {
          groupId: input.groupId,
          userId,
          isAdmin: true,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can update group settings',
        });
      }

      // Update group
      const updatedGroup = await db.group.update({
        where: { id: input.groupId },
        data: {
          name: input.name,
          description: input.description,
        },
      });

      return updatedGroup;
    }),

    transferAdminRole: privateProcedure
    .input(z.object({
      groupId: z.string(),
      newAdminId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      try {
        // First find the current user's membership
        const currentUserMembership = await db.groupMembership.findFirst({
          where: {
            groupId: input.groupId,
            userId,
            isAdmin: true,
          },
        });

        if (!currentUserMembership) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only admins can transfer admin role',
          });
        }

        // Find the new admin's membership
        const newAdminMembership = await db.groupMembership.findFirst({
          where: {
            groupId: input.groupId,
            userId: input.newAdminId,
          },
        });

        if (!newAdminMembership) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'New admin not found in group',
          });
        }

        // Start a transaction to update both memberships
        await db.$transaction([
          db.groupMembership.update({
            where: {
              id: currentUserMembership.id
            },
            data: {
              isAdmin: false,
            },
          }),
          db.groupMembership.update({
            where: {
              id: newAdminMembership.id
            },
            data: {
              isAdmin: true,
            },
          }),
        ]);

        return { success: true };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to transfer admin role',
          });
        }
        throw error;
      }
    }),
  
  removeMember: privateProcedure
    .input(z.object({
      groupId: z.string(),
      memberId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
  
      // Get group and check permissions
      const membership = await db.groupMembership.findFirst({
        where: {
          groupId: input.groupId,
          userId,
          isAdmin: true,
        },
        include: {
          group: true,
        },
      });
  
      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can remove members',
        });
      }
  
      if (membership.group.cycleStarted) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot remove members after cycle has started',
        });
      }
  
      // Find the membership to remove
      const membershipToRemove = await db.groupMembership.findFirst({
        where: {
          groupId: input.groupId,
          userId: input.memberId,
        },
      });
  
      if (!membershipToRemove) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found',
        });
      }
  
      // Remove member
      await db.groupMembership.delete({
        where: {
          id: membershipToRemove.id
        },
      });
  
      return { success: true };
    }),
  
  leaveGroup: privateProcedure
    .input(z.object({
      groupId: z.string(),
      newAdminId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
  
      // Get user's membership and group details
      const membership = await db.groupMembership.findFirst({
        where: {
          groupId: input.groupId,
          userId,
        },
        include: {
          group: true,
        },
      });
  
      if (!membership) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Membership not found',
        });
      }
  
      if (membership.group.cycleStarted) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot leave group after cycle has started',
        });
      }
  
      // If user is admin, handle admin transfer
      if (membership.isAdmin) {
        if (!input.newAdminId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Must specify new admin when leaving as admin',
          });
        }
  
        const newAdminMembership = await db.groupMembership.findFirst({
          where: {
            groupId: input.groupId,
            userId: input.newAdminId,
          },
        });
  
        if (!newAdminMembership) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'New admin not found in group',
          });
        }
  
        // Transfer admin role
        await db.groupMembership.update({
          where: {
            id: newAdminMembership.id
          },
          data: {
            isAdmin: true,
          },
        });
      }
  
      // Remove user's membership
      await db.groupMembership.delete({
        where: {
          id: membership.id
        },
      });
  
      return { success: true };
    }),

    updatePayoutOrder: privateProcedure
    .input(z.object({
      groupId: z.string(),
      memberOrders: z.array(z.object({
        memberId: z.string(),
        newOrder: z.number(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      // Verify user is admin
      const membership = await db.groupMembership.findFirst({
        where: {
          groupId: input.groupId,
          userId,
          isAdmin: true,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can update payout order',
        });
      }

      // Get group to check if cycle started
      const group = await db.group.findUnique({
        where: { id: input.groupId },
      });

      if (group?.cycleStarted) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot update payout order after cycle has started',
        });
      }

      // First get all memberships to update
      const membershipsToUpdate = await db.groupMembership.findMany({
        where: {
          groupId: input.groupId,
          userId: {
            in: input.memberOrders.map(m => m.memberId)
          }
        }
      });

      // Update all member orders in a transaction
      await db.$transaction(
        input.memberOrders.map(({ memberId, newOrder }) => {
          const membership = membershipsToUpdate.find(m => m.userId === memberId);
          if (!membership) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: `Member ${memberId} not found in group`,
            });
          }
          return db.groupMembership.update({
            where: {
              id: membership.id
            },
            data: {
              payoutOrder: newOrder,
            },
          });
        })
      );

      return { success: true };
    }),
});

export type GroupRouter = typeof groupRouter;
