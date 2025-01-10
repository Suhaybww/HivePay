// src/lib/queue/processors.ts

import { Job } from 'bull';
import { db } from '@/src/db';
import { stripe } from '@/src/lib/stripe';
import {
  PaymentStatus,
  MembershipStatus,
  GroupStatus,
  PauseReason,
  SubscriptionStatus,
} from '@prisma/client';
import { SchedulerService } from '../services/schedulerService';
import {
  sendPaymentFailureEmail,
  sendGroupPausedNotificationEmail,
  sendGroupCycleStartedEmail,
} from '@/src/lib/emailService';

// import the queue so we can schedule 'retry-failed-payment' jobs
import { paymentQueue } from './paymentQueue';

/**
 * processContributionCycle
 * 1) For each active member => PaymentIntent => next user’s connected account
 * 2) Create Payout record for next in line
 * 3) If all got payouts => end. Else => schedule next
 */
export async function processContributionCycle(job: Job) {
  const { groupId } = job.data;
  console.log(`\n=== processContributionCycle started for group=${groupId} ===`);

  try {
    await db.$transaction(async (tx) => {
      // 1) load group + members
      const group = await tx.group.findUnique({
        where: { id: groupId },
        include: {
          groupMemberships: {
            where: { status: MembershipStatus.Active },
            include: { user: true },
          },
          payouts: {
            orderBy: { payoutOrder: 'desc' },
          },
        },
      });
      if (!group || group.status !== GroupStatus.Active) {
        throw new Error(`Group ${groupId} not active/found`);
      }
      if (!group.contributionAmount || group.contributionAmount.lte(0)) {
        throw new Error(`Invalid contributionAmount for group ${groupId}`);
      }

      const safeDecimal = group.contributionAmount;
      const activeMembers = group.groupMemberships;
      const currentPayouts = group.payouts;

      // 2) nextPayoutOrder
      let nextPayoutOrder = 1;
      if (currentPayouts.length > 0) {
        nextPayoutOrder = currentPayouts[0].payoutOrder + 1;
      }

      if (nextPayoutOrder > activeMembers.length) {
        // all got payouts => done
        await tx.group.update({
          where: { id: group.id },
          data: {
            cycleStarted: false,
            status: GroupStatus.Paused, // or "Completed"
            pauseReason: PauseReason.OTHER,
          },
        });
        console.log(`All members paid => group ${group.id} ended.`);

        const allActiveEmails = activeMembers.map((m) => ({
          email: m.user.email,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
        }));
        await sendGroupPausedNotificationEmail(
          group.name,
          allActiveEmails,
          'All members have received a payout; cycle is complete.'
        );
        return;
      }

      // 3) next user in line
      const nextMemberForPayout = activeMembers.find(m => m.payoutOrder === nextPayoutOrder);
      if (!nextMemberForPayout) {
        throw new Error(`No user found for payoutOrder=${nextPayoutOrder}`);
      }

      const nextPayoutUser = await tx.user.findUnique({
        where: { id: nextMemberForPayout.userId },
        select: { stripeAccountId: true, email: true },
      });
      if (!nextPayoutUser?.stripeAccountId) {
        throw new Error(`Missing stripeAccountId for user: ${nextMemberForPayout.userId}`);
      }

      // 4) charge each active user => PaymentIntent => next user's connected account
      const destination = nextPayoutUser.stripeAccountId;
      const paymentPromises = activeMembers.map(async (membership) => {
        const user = membership.user;

        if (!user.stripeCustomerId || !user.stripeBecsPaymentMethodId || !user.stripeMandateId) {
          console.error(`User ${user.id} missing setup => skip payment.`);
          return null;
        }

        try {
          const pi = await stripe.paymentIntents.create({
            amount: Math.round(safeDecimal.toNumber() * 100),
            currency: 'aud',
            customer: user.stripeCustomerId,
            payment_method: user.stripeBecsPaymentMethodId,
            mandate: user.stripeMandateId,
            confirm: true,
            off_session: true,
            payment_method_types: ['au_becs_debit'],
            transfer_data: { destination },
            metadata: {
              groupId: group.id,
              userId: user.id,
              cycleDate: new Date().toISOString(),
              nextPayoutUser: nextPayoutUser.email,
            },
          });

          // Payment => Pending
          return tx.payment.create({
            data: {
              userId: user.id,
              groupId: group.id,
              amount: safeDecimal,
              status: PaymentStatus.Pending,
              stripePaymentIntentId: pi.id,
              retryCount: 0,
            },
          });
        } catch (error) {
          console.error(`PaymentIntent fail for user ${user.id}:`, error);
          // Payment => Failed, retryCount=1
          const newPayment = await tx.payment.create({
            data: {
              userId: user.id,
              groupId: group.id,
              amount: safeDecimal,
              status: PaymentStatus.Failed,
              retryCount: 1,
            },
          });

          await sendPaymentFailureEmail({
            recipient: {
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
            },
            groupName: group.name,
            amount: safeDecimal.toString(),
          });

          // If < 3 => schedule retry
          if (newPayment.retryCount < 3) {
            console.log(`Scheduling a retry for Payment ${newPayment.id} in 2 days...`);
            await paymentQueue.add(
              'retry-failed-payment',
              { paymentId: newPayment.id },
              { delay: 2 * 86400000 } // 2 days
            );
          } else {
            // 3 => pause group
            await tx.group.update({
              where: { id: group.id },
              data: {
                status: GroupStatus.Paused,
                pauseReason: PauseReason.PAYMENT_FAILURES,
              },
            });
            console.log(`Group ${group.id} paused => repeated fails from user ${user.id}`);

            const allActive = group.groupMemberships.map((m) => ({
              email: m.user.email,
              firstName: m.user.firstName,
              lastName: m.user.lastName,
            }));
            await sendGroupPausedNotificationEmail(
              group.name,
              allActive,
              `Payment failures by ${user.email}`
            );
          }
          return null;
        }
      });

      await Promise.all(paymentPromises);

      // 5) payout record => next user
      await tx.payout.create({
        data: {
          groupId: group.id,
          userId: nextMemberForPayout.userId,
          scheduledPayoutDate: new Date(),
          amount: safeDecimal,
          status: PaymentStatus.Pending,
          payoutOrder: nextPayoutOrder,
        },
      });
      console.log(`Payout #${nextPayoutOrder} => user ${nextMemberForPayout.userId}`);
    });

    // 6) check if group still active => schedule next
    const latest = await db.group.findUnique({ where: { id: groupId } });
    if (!latest || latest.status !== GroupStatus.Active || !latest.cycleStarted) {
      console.log(`Group ${groupId} is paused or ended => skip next cycle.`);
      return;
    }

    if (Array.isArray(latest.futureCyclesJson) && latest.futureCyclesJson.length > 0) {
      const arr = [...latest.futureCyclesJson];
      arr.shift();

      if (arr.length === 0) {
        // no more cycles => done
        await db.group.update({
          where: { id: groupId },
          data: {
            futureCyclesJson: [],
            cycleStarted: false,
            status: GroupStatus.Paused,
            pauseReason: PauseReason.OTHER,
          },
        });
        console.log(`No more cycles => group ${groupId} ended/paused.`);
      } else {
        const nextDateStr = arr[0] as string;
        await db.group.update({
          where: { id: groupId },
          data: {
            nextCycleDate: new Date(nextDateStr),
            futureCyclesJson: arr,
          },
        });
        console.log(`Group ${groupId} nextCycleDate=${nextDateStr}, scheduling next cycle...`);
        await SchedulerService.scheduleNextCycle(groupId);
      }
    } else {
      await SchedulerService.scheduleNextCycle(groupId);
    }

    // 7) notify group new cycle started
    const updated = await db.group.findUnique({
      where: { id: groupId },
      include: {
        groupMemberships: {
          where: { status: MembershipStatus.Active },
          include: { user: true },
        },
      },
    });
    if (updated) {
      const allActive = updated.groupMemberships.map((m) => ({
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
      }));
      await sendGroupCycleStartedEmail(updated.name, allActive);
    }

    console.log(`=== processContributionCycle success for group=${groupId} ===\n`);
  } catch (error) {
    console.error(`Failed processContributionCycle for group ${groupId}:`, error);
    throw error;
  }
}

/**
 * retryAllPaymentsForGroup:
 * 1) unpause group => set cycleStarted=true
 * 2) schedule new "start-contribution" job
 */
export async function retryAllPaymentsForGroup(groupId: string): Promise<void> {
  console.log(`\n=== Admin retryAllPaymentsForGroup triggered for group ${groupId} ===`);

  await db.group.update({
    where: { id: groupId },
    data: {
      status: GroupStatus.Active,
      pauseReason: null,
      cycleStarted: true,
    },
  });

  await SchedulerService.scheduleContributionCycle(groupId);

  console.log(`Group ${groupId} reactivated => PaymentIntents will be attempted.\n`);
}

/**
 * Retry a single Payment that previously failed
 */
export async function retryFailedPayment(job: Job) {
  const { paymentId } = job.data;
  console.log(`\n=== retry-failed-payment job for Payment ${paymentId} ===`);

  // 1) find Payment
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { user: true, group: true },
  });
  if (!payment || payment.status !== PaymentStatus.Failed) {
    console.log(`Payment not found or not in Failed => skip.`);
    return;
  }
  if (!payment.group) {
    console.error(`Payment ${payment.id} has no group => cannot retry`);
    return;
  }

  // if group paused => skip
  if (payment.group.status !== GroupStatus.Active) {
    console.log(`Group ${payment.groupId} not Active => skip Payment ${payment.id}`);
    return;
  }

  if (!payment.user?.stripeBecsPaymentMethodId || !payment.user.stripeMandateId) {
    console.error(`User missing Mandate => cannot retry Payment ${payment.id}`);
    return;
  }

  try {
    // We'll pick the same "destination" as the next in line or an admin's account, etc.
    const nextInLine = await db.groupMembership.findFirst({
      where: { groupId: payment.groupId, payoutOrder: 1 },
      include: { user: true },
    });
    if (!nextInLine?.user?.stripeAccountId) {
      throw new Error(`No next in line user found for groupId=${payment.groupId}`);
    }

    const pi = await stripe.paymentIntents.create({
      amount: Math.round(payment.amount.toNumber() * 100),
      currency: 'aud',
      customer: payment.user.stripeCustomerId!,
      payment_method: payment.user.stripeBecsPaymentMethodId!,
      mandate: payment.user.stripeMandateId!,
      confirm: true,
      off_session: true,
      payment_method_types: ['au_becs_debit'],
      transfer_data: { destination: nextInLine.user.stripeAccountId },
      metadata: {
        groupId: payment.groupId,
        userId: payment.userId,
        retryOfPayment: payment.id,
      },
    });

    // mark Payment => Pending
    await db.payment.update({
      where: { id: payment.id },
      data: {
        stripePaymentIntentId: pi.id,
        status: PaymentStatus.Pending,
      },
    });

    console.log(`Retry for Payment ${payment.id} => PaymentIntent ${pi.id}`);
  } catch (error) {
    console.error(`Retry creation failed Payment ${payment.id}:`, error);

    const updated = await db.payment.update({
      where: { id: payment.id },
      data: { retryCount: { increment: 1 } },
    });

    if (updated.retryCount >= 3) {
      // pause group
      await db.group.update({
        where: { id: payment.groupId },
        data: {
          status: GroupStatus.Paused,
          pauseReason: PauseReason.PAYMENT_FAILURES,
        },
      });
      console.log(`Group ${payment.groupId} paused => Payment ${payment.id} failed 3 times`);

      const groupMemberships = await db.groupMembership.findMany({
        where: { groupId: payment.groupId },
        include: { user: true },
      });
      const allEmails = groupMemberships.map(m => ({
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
      }));
      await sendGroupPausedNotificationEmail(
        payment.group.name,
        allEmails,
        `Payment ID ${payment.id} has failed 3 times. Group paused.`
      );
    } else {
      // we could schedule next attempt again
      console.log(`(retryCount=${updated.retryCount}) Could schedule another attempt if <3`);
    }
  }
}
