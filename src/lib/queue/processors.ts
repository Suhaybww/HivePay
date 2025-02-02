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
  sendContributionReminderEmail,
} from "@/src/lib/emailService";
import { paymentQueue } from "./paymentQueue";
import { groupStatusQueue } from "../queue/groupStatusQueue";

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
 * Process contribution cycle for a group
 */
export async function processContributionCycle(job: Job) {
  const { groupId } = job.data;
  console.log(`\n=== processContributionCycle started for group=${groupId} ===`);

  try {
    await db.$transaction(async (tx) => {
      // 1) Load group with all active members
      const group = await tx.group.findUnique({
        where: { id: groupId },
        include: {
          groupMemberships: {
            where: {
              status: MembershipStatus.Active,
            },
            orderBy: {
              payoutOrder: 'asc',
            },
            include: { user: true },
          },
          payouts: {
            orderBy: { payoutOrder: 'desc' },
          },
        },
      });

      if (!group || group.status !== GroupStatus.Active) {
        throw new Error(`Group ${groupId} is not active/found.`);
      }

      if (!group.contributionAmount || group.contributionAmount.lte(0)) {
        throw new Error(`Invalid contributionAmount for group ${groupId}.`);
      }

      // Send contribution reminder emails to all active members
      for (const member of group.groupMemberships) {
        await sendContributionReminderEmail({
          groupName: group.name,
          contributionAmount: group.contributionAmount,
          contributionDate: new Date(), // Set the correct date for the next cycle
          recipient: {
            email: member.user.email,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
          },
        });
      }


      // Find next unpaid member
      const nextUnpaidMember = group.groupMemberships.find(m => !m.hasBeenPaid);
      if (!nextUnpaidMember) {
        await tx.group.update({
          where: { id: group.id },
          data: {
            cycleStarted: false,
            status: GroupStatus.Paused,
            pauseReason: PauseReason.OTHER,
          },
        });
        
        await groupStatusQueue.add('handle-group-pause', {
          groupId: group.id,
          reason: PauseReason.OTHER
        });
        
        console.log(`All members have received payout => group ${group.id} ended.`);
        return;
      }

      const nextCycleNumber = nextUnpaidMember.payoutOrder;
      if (typeof nextCycleNumber !== 'number' || nextCycleNumber <= 0) {
        throw new Error(`Invalid next cycle number for group ${groupId}`);
      }

      // Calculate contribution amount and expected total
      const totalMembers = group.groupMemberships.length;
      const safeDecimal = group.contributionAmount;
      const expectedTotal = safeDecimal.mul(totalMembers - 1); // Total to be collected (everyone except payee)

      console.log(`Processing cycle ${nextCycleNumber}:`, {
        payee: `${nextUnpaidMember.user.firstName} ${nextUnpaidMember.user.lastName}`,
        totalMembers,
        contributionAmount: safeDecimal.toString(),
        expectedTotal: expectedTotal.toString()
      });

      // Get payee details
      const payeeUser = await tx.user.findUnique({
        where: { id: nextUnpaidMember.userId },
        select: { stripeAccountId: true, email: true },
      });

      if (!payeeUser?.stripeAccountId) {
        throw new Error(`Payee missing stripeAccountId => userId=${nextUnpaidMember.userId}`);
      }

      // Process payments from ALL active members except payee
      for (const membership of group.groupMemberships) {
        const user = membership.user;
        
        // Skip if it's the payee
        if (user.id === nextUnpaidMember.userId) {
          console.log(`Skipping payment from payee: ${user.id}`);
          continue;
        }

        if (
          !user.stripeCustomerId ||
          !user.stripeBecsPaymentMethodId ||
          !user.stripeMandateId
        ) {
          console.warn(`User ${user.id} missing setup => skipping`);
          continue;
        }

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

        let fee = safeDecimal.toNumber() * 0.01 + 0.3;
        if (fee > 3.5) fee = 3.5;

        const totalToCharge = safeDecimal.toNumber() + fee;
        const totalInCents = Math.round(totalToCharge * 100);
        const feeInCents = Math.round(fee * 100);

        try {
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
        
          await tx.payment.create({
            data: {
              userId: user.id,
              groupId: group.id,
              cycleNumber: nextCycleNumber,
              amount: safeDecimal,
              status: PaymentStatus.Pending,
              stripePaymentIntentId: pi.id,
              retryCount: 0,
              // Add transaction creation
              transactions: {
                create: {
                  userId: user.id,
                  groupId: group.id,
                  amount: safeDecimal,
                  transactionType: 'Debit',
                  transactionDate: new Date(),
                  description: `Contribution for cycle ${nextCycleNumber}`
                }
              }
            },
          });
        
          console.log(`Created payment intent for user ${user.id} => PI: ${pi.id}`);
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
              // Add transaction creation for failed payment
              transactions: {
                create: {
                  userId: user.id,
                  groupId: group.id,
                  amount: safeDecimal,
                  transactionType: 'Debit',
                  transactionDate: new Date(),
                  description: `Failed contribution attempt - cycle ${nextCycleNumber}`
                }
              }
            },
          });
        
          // Send payment failure email
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
            await tx.group.update({
              where: { id: group.id },
              data: {
                status: GroupStatus.Paused,
                pauseReason: PauseReason.PAYMENT_FAILURES,
              },
            });
            console.log(`Group ${group.id} paused => repeated fails from user ${user.id}`);
          }
        }
      }

      // Update totals
      await updateGroupPaymentStats(tx, group.id);
    });

    console.log(`=== processContributionCycle success for group=${groupId} ===\n`);

    // Check group status after transaction
    const updatedGroup = await db.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        status: true,
        pauseReason: true,
        futureCyclesJson: true,
        nextCycleDate: true,
      }
    });

    if (updatedGroup?.status === GroupStatus.Paused) {
      await groupStatusQueue.add('handle-group-pause', {
        groupId: updatedGroup.id,
        reason: updatedGroup.pauseReason
      });
    } else if (updatedGroup) {
      // Schedule next cycle if group is still active
      await SchedulerService.scheduleNextCycle(updatedGroup.id);
    }
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
  }  catch (error) {
    console.error(`retryFailedPayment => Payment ${paymentId} error:`, error);

    const updated = await db.payment.update({
      where: { id: paymentId },
      data: { retryCount: { increment: 1 } },
    });
    
    if (updated.retryCount >= 3) {
      const updatedGroup = await db.group.update({
        where: { id: payment.groupId },
        data: {
          status: GroupStatus.Paused,
          pauseReason: PauseReason.PAYMENT_FAILURES,
        },
      });

      await groupStatusQueue.add('handle-group-pause', {
        groupId: updatedGroup.id,
        reason: updatedGroup.pauseReason
      });
    }
  }
}


// New processor function for group status monitoring
export async function handleGroupPause(job: Job) {
  const { groupId, reason } = job.data;
  console.log(`\n=== Handling group pause for ${groupId} === [JOB ID: ${job.id}]`);

  try {
    console.log(`Fetching group ${groupId}...`);
    const group = await db.group.findUnique({
      where: { id: groupId },
      include: {
        groupMemberships: {
          include: { user: true },
          where: { status: MembershipStatus.Active }
        }
      }
    });

    console.log(`Group status: ${group?.status}, Pause reason: ${group?.pauseReason}`);
    console.log(`Active members found: ${group?.groupMemberships.length || 0}`);

    if (!group || group.status !== GroupStatus.Paused) {
      console.log(`Group ${groupId} is not paused, skipping notification`);
      return;
    }

    const members = group.groupMemberships.map(m => ({
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName
    }));

    console.log(`Sending emails to:`, members);
    
    const emailResult = await sendGroupPausedNotificationEmail(
      group.name,
      members,
      reason || PauseReason.OTHER
    );

    console.log(`Email service response:`, emailResult);
    console.log(`Sent pause notifications for group ${groupId}`);
  } catch (error) {
    console.error(`Failed to handle group pause for ${groupId}:`, error);
    throw error;
  }
}