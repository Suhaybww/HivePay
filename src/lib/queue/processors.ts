import { Job } from "bull";
import { db } from "@/src/db";
import { stripe } from "@/src/lib/stripe";
import {
  Prisma,
  PaymentStatus,
  MembershipStatus,
  GroupStatus,
  PauseReason,
  CycleStatus,
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
 * Check if all payments for a cycle are completed and finalize the cycle if true.
 * IMPORTANT: Only advances to the next cycle date when all members in current cycle are paid.
 */
export async function checkAndFinalizeCycle(tx: Prisma.TransactionClient, groupId: string, cycleNumber: number) {
  const group = await tx.group.findUnique({
    where: { id: groupId },
    include: {
      groupMemberships: {
        where: { status: MembershipStatus.Active },
        include: { user: true },
      },
      payments: {
        where: { cycleNumber },
      },
    },
  });

  if (!group) {
    throw new Error(`Group ${groupId} not found.`);
  }

  // Ensure all members have been paid
  const allMembersPaid = group.groupMemberships.every(member => member.hasBeenPaid);

  if (!allMembersPaid) {
    console.log(`Not all members have been paid yet. Skipping cycle finalization.`);
    return;
  }

  // Check if all payments for this cycle are successful
  const allPaymentsSuccessful = group.payments.every(
    (payment) => payment.status === PaymentStatus.Successful
  );

  if (!allPaymentsSuccessful) {
    console.log(`Not all payments are successful. Skipping cycle finalization.`);
    return;
  }

  const totalMembers = group.groupMemberships.length;

  // Ensure contributionAmount is not null
  if (!group.contributionAmount || group.contributionAmount.lte(0)) {
    throw new Error(`Invalid contributionAmount for group ${groupId}.`);
  }

  // Calculate totals for the entire cycle
  const totalAmount = group.contributionAmount.mul(totalMembers - 1);
  const successfulPayments = group.payments.filter(p => p.status === PaymentStatus.Successful).length;
  const failedPayments = group.payments.filter(p => p.status === PaymentStatus.Failed).length;
  const pendingPayments = group.payments.filter(p => p.status === PaymentStatus.Pending).length;

  // Create GroupCycle record
  await tx.groupCycle.create({
    data: {
      groupId: group.id,
      cycleNumber: group.totalGroupCyclesCompleted + 1,
      memberCycleNumber: group.currentMemberCycleNumber,
      startDate: new Date(),
      endDate: new Date(),
      payeeUserId: group.groupMemberships[group.groupMemberships.length - 1].userId,
      totalAmount: totalAmount,
      status: CycleStatus.Completed,
      successfulPayments,
      failedPayments,
      pendingPayments,
    },
  });

  // CRITICAL FIX: Handle cycle advancement correctly
  // Get futureCyclesJson and determine the next cycle date
  let nextCycleDate: Date | null = null;
  const completedCycleIndex = group.totalGroupCyclesCompleted;
  
  // Handle the futureCyclesJson type-safely
  if (group.futureCyclesJson) {
    // Cast to proper type - we know it's an array of date strings
    const futureDates = parseFutureCyclesJson(group.futureCyclesJson);
    console.log(`Found futureCyclesJson with ${futureDates.length} dates`);
    
    // If there are more cycles in the future, use the next one
    if (completedCycleIndex + 1 < futureDates.length) {
      const nextCycleDateStr = futureDates[completedCycleIndex + 1];
      if (nextCycleDateStr) {
        nextCycleDate = new Date(nextCycleDateStr);
        console.log(`📅 Advancing to next cycle date: ${nextCycleDate}`);
      }
    } else {
      console.log(`🏁 All cycles completed - no more future dates available`);
    }
  } else {
    console.log(`⚠️ No futureCyclesJson found, cannot determine next cycle date`);
  }

  // Update group status
  const updateData: any = {
    totalGroupCyclesCompleted: group.totalGroupCyclesCompleted + 1,
    currentMemberCycleNumber: 1, // Reset to first member
    cycleStarted: false,
  };
  
  // Only set the next cycle date if we found one
  if (nextCycleDate) {
    updateData.nextCycleDate = nextCycleDate;
    updateData.cyclesCompleted = false; // There are more cycles to process
  } else {
    updateData.cyclesCompleted = true; // No more cycles to process
  }
  
  await tx.group.update({
    where: { id: groupId },
    data: updateData
  });

  // Reset all members' hasBeenPaid status for the next cycle
  if (nextCycleDate) {
    await tx.groupMembership.updateMany({
      where: { 
        groupId: group.id,
        status: MembershipStatus.Active
      },
      data: {
        hasBeenPaid: false
      }
    });
    console.log(`🔄 Reset payment status for all members for the next cycle`);
  }

  console.log(`Cycle ${cycleNumber} completed for group ${groupId}.`);
  
  if (nextCycleDate) {
    console.log(`Next cycle scheduled for: ${nextCycleDate}`);
  } else {
    console.log(`No more cycles scheduled - all cycles completed`);
  }
}

/**
 * Helper function to safely parse the futureCyclesJson from the database
 * Handles the type conversion safely
 */
function parseFutureCyclesJson(json: unknown): string[] {
  if (!json) return [];
  
  try {
    // If it's already an array, check each element
    if (Array.isArray(json)) {
      return json
        .map(item => {
          // Ensure each item is a string
          if (typeof item === 'string') {
            return item;
          } else if (item instanceof Date) {
            return item.toISOString();
          } else if (item && typeof item === 'object' && 'toISOString' in item) {
            // Handle date-like objects
            return (item as Date).toISOString();
          }
          // Skip invalid items
          console.log(`⚠️ Skipping invalid date in futureCyclesJson:`, item);
          return null;
        })
        .filter((item): item is string => item !== null); // Type guard to ensure non-null
    }
    
    // If it's a string, try to parse it as JSON
    if (typeof json === 'string') {
      try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          return parseFutureCyclesJson(parsed); // Recursively parse
        }
      } catch (e) {
        console.error(`Error parsing futureCyclesJson string:`, e);
      }
    }
  } catch (error) {
    console.error(`Error parsing futureCyclesJson:`, error);
  }
  
  // Return empty array if parsing fails
  return [];
}

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
 * Process contribution cycle for a group with enhanced debugging
 */
export async function processContributionCycle(job: Job) {
  const { groupId, testMode } = job.data;
  console.log(`\n=== processContributionCycle started for group=${groupId} ===`);

  try {
    // DEBUGGING: Check unpaid members before transaction
    const beforeMembers = await db.groupMembership.findMany({
      where: {
        groupId,
        status: MembershipStatus.Active
      },
      select: {
        id: true,
        userId: true,
        hasBeenPaid: true,
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    console.log(`🔍 DEBUG: Member payment status BEFORE transaction:`);
    beforeMembers.forEach(m => {
      console.log(`Member ${m.user.firstName} ${m.user.lastName} (${m.id}): hasBeenPaid=${m.hasBeenPaid}`);
    });

    // Increase transaction timeout to 30 seconds
    await db.$transaction(async (tx) => {
      // 1) Load group with all active members
      const group = await tx.group.findUnique({
        where: { id: groupId },
        include: {
          groupMemberships: {
            where: { status: MembershipStatus.Active },
            orderBy: { payoutOrder: 'asc' },
            include: { user: true },
          },
          payouts: { orderBy: { payoutOrder: 'desc' } },
        },
      });

      if (!group || group.status !== GroupStatus.Active) {
        throw new Error(`Group ${groupId} is not active/found.`);
      }

      if (!group.contributionAmount || group.contributionAmount.lte(0)) {
        throw new Error(`Invalid contributionAmount for group ${groupId}.`);
      }

      // IMPROVED FIX: Handle socket timeouts in email service
      try {
        console.log(`Sending contribution reminders for ${group.groupMemberships.length} members`);
        
        // Create array of promises with longer timeout
    const sendReminders = group.groupMemberships.map(member => {
      // Ensure contributionAmount is not null
      if (!group.contributionAmount) {
        console.warn(`Contribution amount is null for group ${groupId}.`);
        return Promise.resolve(); // Don't fail, just skip
      }

      // Store the contribution amount to avoid TypeScript errors
      const contributionAmount = group.contributionAmount; // This is now guaranteed to be non-null

      // Create a promise with timeout handling
      return new Promise((resolve) => {
        // Set a timeout to resolve the promise after 3 seconds even if hanging
        const timeoutId = setTimeout(() => {
          console.log(`Email to ${member.user.email} took too long - assuming sent and continuing...`);
          resolve(true);
        }, 3000); // 3 second timeout
        
        // Try to send the email
        sendContributionReminderEmail({
          groupName: group.name,
          contributionAmount: contributionAmount, // Use the safely extracted value
          contributionDate: new Date(),
          recipient: {
            email: member.user.email,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
          },
        })
        .then(() => {
          clearTimeout(timeoutId); // Clear timeout if email succeeds quickly
          console.log(`Email sent successfully to ${member.user.email}`);
          resolve(true);
        })
        .catch(error => {
          clearTimeout(timeoutId); // Clear timeout on error
          console.error(`Email error for ${member.user.email}:`, error.message);
          // Assume email was actually sent despite the error
          resolve(true);
        });
      });
    });

        // Wait for all email sending operations to complete or time out
        await Promise.all(sendReminders);
        console.log(`Email sending process completed - continuing with contribution cycle`);
      } catch (error) {
        console.error(`Error in batch email sending, continuing anyway:`, error);
      }

      const nextUnpaidMember = group.groupMemberships.find(m => !m.hasBeenPaid);
      if (!nextUnpaidMember) {
        console.log(`✅ No unpaid members found, finalizing cycle`);
        await checkAndFinalizeCycle(tx, groupId, group.currentMemberCycleNumber);
        return;
      }

      const nextCycleNumber = nextUnpaidMember.payoutOrder;
      if (typeof nextCycleNumber !== 'number' || nextCycleNumber <= 0) {
        throw new Error(`Invalid cycle number for group ${groupId}`);
      }

      const totalMembers = group.groupMemberships.length;
      const safeDecimal = group.contributionAmount;
      const expectedTotal = safeDecimal.mul(totalMembers - 1);

      console.log(`Processing cycle ${nextCycleNumber}:`, {
        payee: `${nextUnpaidMember.user.firstName} ${nextUnpaidMember.user.lastName}`,
        totalMembers,
        contributionAmount: safeDecimal.toString(),
        expectedTotal: expectedTotal.toString()
      });

      const payeeUser = await tx.user.findUnique({
        where: { id: nextUnpaidMember.userId },
        select: { stripeAccountId: true, email: true },
      });

      if (!payeeUser?.stripeAccountId) {
        throw new Error(`Payee missing Stripe ID: ${nextUnpaidMember.userId}`);
      }

      // Process payments
      for (const membership of group.groupMemberships) {
        const user = membership.user;
        if (user.id === nextUnpaidMember.userId) {
          console.log(`Skipping payee: ${user.id}`);
          continue;
        }

        if (!user.stripeCustomerId || !user.stripeBecsPaymentMethodId || !user.stripeMandateId) {
          console.warn(`User ${user.id} missing Stripe setup`);
          continue;
        }

        const existing = await tx.payment.findFirst({
          where: { userId: user.id, groupId: group.id, cycleNumber: nextCycleNumber },
        });

        if (existing) {
          console.log(`Payment exists for user ${user.id}, cycle ${nextCycleNumber}`);
          continue;
        }

        try {
          const fee = Math.min(safeDecimal.toNumber() * 0.01 + 0.3, 3.5);
          const totalToCharge = safeDecimal.toNumber() + fee;
          const totalInCents = Math.round(totalToCharge * 100);
          const feeInCents = Math.round(fee * 100);

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
          console.log(`PaymentIntent created for user ${user.id}: ${pi.id}`);
        } catch (err) {
          console.error(`Payment failed for user ${user.id}`, err);
          const newPayment = await tx.payment.create({
            data: {
              userId: user.id,
              groupId: group.id,
              cycleNumber: nextCycleNumber,
              amount: safeDecimal,
              status: PaymentStatus.Failed,
              retryCount: 1,
              transactions: {
                create: {
                  userId: user.id,
                  groupId: group.id,
                  amount: safeDecimal,
                  transactionType: 'Debit',
                  transactionDate: new Date(),
                  description: `Failed contribution - cycle ${nextCycleNumber}`
                }
              }
            },
          });

          // Schedule retries and handle group pause within the transaction
          if (newPayment.retryCount < 3) {
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
          }

    // Use the same timeout approach for payment failure emails
    try {
      // Use the same timeout approach for payment failure emails
      await new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          console.log(`Payment failure email to ${user.email} took too long - assuming sent and continuing...`);
          resolve(true);
        }, 3000); // 3 second timeout
        
        // Safely extract the amount to avoid TypeScript errors
        const amountStr = safeDecimal.toString();
        
        sendPaymentFailureEmail({
          recipient: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          groupName: group.name,
          amount: amountStr,
        })
        .then(() => {
          clearTimeout(timeoutId);
          console.log(`Payment failure email sent to ${user.email}`);
          resolve(true);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          console.error(`Failed to send payment failure email to ${user.email}:`, error.message);
          resolve(true); // Continue processing
        });
      });
    } catch (emailError) {
      console.error(`Error in payment failure email handling:`, emailError);
      // Continue processing, don't let email failure stop the process
    }
        }
      }

      await updateGroupPaymentStats(tx, group.id);
      
      // Mark that we're processing members within the same cycle
      if (!group.cycleStarted) {
        await tx.group.update({
          where: { id: group.id },
          data: { cycleStarted: true }
        });
        console.log(`🔄 Updated group to mark cycle as started`);
      }
      
      // CRITICAL FIX: Mark the current member as paid and verify it worked
      console.log(`🔍 CRITICAL: Marking member ${nextUnpaidMember.id} (${nextUnpaidMember.user.firstName} ${nextUnpaidMember.user.lastName}) as paid`);
      
      await tx.groupMembership.update({
        where: {
          id: nextUnpaidMember.id
        },
        data: {
          hasBeenPaid: true
        }
      });
      
      // Verify within transaction that update worked
      const verifyMember = await tx.groupMembership.findUnique({
        where: { id: nextUnpaidMember.id },
        select: { hasBeenPaid: true }
      });
      
      console.log(`🔍 Member ${nextUnpaidMember.id} status: hasBeenPaid=${verifyMember?.hasBeenPaid}`);
      
      if (!verifyMember?.hasBeenPaid) {
        console.error(`⚠️ WARNING: Failed to update hasBeenPaid status for member ${nextUnpaidMember.id}`);
      } else {
        console.log(`✅ Successfully marked member ${nextUnpaidMember.id} as paid`);
      }
      
    }, {
      timeout: 30000, // Increased timeout to 30 seconds
      maxWait: 30000,
    });

    // DEBUGGING: Check unpaid members after transaction to ensure changes were committed
    const afterMembers = await db.groupMembership.findMany({
      where: {
        groupId,
        status: MembershipStatus.Active
      },
      select: {
        id: true,
        userId: true,
        hasBeenPaid: true,
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    console.log(`🔍 DEBUG: Member payment status AFTER transaction:`);
    afterMembers.forEach(m => {
      console.log(`Member ${m.user.firstName} ${m.user.lastName} (${m.id}): hasBeenPaid=${m.hasBeenPaid}`);
    });

    // CRITICAL FIX: Force an accurate unpaid members count
    const actualUnpaidMembers = afterMembers.filter(m => !m.hasBeenPaid);
    console.log(`🔍 DEBUG: Actual unpaid members count: ${actualUnpaidMembers.length}`);

    console.log(`=== processContributionCycle success for group=${groupId} ===\n`);

    // Post-transaction group check with detailed debug info
    const updatedGroup = await db.group.findUnique({
      where: { id: groupId },
      select: { 
        id: true, 
        status: true, 
        pauseReason: true, 
        nextCycleDate: true,
        cyclesCompleted: true,
        cycleStarted: true,
        totalGroupCyclesCompleted: true,
        currentMemberCycleNumber: true,
        futureCyclesJson: true,
        groupMemberships: {
          where: { status: MembershipStatus.Active },
          select: { id: true, hasBeenPaid: true, userId: true }
        }
      },
    });

    // Count unpaid members accurately
    const unpaidMembersCount = updatedGroup?.groupMemberships.filter(m => !m.hasBeenPaid).length || 0;
    
    console.log(`🔍 Group state after transaction: cyclesCompleted=${updatedGroup?.cyclesCompleted}, cycleStarted=${updatedGroup?.cycleStarted}, status=${updatedGroup?.status}, currentMemberCycle=${updatedGroup?.currentMemberCycleNumber}, totalCycles=${updatedGroup?.totalGroupCyclesCompleted}`);
    console.log(`🔍 Members remaining to be paid in this cycle: ${unpaidMembersCount}`);
    
    // Log the detailed member IDs that aren't paid
    if (unpaidMembersCount > 0 && updatedGroup) {
      console.log(`🔍 Unpaid members: ${updatedGroup.groupMemberships.filter(m => !m.hasBeenPaid).map(m => m.userId).join(', ')}`);
    }

    // CRITICAL FIX: Do not advance nextCycleDate if we're still in the same cycle
    if (unpaidMembersCount > 0 && updatedGroup?.cycleStarted && updatedGroup.futureCyclesJson) {
      console.log(`🔄 ${unpaidMembersCount} members still need payment in current cycle - preserving cycle date`);
      const originalDate = updatedGroup.nextCycleDate;
      console.log(`🔍 Current cycle date: ${originalDate}`);
    }

    // Add a safety check - if there are no unpaid members but cyclesCompleted is false
    if (unpaidMembersCount === 0 && updatedGroup && !updatedGroup.cyclesCompleted) {
      console.log(`🔍 All members paid but cycle not marked as completed. Running finalization...`);
      await db.$transaction(async (tx) => {
        await checkAndFinalizeCycle(tx, groupId, updatedGroup.currentMemberCycleNumber);
      });
    }

    if (updatedGroup?.status === GroupStatus.Paused) {
      // If paused, add to pause queue
      await groupStatusQueue.add('handle-group-pause', {
        groupId: updatedGroup.id,
        reason: updatedGroup.pauseReason,
      });
    } else if (updatedGroup) {
      // Only schedule next cycle if cycles are not completed
      if (!updatedGroup.cyclesCompleted) {
        console.log(`✅ Scheduling next cycle for group ${groupId}`);
        await SchedulerService.scheduleNextCycle(updatedGroup.id);
      } else {
        console.log(`⏹️ Cycle completed for group ${groupId}, no more cycles will be scheduled`);
        
        // Option for test mode to reset cycles
        if (testMode === true) {
          console.log(`🧪 Test mode detected - resetting cycle flags for continued testing`);
          await db.group.update({
            where: { id: groupId },
            data: { 
              cyclesCompleted: false,
              cycleStarted: false
            }
          });
          console.log(`🔄 Reset cycle flags for group ${groupId}, now scheduling next test cycle`);
          await SchedulerService.scheduleNextCycle(updatedGroup.id);
        }
      }
    }
  } catch (error) {
    console.error(`Contribution cycle failed for group ${groupId}:`, error);
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