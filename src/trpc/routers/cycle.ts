import { privateProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { z } from 'zod';
import { SchedulerService } from '../../lib/services/schedulerService';
import { stripe } from '../../lib/stripe';
import { contributionQueue, payoutQueue } from '../../lib/queue/config';
import { Prisma, PaymentStatus, PayoutStatus, TransactionType, Frequency, GroupStatus, MembershipStatus } from '@prisma/client';

export const cycleRouter = router({

  startContributionCycle: privateProcedure
    .input(
      z.object({
        groupId: z.string(),
        scheduleDate: z.string().or(z.date()).transform((val) => new Date(val)),
        payoutDate: z.string().or(z.date()).transform((val) => new Date(val)),
      })
    )
    .mutation(async ({ input }) => {
      const { groupId, scheduleDate, payoutDate } = input;

      const group = await db.group.findUnique({
        where: { id: groupId },
        include: {
          groupMemberships: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  stripeCustomerId: true, // Customer ID for BECS debit
                },
              },
            },
          },
        },
      });

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }

      const { contributionAmount, nextContributionDate, groupMemberships, contributionFrequency } = group;

      if (!contributionAmount || !nextContributionDate || !contributionFrequency) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Contribution settings are incomplete',
        });
      }

      // Ensure each member has a BECS payment method set up
      for (const member of groupMemberships) {
        const { stripeCustomerId, email } = member.user;

        if (!stripeCustomerId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `User ${email} has not completed Stripe setup.`,
          });
        }

        // Check if the BECS payment method is set up for the user
        const paymentMethods = await stripe.paymentMethods.list({
          customer: stripeCustomerId,
          type: 'au_becs_debit',
        });

        const paymentMethod = paymentMethods.data[0];
        if (!paymentMethod) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `No BECS payment method found for user ${email}.`,
          });
        }

        // Create PaymentIntent for each user in the group
        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: contributionAmount.toNumber() * 100, // in cents
            currency: 'aud',
            customer: stripeCustomerId, // Use customer ID here
            payment_method: paymentMethod.id,
            confirm: true,
            off_session: true,
            metadata: {
              groupId: groupId,
              userId: member.user.id,
              scheduleDate: scheduleDate.toISOString(), 
              payoutDate: payoutDate.toISOString(),
            },
          });

          // Store the payment record in your database
          await db.payment.create({
            data: {
              groupId,
              userId: member.user.id,
              amount: contributionAmount,
              stripePaymentIntentId: paymentIntent.id,
              paymentDate: new Date(),
              status: 'Pending',
            },
          });
        } catch (error) {
          console.error(`Failed to create payment for user ${email}:`, error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create payment for contribution.',
          });
        }
      }

      const updatedNextContributionDate = calculateNextDate(
        nextContributionDate,
        contributionFrequency
      );

      await db.group.update({
        where: { id: groupId },
        data: { nextContributionDate: updatedNextContributionDate },
      });

      return { success: true };
    }),

  processPayout: privateProcedure
    .input(
      z.object({
        groupId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { groupId } = input;

      // Fetch the group and its payments
      const group = await db.group.findUnique({
        where: { id: groupId },
        include: {
          groupMemberships: {
            orderBy: { payoutOrder: 'asc' },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  stripeAccountId: true,
                },
              },
            },
          },
          payments: {
            where: { status: PaymentStatus.Successful },
          },
          payouts: true,
        },
      });

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }

      // Check if all payments have been successful
      const totalMembers = group.groupMemberships.length;
      const successfulPayments = group.payments.length;

      if (successfulPayments < totalMembers) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Not all payments have been completed',
        });
      }

      // Identify the next user to receive the payout
      const lastPayout = await db.payout.findFirst({
        where: { groupId },
        orderBy: { payoutOrder: 'desc' },
      });

      let nextPayoutOrder = 1;
      if (lastPayout) {
        nextPayoutOrder = lastPayout.payoutOrder + 1;
      }

      const nextMember = group.groupMemberships.find(
        (member) => member.payoutOrder === nextPayoutOrder
      );

      if (!nextMember) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No eligible member found for payout',
        });
      }

      const { stripeAccountId } = nextMember.user;

      if (!stripeAccountId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `User ${nextMember.user.email} has not completed Stripe Connect onboarding`,
        });
      }

      // Calculate the total amount collected
      const totalAmount = group.payments.reduce((acc, payment) => {
        return acc + payment.amount.toNumber();
      }, 0);

      // Initiate the transfer via Stripe Connect
      try {
        const transfer = await stripe.transfers.create({
          amount: Math.round(totalAmount * 100), // Convert to cents
          currency: 'aud',
          destination: stripeAccountId,
          metadata: {
            groupId,
            userId: nextMember.user.id,
          },
        });

        // Check the connected account's balance
        const connectedAccountBalance = await stripe.balance.retrieve({
          stripeAccount: stripeAccountId,
        });

        const pendingBalance = connectedAccountBalance.pending.find(
          (balance) => balance.currency === 'aud'
        );

        if (
          pendingBalance &&
          pendingBalance.amount >= Math.round(totalAmount * 100)
        ) {
          // Funds are pending in the connected account
          // Create a payout record with status 'Completed'
          const payout = await db.payout.create({
            data: {
              groupId,
              userId: nextMember.user.id,
              scheduledPayoutDate: new Date(),
              amount: new Prisma.Decimal(totalAmount),
              status: PayoutStatus.Completed,
              stripeTransferId: transfer.id,
              payoutOrder: nextPayoutOrder,
            },
          });

          // Create a transaction record
          await db.transaction.create({
            data: {
              userId: nextMember.user.id,
              groupId,
              amount: new Prisma.Decimal(totalAmount),
              transactionType: TransactionType.Credit,
              description: `Payout for group ${group.name}`,
              transactionDate: new Date(),
              relatedPayoutId: payout.id,
            },
          });

          return { success: true };
        } else {
          console.error('Funds not yet available in connected account');
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Funds not yet available in connected account',
          });
        }
      } catch (error) {
        console.error(
          `Failed to transfer funds to user ${nextMember.user.email}:`,
          error
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to transfer funds',
        });
      }
    }),

  scheduleGroupCycles: privateProcedure
    .input(z.object({
      groupId: z.string(),
      startDate: z.date().optional(),
      contributionDate: z.date(),
      payoutDate: z.date()
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, contributionDate, payoutDate } = input;

      // Verify admin status
      const membership = await db.groupMembership.findFirst({
        where: {
          groupId,
          userId,
          isAdmin: true,
        },
        include: {
          group: true
        }
      });

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can schedule group cycles',
        });
      }

      try {
        // Update group with new dates and start cycle
        await db.group.update({
          where: { id: groupId },
          data: {
            nextContributionDate: contributionDate,
            nextPayoutDate: payoutDate,
            cycleStarted: true,
            status: GroupStatus.Active
          }
        });

        // Schedule both contribution and payout cycles
        await SchedulerService.scheduleContributionCycle(groupId);
        await SchedulerService.schedulePayoutProcessing(groupId);

        return {
          success: true,
          message: 'Group cycles scheduled successfully',
          nextContributionDate: contributionDate,
          nextPayoutDate: payoutDate
        };
      } catch (error) {
        console.error('Failed to schedule group cycles:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to schedule group cycles',
        });
      }
    }),

  pauseGroupCycles: privateProcedure
    .input(z.object({
      groupId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;

      // Verify admin status
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
          message: 'Only admins can pause group cycles',
        });
      }

      try {
        // Remove all scheduled jobs for this group
        const contributionJobs = await contributionQueue.getJobs(['delayed', 'waiting']);
        const payoutJobs = await payoutQueue.getJobs(['delayed', 'waiting']);

        for (const job of contributionJobs) {
          if (job.data.groupId === input.groupId) {
            await job.remove();
          }
        }

        for (const job of payoutJobs) {
          if (job.data.groupId === input.groupId) {
            await job.remove();
          }
        }

        // Update group status
        await db.group.update({
          where: { id: input.groupId },
          data: {
            status: GroupStatus.Paused,
            cycleStarted: false
          }
        });

        return {
          success: true,
          message: 'Group cycles paused successfully'
        };
      } catch (error) {
        console.error('Failed to pause group cycles:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to pause group cycles',
        });
      }
    }),

  resumeGroupCycles: privateProcedure
    .input(z.object({
      groupId: z.string(),
      resumeDate: z.date()
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { groupId, resumeDate } = input;

      // Verify admin status
      const membership = await db.groupMembership.findFirst({
        where: {
          groupId,
          userId,
          isAdmin: true,
        },
        include: {
          group: {
            select: {
              contributionFrequency: true,
              payoutFrequency: true
            }
          }
        }
      });

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can resume group cycles',
        });
      }

      try {
        // Calculate next contribution and payout dates (if needed)
        let nextContributionDate = new Date(resumeDate);
        let nextPayoutDate = new Date(resumeDate);

        // Update group status and dates
        await db.group.update({
          where: { id: groupId },
          data: {
            status: GroupStatus.Active,
            nextContributionDate,
            nextPayoutDate,
            cycleStarted: true
          }
        });

        // Schedule new cycles
        await SchedulerService.scheduleContributionCycle(groupId);
        await SchedulerService.schedulePayoutProcessing(groupId);

        return {
          success: true,
          message: 'Group cycles resumed successfully',
          nextContributionDate,
          nextPayoutDate
        };
      } catch (error) {
        console.error('Failed to resume group cycles:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to resume group cycles',
        });
      }
    }),

  getGroupSchedule: privateProcedure
    .input(z.object({
      groupId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;

      // Verify membership
      const membership = await db.groupMembership.findFirst({
        where: {
          groupId: input.groupId,
          userId,
          status: MembershipStatus.Active
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Must be an active member to view group schedule',
        });
      }

      try {
        // Get group details
        const group = await db.group.findUnique({
          where: { id: input.groupId },
          select: {
            nextContributionDate: true,
            nextPayoutDate: true,
            contributionFrequency: true,
            payoutFrequency: true,
            status: true,
            cycleStarted: true
          }
        });

        if (!group) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Group not found',
          });
        }

        // Get upcoming jobs
        const contributionJobs = await contributionQueue.getJobs(['delayed', 'waiting']);
        const payoutJobs = await payoutQueue.getJobs(['delayed', 'waiting']);

        const groupContributionJobs = contributionJobs
          .filter(job => job.data.groupId === input.groupId)
          .map(job => ({
            id: job.id,
            scheduledFor: new Date(Date.now() + (job.opts.delay || 0))
          }));

        const groupPayoutJobs = payoutJobs
          .filter(job => job.data.groupId === input.groupId)
          .map(job => ({
            id: job.id,
            scheduledFor: new Date(Date.now() + (job.opts.delay || 0))
          }));

        return {
          currentSchedule: {
            nextContributionDate: group.nextContributionDate,
            nextPayoutDate: group.nextPayoutDate,
            contributionFrequency: group.contributionFrequency,
            payoutFrequency: group.payoutFrequency,
            status: group.status,
            cycleStarted: group.cycleStarted
          },
          upcomingContributions: groupContributionJobs,
          upcomingPayouts: groupPayoutJobs
        };
      } catch (error) {
        console.error('Failed to get group schedule:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get group schedule',
        });
      }
    }),

});

// Helper function to calculate the next contribution date
function calculateNextDate(currentDate: Date, frequency: Frequency): Date {
  const nextDate = new Date(currentDate);
  switch (frequency) {
    case 'Weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'BiWeekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'Monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }
  return nextDate;
}

export type CycleRouter = typeof cycleRouter;
