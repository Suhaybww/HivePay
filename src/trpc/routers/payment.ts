// src/trpc/routers/payment.ts

import { router, privateProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../../db';
import { TRPCError } from '@trpc/server';
import { stripe } from '../../lib/stripe';
import { PaymentStatus, TransactionType } from '@prisma/client';

export const paymentRouter = router({
  /**
   * getUserTransactions
   * Returns all transactions for the user within a timeframe (week/month/year/all).
   * Also filters by type (contributions => Debit, payouts => Credit).
   */
  getUserTransactions: privateProcedure
    .input(z.object({
      timeframe: z.enum(['all', 'week', 'month', 'year']).default('all'),
      type: z.enum(['all', 'contributions', 'payouts']).default('all'),
      status: z.enum(['all', 'pending', 'completed', 'failed']).default('all'),
    }))
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { timeframe, type } = input;

      // 1) Build dateFilter
      let dateFilter: any = {};
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

      // 2) Build transactionType filter (Debit for contributions, Credit for payouts)
      let transactionTypeFilter: TransactionType[] | undefined;
      if (type !== 'all') {
        transactionTypeFilter = type === 'contributions' ? [TransactionType.Debit] : [TransactionType.Credit];
      }

      // 3) Query transactions
      const transactions = await db.transaction.findMany({
        where: {
          userId,
          ...(transactionTypeFilter && { transactionType: { in: transactionTypeFilter } }),
          createdAt: dateFilter,
        },
        include: {
          group: {
            select: {
              name: true,
              contributionAmount: true,
              // Renamed to cycleFrequency
              cycleFrequency: true,
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

  /**
   * getUpcomingPayments
   * For each Active membership, returns the next cycle date (for both contributions & payouts),
   * plus the amount & group name.
   */
  getUpcomingPayments: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    // 1) Find Active memberships
    const activeMemberships = await db.groupMembership.findMany({
      where: {
        userId,
        status: 'Active',
      },
      include: {
        group: {
          select: {
            name: true,
            contributionAmount: true,
            // single cycle frequency & single next cycle date
            cycleFrequency: true,
            nextCycleDate: true,
          },
        },
      },
    });

    // 2) Return relevant info for each group
    return activeMemberships.map((membership) => ({
      groupId: membership.groupId,
      groupName: membership.group.name,
      amount: membership.group.contributionAmount, // user’s contribution
      cycleFrequency: membership.group.cycleFrequency,
      nextCycleDate: membership.group.nextCycleDate,
    }));
  }),

  /**
   * getPaymentMethods
   * Returns the user’s BECS payment method + Connect account (if any).
   */
  getPaymentMethods: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    // 1) Load user’s Stripe IDs
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

    // 2) Fetch user’s BECS payment methods
    const becsPaymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'au_becs_debit',
    });

    // 3) If user has a Connect account, retrieve details
    let connectAccount = null;
    if (user.stripeAccountId) {
      connectAccount = await stripe.accounts.retrieve(user.stripeAccountId);
    }

    return {
      becsSetup: becsPaymentMethods.data[0] || null,
      connectAccount,
    };
  }),
});
