"use strict";

import { Job } from "bull";
import { db } from "@/src/db";
import { stripe } from "@/src/lib/stripe";
import {
  Prisma,
  PaymentStatus,
  MembershipStatus,
  GroupStatus,
  PauseReason,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { SchedulerService } from "../services/schedulerService";
import {
  sendPaymentFailureEmail,
  sendGroupPausedNotificationEmail,
  sendGroupCycleStartedEmail,
} from "@/src/lib/emailService";
import { paymentQueue } from "./paymentQueue";

/**
 * Recompute group totals from Payment rows => update the group columns.
 */
async function updateGroupPaymentStats(
  tx: Prisma.TransactionClient,
  groupId: string
) {
  const payments = await tx.payment.findMany({ where: { groupId } });

  let totalDebited = new Decimal(0);
  let totalPending = new Decimal(0);
  let totalSuccess = new Decimal(0);

  for (const pay of payments) {
    if (pay.status !== PaymentStatus.Failed) {
      totalDebited = totalDebited.plus(pay.amount);
    }
    if (pay.status === PaymentStatus.Pending) {
      totalPending = totalPending.plus(pay.amount);
    } else if (pay.status === PaymentStatus.Successful) {
      totalSuccess = totalSuccess.plus(pay.amount);
    }
  }

  await tx.group.update({
    where: { id: groupId },
    data: {
      totalDebitedAmount: totalDebited,
      totalPendingAmount: totalPending,
      totalSuccessAmount: totalSuccess,
    },
  });
}

/**
 * processContributionCycle
 *  1) We figure out which cycle # we’re on by counting existing Payouts in that group.
 *  2) The payee => membership with payoutOrder= that cycle #.
 *  3) Everyone else pays => skip duplicates if Payment row exists for that cycle #.
 *  4) We create a Payout row => set payee's membership hasBeenPaid=true.
 *  5) We shift futureCyclesJson => pop the used date => if there's a next date => set nextCycleDate to that next item => re-schedule.
 */
export async function processContributionCycle(job: Job) {
  const { groupId } = job.data;
  console.log(`\n=== processContributionCycle started for group=${groupId} ===`);

  try {
    await db.$transaction(async (tx) => {
      // 1) load group
      const group = await tx.group.findUnique({
        where: { id: groupId },
        include: {
          // only active & not paid
          groupMemberships: {
            where: {
              status: MembershipStatus.Active,
              hasBeenPaid: false,
            },
            include: { user: true },
          },
          payouts: { orderBy: { payoutOrder: "desc" } },
        },
      });
      if (!group || group.status !== GroupStatus.Active) {
        throw new Error(`Group ${groupId} is not active/found.`);
      }
      if (!group.contributionAmount || group.contributionAmount.lte(0)) {
        throw new Error(`Invalid contributionAmount for group ${groupId}.`);
      }

      const safeDecimal = group.contributionAmount; // e.g. 1000
      const baseAmount = safeDecimal.toNumber();
      const membersPending = group.groupMemberships; // not yet paid

      // 2) nextCycleNumber => last payout’s order + 1
      let nextCycleNumber = 1;
      if (group.payouts.length > 0) {
        nextCycleNumber = group.payouts[0].payoutOrder + 1;
      }

      // if nextCycleNumber > membersPending.length => done
      if (nextCycleNumber > membersPending.length) {
        await tx.group.update({
          where: { id: group.id },
          data: {
            cycleStarted: false,
            status: GroupStatus.Paused,
            pauseReason: PauseReason.OTHER,
          },
        });
        console.log(`All members have received payout => group ${group.id} ended.`);

        const allEmails = membersPending.map((m) => ({
          email: m.user.email,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
        }));
        await sendGroupPausedNotificationEmail(
          group.name,
          allEmails,
          "All members have received their payout; cycle is complete."
        );
        return;
      }

      // 3) find payee => payoutOrder= nextCycleNumber
      const payee = membersPending.find((m) => m.payoutOrder === nextCycleNumber);
      if (!payee) {
        throw new Error(`No membership found => group=${groupId}, cycle#=${nextCycleNumber}`);
      }

      const payeeUser = await tx.user.findUnique({
        where: { id: payee.userId },
        select: { stripeAccountId: true, email: true },
      });
      if (!payeeUser?.stripeAccountId) {
        throw new Error(`Payee missing stripeAccountId => userId=${payee.userId}`);
      }

      // 4) Everyone else pays => skip duplicates
      for (const membership of membersPending) {
        const user = membership.user;
        if (
          !user.stripeCustomerId ||
          !user.stripeBecsPaymentMethodId ||
          !user.stripeMandateId
        ) {
          console.warn(`User ${user.id} missing setup => skipping`);
          continue;
        }

        // check if Payment row already exists
        const existing = await tx.payment.findFirst({
          where: {
            userId: user.id,
            groupId: group.id,
            cycleNumber: nextCycleNumber,
          },
        });
        if (existing) {
          console.log(`Skipping Payment => user=${user.id}, cycle#=${nextCycleNumber} (exists)`);
          continue;
        }

        // 1% + $0.30, max $3.50
        let fee = baseAmount * 0.01 + 0.3;
        if (fee > 3.5) fee = 3.5;

        const totalToCharge = baseAmount + fee;
        const totalInCents = Math.round(totalToCharge * 100);
        const feeInCents = Math.round(fee * 100);

        try {
          // PaymentIntent => money => payee
          const pi = await stripe.paymentIntents.create({
            amount: totalInCents,
            currency: "aud",
            customer: user.stripeCustomerId,
            payment_method: user.stripeBecsPaymentMethodId,
            mandate: user.stripeMandateId,
            confirm: true,
            off_session: true,
            payment_method_types: ["au_becs_debit"],
            transfer_data: { destination: payeeUser.stripeAccountId },
            application_fee_amount: feeInCents,
            metadata: {
              groupId: group.id,
              userId: user.id,
              cycleNumber: nextCycleNumber.toString(),
              nextPayoutUser: payeeUser.email,
            },
          });

          // record Payment => pending
          await tx.payment.create({
            data: {
              userId: user.id,
              groupId: group.id,
              cycleNumber: nextCycleNumber,
              amount: safeDecimal,
              status: PaymentStatus.Pending,
              stripePaymentIntentId: pi.id,
              retryCount: 0,
            },
          });
        } catch (err) {
          console.error(`PaymentIntent fail => user=${user.id}, cycle#=${nextCycleNumber}`, err);

          const newPayment = await tx.payment.create({
            data: {
              userId: user.id,
              groupId: group.id,
              cycleNumber: nextCycleNumber,
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

          if (newPayment.retryCount < 3) {
            console.log(`Scheduling retry => Payment ${newPayment.id} in 2 days`);
            await paymentQueue.add(
              "retry-failed-payment",
              { paymentId: newPayment.id },
              { delay: 2 * 86400000 }
            );
          } else {
            // pause group
            await tx.group.update({
              where: { id: group.id },
              data: {
                status: GroupStatus.Paused,
                pauseReason: PauseReason.PAYMENT_FAILURES,
              },
            });
            console.log(`Group ${group.id} paused => repeated fails from user ${user.id}`);

            const emailsAll = membersPending.map((m) => ({
              email: m.user.email,
              firstName: m.user.firstName,
              lastName: m.user.lastName,
            }));
            await sendGroupPausedNotificationEmail(
              group.name,
              emailsAll,
              `Payment failures by ${user.email}`
            );
          }
        }
      }

      // update totals
      await updateGroupPaymentStats(tx, group.id);

      // create Payout => payee
      await tx.payout.create({
        data: {
          groupId: group.id,
          userId: payee.userId,
          scheduledPayoutDate: new Date(),
          amount: safeDecimal,
          status: PaymentStatus.Pending,
          payoutOrder: nextCycleNumber,
        },
      });
      console.log(
        `Payout #${nextCycleNumber} => userId=${payee.userId}, amount=${safeDecimal}`
      );

      // mark payee => hasBeenPaid
      await tx.groupMembership.update({
        where: { id: payee.id },
        data: { hasBeenPaid: true },
      });
    });

    // after transaction => shift from futureCyclesJson => schedule next
    const latest = await db.group.findUnique({
      where: { id: groupId },
      select: {
        status: true,
        cycleStarted: true,
        futureCyclesJson: true,
      },
    });
    if (!latest || latest.status !== GroupStatus.Active || !latest.cycleStarted) {
      console.log(`Group ${groupId} is paused => skip next cycle schedule.`);
      return;
    }

    let arr = Array.isArray(latest.futureCyclesJson)
      ? [...latest.futureCyclesJson]
      : [];
    arr.shift(); // remove the used date

    if (arr.length === 0) {
      // no more => done
      await db.group.update({
        where: { id: groupId },
        data: {
          futureCyclesJson: [],
          nextCycleDate: null, // done
          cycleStarted: false,
          status: GroupStatus.Paused,
          pauseReason: PauseReason.OTHER,
        },
      });
      console.log(`No more cycle dates => group ${groupId} ended/paused.`);
    } else {
      // set nextCycleDate to arr[0]
      const nextRaw = arr[0];
      let nextDate: Date | null = null;
      if (typeof nextRaw === "string" && nextRaw.trim() !== "") {
        nextDate = new Date(nextRaw);
      }

      if (nextDate && !isNaN(nextDate.getTime())) {
        await db.group.update({
          where: { id: groupId },
          data: {
            futureCyclesJson: arr,
            nextCycleDate: nextDate,
          },
        });
        console.log(
          `Group ${groupId} => nextCycleDate=${nextDate.toISOString()}, scheduling next cycle...`
        );
        await SchedulerService.scheduleNextCycle(groupId);
      } else {
        // invalid => end
        console.warn(`Invalid next date => pausing group ${groupId}`);
        await db.group.update({
          where: { id: groupId },
          data: {
            futureCyclesJson: [],
            nextCycleDate: null,
            cycleStarted: false,
            status: GroupStatus.Paused,
            pauseReason: PauseReason.OTHER,
          },
        });
      }
    }

    // optionally notify => “new cycle started”
    console.log(`=== processContributionCycle success for group=${groupId} ===\n`);
  } catch (error) {
    console.error(`Failed processContributionCycle for group ${groupId}:`, error);
    throw error;
  }
}

/**
 * retryAllPaymentsForGroup => unpause & re-schedule from existing futureCyclesJson
 */
export async function retryAllPaymentsForGroup(groupId: string): Promise<void> {
  console.log(`\n=== Admin retryAllPaymentsForGroup => group ${groupId} ===`);
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
 * retryFailedPayment => single Payment re-attempt
 */
export async function retryFailedPayment(job: Job) {
  const { paymentId } = job.data;
  console.log(`\n=== retry-failed-payment => Payment ${paymentId} ===`);

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { user: true, group: true },
  });
  if (!payment || payment.status !== PaymentStatus.Failed) {
    console.log(`Payment not found or not in Failed => skipping...`);
    return;
  }
  if (!payment.group || payment.group.status !== GroupStatus.Active) {
    console.log(`Group paused or not active => skip Payment ${paymentId}`);
    return;
  }
  if (!payment.user?.stripeBecsPaymentMethodId || !payment.user.stripeMandateId) {
    console.error(`User missing Stripe => cannot retry Payment ${paymentId}`);
    return;
  }

  try {
    if (!payment.cycleNumber) {
      throw new Error(`Payment has no cycleNumber => can't find payee`);
    }

    // find membership => payoutOrder= that cycleNumber
    const payeeMembership = await db.groupMembership.findFirst({
      where: {
        groupId: payment.groupId,
        payoutOrder: payment.cycleNumber,
        status: MembershipStatus.Active,
        hasBeenPaid: false,
      },
      include: { user: true },
    });
    if (!payeeMembership?.user?.stripeAccountId) {
      throw new Error(
        `No membership found => groupId=${payment.groupId}, cycleNumber=${payment.cycleNumber}`
      );
    }

    const baseAmountNum = payment.amount.toNumber();
    let fee = baseAmountNum * 0.01 + 0.3;
    if (fee > 3.5) fee = 3.5;
    if (payment.retryCount >= 1) {
      fee += 2.5;
    }
    const totalToCharge = baseAmountNum + fee;
    const totalInCents = Math.round(totalToCharge * 100);
    const feeInCents = Math.round(fee * 100);

    const pi = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: "aud",
      customer: payment.user.stripeCustomerId!,
      payment_method: payment.user.stripeBecsPaymentMethodId!,
      mandate: payment.user.stripeMandateId!,
      confirm: true,
      off_session: true,
      payment_method_types: ["au_becs_debit"],
      transfer_data: { destination: payeeMembership.user.stripeAccountId },
      application_fee_amount: feeInCents,
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

    // recalc group totals
    await updateGroupPaymentStats(db, payment.groupId);
    console.log(`Retry Payment ${paymentId} => PaymentIntent ${pi.id}`);
  } catch (error) {
    console.error(`retryFailedPayment => Payment ${paymentId} error:`, error);

    const updated = await db.payment.update({
      where: { id: paymentId },
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
      console.log(`Group ${payment.groupId} paused => Payment ${paymentId} failed 3 times`);
    } else {
      console.log(`(retryCount=${updated.retryCount}) => next attempt if <3`);
    }
  }
}
