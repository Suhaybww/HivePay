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
// Updated Query with Debugging Logs
getUserTransactions: privateProcedure
  .input(z.object({
    timeframe: z.enum(['all', 'week', 'month', 'year']),
    type: z.enum(['all', 'contributions', 'payouts']),
  }))
  .query(async ({ ctx, input }) => {
    const { userId } = ctx;
    const { timeframe, type } = input;

    // 1. Date Filtering (UTC)
    let dateFilter = {};
    const now = new Date();
    switch (timeframe) {
      case 'week':
        dateFilter = { gte: new Date(now.setDate(now.getDate() - 7)) };
        break;
      case 'month':
        dateFilter = { gte: new Date(now.setMonth(now.getMonth() - 1)) };
        break;
      case 'year':
        dateFilter = { gte: new Date(now.setFullYear(now.getFullYear() - 1)) };
        break;
      case 'all':
      default:
        break;
    }

    // 2. Fetch Transactions with Linked Payment/Payout
    const transactions = await ctx.db.transaction.findMany({
      where: {
        userId,
        createdAt: timeframe !== 'all' ? dateFilter : undefined,
        transactionType: type === 'contributions' 
          ? 'Debit' 
          : type === 'payouts' 
            ? 'Credit' 
            : undefined,
      },
      include: {
        group: {
          select: { name: true }
        },
        relatedPayment: true, // Include Payment details
        relatedPayout: true,  // Include Payout details
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Map to Unified Response
    return transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.transactionType,
      date: t.createdAt,
      groupName: t.group?.name || 'N/A',
      // Include payment/payout-specific details
      paymentId: t.relatedPayment?.id,
      payoutId: t.relatedPayout?.id,
      status: t.relatedPayment?.status || t.relatedPayout?.status,
    }));
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
