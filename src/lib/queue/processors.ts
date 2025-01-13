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
 * Recompute group totals from Payment rows => update group.
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
 *  - Figures out which cycle # we’re on by counting existing Payouts
 *  - Finds the payee (payoutOrder = nextCycleNumber)
 *  - Everyone else pays once (skipping duplicates)
 *  - Creates a Payout row
 *  - Marks the payee's membership as hasBeenPaid=true
 *  - Shifts futureCyclesJson => schedules next cycle
 */
export async function processContributionCycle(job: Job) {
  const { groupId } = job.data;
  console.log(`\n=== processContributionCycle started for group=${groupId} ===`);

  try {
    await db.$transaction(async (tx) => {
      // 1) load group + memberships (excluding those who have already been paid)
      const group = await tx.group.findUnique({
        where: { id: groupId },
        include: {
          groupMemberships: {
            // We exclude hasBeenPaid===true so that once
            // a user has had their payout, they won't remain “next in line.”
            where: {
              status: MembershipStatus.Active,
              hasBeenPaid: false,
            },
            include: { user: true },
          },
          payouts: {
            orderBy: { payoutOrder: "desc" },
          },
        },
      });
      if (!group || group.status !== GroupStatus.Active) {
        throw new Error(`Group ${groupId} is not active/found`);
      }
      if (!group.contributionAmount || group.contributionAmount.lte(0)) {
        throw new Error(`Invalid contributionAmount for group ${groupId}`);
      }

      const safeDecimal = group.contributionAmount; // e.g. 1000.00
      const baseAmount = safeDecimal.toNumber();
      const activeMembers = group.groupMemberships; // these haven't been paid yet

      // 2) figure out nextCycleNumber => (# of existing Payouts) + 1
      let nextCycleNumber = 1;
      if (group.payouts.length > 0) {
        nextCycleNumber = group.payouts[0].payoutOrder + 1;
      }

      // If nextCycleNumber > activeMembers.length => we’ve paid everyone
      if (nextCycleNumber > activeMembers.length) {
        await tx.group.update({
          where: { id: group.id },
          data: {
            cycleStarted: false,
            status: GroupStatus.Paused,
            pauseReason: PauseReason.OTHER,
          },
        });
        console.log(`All members have received a payout => group ${group.id} ended.`);

        const allEmails = activeMembers.map((m) => ({
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

      // 3) payee => membership whose `payoutOrder = nextCycleNumber`
      const payee = activeMembers.find((m) => m.payoutOrder === nextCycleNumber);
      if (!payee) {
        throw new Error(`No membership found for cycleNumber=${nextCycleNumber}`);
      }

      const payeeUser = await tx.user.findUnique({
        where: { id: payee.userId },
        select: { stripeAccountId: true, email: true },
      });
      if (!payeeUser?.stripeAccountId) {
        throw new Error(`Payee missing stripeAccountId => userId=${payee.userId}`);
      }

      // 4) Everyone else pays => skip duplicates
      for (const membership of activeMembers) {
        const user = membership.user;
        if (
          !user.stripeCustomerId ||
          !user.stripeBecsPaymentMethodId ||
          !user.stripeMandateId
        ) {
          console.warn(`Skipping user ${user.id}, missing payment setup`);
          continue;
        }

        // check if payment exists for that cycleNumber
        const existingPay = await tx.payment.findFirst({
          where: {
            userId: user.id,
            groupId: group.id,
            cycleNumber: nextCycleNumber,
          },
        });
        if (existingPay) {
          console.log(
            `Skipping existing Payment for user=${user.id}, cycle=${nextCycleNumber}`
          );
          continue;
        }

        // 1% + $0.30 => max $3.50
        let fee = baseAmount * 0.01 + 0.3;
        if (fee > 3.5) fee = 3.5;

        const totalToCharge = baseAmount + fee;
        const totalInCents = Math.round(totalToCharge * 100);
        const feeInCents = Math.round(fee * 100);

        try {
          // create PaymentIntent => money goes to payee's connected account
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

          // record Payment => Pending
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
          console.error(
            `PaymentIntent fail => user=${user.id}, cycle=${nextCycleNumber}`,
            err
          );

          // Payment => Failed
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

          // notify user
          await sendPaymentFailureEmail({
            recipient: {
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
            },
            groupName: group.name,
            amount: safeDecimal.toString(),
          });

          // if <3 => schedule retry
          if (newPayment.retryCount < 3) {
            console.log(`Scheduling retry for Payment ${newPayment.id} in 2 days`);
            await paymentQueue.add(
              "retry-failed-payment",
              { paymentId: newPayment.id },
              { delay: 2 * 86400000 }
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
        }
      }

      // 5) update group stats
      await updateGroupPaymentStats(tx, group.id);

      // 6) create Payout => payee
      await tx.payout.create({
        data: {
          groupId: group.id,
          userId: payee.userId,
          scheduledPayoutDate: new Date(),
          amount: safeDecimal,
          status: PaymentStatus.Pending, // or "Pending"
          payoutOrder: nextCycleNumber,
        },
      });
      console.log(
        `Payout #${nextCycleNumber} => userId=${payee.userId} amount=${safeDecimal}`
      );

      // 7) Mark payee membership as hasBeenPaid=true so they're not "in line" next cycle
      await tx.groupMembership.update({
        where: { id: payee.id },
        data: { hasBeenPaid: true },
      });
    });

    // 8) If group is still active => shift from futureCyclesJson => schedule next
    const updatedGroup = await db.group.findUnique({
      where: { id: groupId },
      select: {
        status: true,
        cycleStarted: true,
        futureCyclesJson: true,
      },
    });
    if (
      !updatedGroup ||
      updatedGroup.status !== GroupStatus.Active ||
      !updatedGroup.cycleStarted
    ) {
      console.log(`Group ${groupId} is paused => no next scheduling.`);
      return;
    }

    // shift array => remove first date
    let nextCycles = Array.isArray(updatedGroup.futureCyclesJson)
      ? [...updatedGroup.futureCyclesJson]
      : [];
    nextCycles.shift(); // used the first date

    if (nextCycles.length === 0) {
      // no more dates => done
      await db.group.update({
        where: { id: groupId },
        data: {
          futureCyclesJson: [],
          cycleStarted: false,
          status: GroupStatus.Paused,
          pauseReason: PauseReason.OTHER,
        },
      });
      console.log(`No more cycle dates => group ${groupId} ended/paused.`);
    } else {
      // store updated array, no nextCycleDate usage
      await db.group.update({
        where: { id: groupId },
        data: {
          futureCyclesJson: nextCycles,
        },
      });

      console.log(
        `Group ${groupId} => scheduling next date from futureCyclesJson...`
      );
      await SchedulerService.scheduleNextCycle(groupId);
    }

    // optionally notify group => "A new cycle started"
    console.log(`=== processContributionCycle success for group=${groupId} ===\n`);
  } catch (error) {
    console.error(`Failed processContributionCycle for group ${groupId}:`, error);
    throw error;
  }
}

/**
 * retryAllPaymentsForGroup
 * - unpause + set cycleStarted => schedule new job
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

  // we schedule again => it reads from the existing futureCyclesJson
  await SchedulerService.scheduleContributionCycle(groupId);
  console.log(`Group ${groupId} reactivated => PaymentIntents will be attempted.\n`);
}

/**
 * retryFailedPayment => same approach, but for a single Payment
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
    console.log(`Group not active => skip Payment ${paymentId}`);
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
    // find membership => payoutOrder = payment.cycleNumber
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
        `No membership found => groupId=${payment.groupId}, payoutOrder=${payment.cycleNumber}`
      );
    }

    let baseAmountNum = payment.amount.toNumber();
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

    await db.payment.update({
      where: { id: payment.id },
      data: { stripePaymentIntentId: pi.id, status: PaymentStatus.Pending },
    });

    // recalc totals
    await updateGroupPaymentStats(db, payment.groupId);
    console.log(`Retry Payment ${paymentId} => PaymentIntent ${pi.id}`);
  } catch (error) {
    console.error(`retryFailedPayment => Payment ${paymentId} error:`, error);

    const updated = await db.payment.update({
      where: { id: paymentId },
      data: { retryCount: { increment: 1 } },
    });
    if (updated.retryCount >= 3) {
      await db.group.update({
        where: { id: payment.groupId },
        data: {
          status: GroupStatus.Paused,
          pauseReason: PauseReason.PAYMENT_FAILURES,
        },
      });
      console.log(`Group ${payment.groupId} paused => Payment ${paymentId} failed 3 times`);
      // you can email the group, etc.
    } else {
      console.log(`(retryCount=${updated.retryCount}) => next attempt if <3`);
    }
  }
}
