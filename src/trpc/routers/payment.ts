import { router, privateProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../../db';
import { TRPCError } from '@trpc/server';
import { stripe } from '../../lib/stripe';
import { PaymentStatus, TransactionType } from '@prisma/client';

export const paymentRouter = router({
  // Get all transactions for the user
  getUserTransactions: privateProcedure
    .input(z.object({
      timeframe: z.enum(['all', 'week', 'month', 'year']).default('all'),
      type: z.enum(['all', 'contributions', 'payouts']).default('all'),
      status: z.enum(['all', 'pending', 'completed', 'failed']).default('all'),
    }))
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { timeframe, type, status } = input;

      // Calculate date range
      let dateFilter: any = {};
      const now = new Date();
      if (timeframe !== 'all') {
        const startDate = new Date();
        switch (timeframe) {
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
        dateFilter = { gte: startDate };
      }

      // Get all transactions
      const transactions = await db.transaction.findMany({
        where: {
          userId,
          ...(type !== 'all' && {
            transactionType: type === 'contributions' ? TransactionType.Debit : TransactionType.Credit
          }),
          createdAt: dateFilter,
        },
        include: {
          group: {
            select: {
              name: true,
              contributionAmount: true,
              contributionFrequency: true,
            }
          },
          relatedPayment: true,
          relatedPayout: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return transactions;
    }),

  // Get upcoming payments
  getUpcomingPayments: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    const activeGroups = await db.groupMembership.findMany({
      where: {
        userId,
        status: 'Active',
      },
      include: {
        group: {
          select: {
            name: true,
            contributionAmount: true,
            contributionFrequency: true,
            nextContributionDate: true,
            nextPayoutDate: true,
          },
        },
      },
    });

    return activeGroups.map(membership => ({
      groupId: membership.groupId,
      groupName: membership.group.name,
      amount: membership.group.contributionAmount,
      nextContributionDate: membership.group.nextContributionDate,
      nextPayoutDate: membership.group.nextPayoutDate,
    }));
  }),

  // Get payment methods
  getPaymentMethods: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;
    
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        stripeCustomerId: true,
        stripeAccountId: true,
        becsSetupStatus: true,
      },
    });

    if (!user?.stripeCustomerId) {
      return { becsSetup: null, connectAccount: null };
    }

    // Get BECS setup
    const becsPaymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'au_becs_debit',
    });

    // Get Connect account details if exists
    let connectAccount = null;
    if (user.stripeAccountId) {
      connectAccount = await stripe.accounts.retrieve(user.stripeAccountId);
    }

    return {
      becsSetup: becsPaymentMethods.data[0],
      connectAccount,
    };
  }),
});