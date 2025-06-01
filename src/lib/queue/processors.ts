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
 * Check if the current payee has been paid and finalize the cycle if true.
 * IMPORTANT: Handles ROSCA cycle advancement correctly - only ONE member should be paid per cycle.
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

  // CRITICAL FIX: Find the current payee based on currentMemberCycleNumber or offset
  let currentPayee;
  
  // First try with offset for currentMemberCycleNumber=0 case
  if (group.currentMemberCycleNumber === 0) {
    currentPayee = group.groupMemberships.find(m => m.payoutOrder === 1);
  } else {
    currentPayee = group.groupMemberships.find(m => m.payoutOrder === group.currentMemberCycleNumber);
  }
  
  if (!currentPayee) {
    console.error(`Cannot find payee for cycle ${cycleNumber}`);
    console.log(`Available payoutOrders: ${group.groupMemberships.map(m => m.payoutOrder).join(', ')}`);
    throw new Error(`No payee found for cycle ${cycleNumber}`);
  }
  
  console.log(`Current payee: ${currentPayee.user.firstName} ${currentPayee.user.lastName} (order=${currentPayee.payoutOrder})`);

  // CRITICAL FIX: Check if current payee is marked as paid
  if (!currentPayee.hasBeenPaid) {
    console.log(`Current payee ${currentPayee.user.firstName} not yet marked as paid. Skipping cycle finalization.`);
    return;
  }
  
  // CRITICAL FIX: Check that all expected payments (from non-payee members) are successful
  const expectedContributors = group.groupMemberships.filter(m => m.id !== currentPayee.id);
  const expectedPaymentsCount = expectedContributors.length;
  
  const successfulPayments = group.payments.filter(
    p => p.status === PaymentStatus.Successful && p.cycleNumber === cycleNumber
  ).length;
  
  if (successfulPayments < expectedPaymentsCount) {
    console.log(`Not all expected payments processed. Expected ${expectedPaymentsCount}, got ${successfulPayments}`);
    return;
  }

  console.log(`✅ Current payee is marked as paid and all expected payments are successful. Proceeding with cycle finalization.`);

  // Ensure contributionAmount is not null
  if (!group.contributionAmount || group.contributionAmount.lte(0)) {
    throw new Error(`Invalid contributionAmount for group ${groupId}.`);
  }

  // Calculate totals
  const totalMembers = group.groupMemberships.length;
  const totalAmount = group.contributionAmount.mul(totalMembers - 1);
  const successfulPaymentsCount = group.payments.filter(p => p.status === PaymentStatus.Successful).length;
  const failedPaymentsCount = group.payments.filter(p => p.status === PaymentStatus.Failed).length;
  const pendingPaymentsCount = group.payments.filter(p => p.status === PaymentStatus.Pending).length;

  // Create GroupCycle record for this member's payout
  await tx.groupCycle.create({
    data: {
      groupId: group.id,
      cycleNumber: group.totalGroupCyclesCompleted + 1,
      memberCycleNumber: group.currentMemberCycleNumber === 0 ? 1 : group.currentMemberCycleNumber, 
      startDate: new Date(),
      endDate: new Date(),
      payeeUserId: currentPayee.userId,
      totalAmount: totalAmount,
      status: CycleStatus.Completed,
      successfulPayments: successfulPaymentsCount,
      failedPayments: failedPaymentsCount,
      pendingPayments: pendingPaymentsCount,
    },
  });

  // Get next cycle date from futureCyclesJson
  let nextCycleDate: Date | null = null;
  const completedCycleIndex = group.totalGroupCyclesCompleted;
  
  // Debug futureCyclesJson
  console.log(`DEBUG: futureCyclesJson raw data: ${JSON.stringify(group.futureCyclesJson)}`);
  
  if (group.futureCyclesJson) {
    const futureDates = parseFutureCyclesJson(group.futureCyclesJson);
    console.log(`Found futureCyclesJson with ${futureDates.length} dates. Current index: ${completedCycleIndex}, Next index: ${completedCycleIndex + 1}`);
    
    if (futureDates.length > 0) {
      console.log(`First few cycle dates: ${futureDates.slice(0, Math.min(3, futureDates.length)).join(', ')}`);
    }
    
    if (completedCycleIndex + 1 < futureDates.length) {
      const nextCycleDateStr = futureDates[completedCycleIndex + 1];
      if (nextCycleDateStr) {
        nextCycleDate = new Date(nextCycleDateStr);
        console.log(`📅 Advancing to next cycle date: ${nextCycleDate.toISOString()}`);
      }
    } else {
      console.log(`🏁 All planned future cycles completed - no more dates available in futureCyclesJson`);
    }
  } else {
    console.log(`⚠️ No futureCyclesJson found, cannot determine next cycle date`);
  }

  // CRITICAL FIX: Calculate the next member cycle number correctly
  // Handle zero-based index properly
  const currentMemberCycle = group.currentMemberCycleNumber === 0 ? 1 : group.currentMemberCycleNumber;
  const totalMemberCount = group.groupMemberships.length;
  
  // Check if we've completed a full ROSCA cycle (gone through all members)
  const fullROSCACycleCompleted = currentMemberCycle >= totalMemberCount;
  console.log(`Current member cycle: ${currentMemberCycle}/${totalMemberCount} - Full ROSCA cycle completed: ${fullROSCACycleCompleted}`);

  // Initialize update data 
  const updateData: any = {
    totalGroupCyclesCompleted: group.totalGroupCyclesCompleted + 1
  };
  
  // CRITICAL FIX: Only set cycleStarted to false when a FULL ROSCA cycle is completed
  if (fullROSCACycleCompleted) {
    updateData.cycleStarted = false; // Only reset when all members have been paid
  } else {
    // Keep cycleStarted true as we're still in the middle of a ROSCA cycle
    updateData.cycleStarted = true;
  }
  
  // CRITICAL FIX: Advance to next member or reset to first member
  if (fullROSCACycleCompleted) {
    // If we've gone through all members, reset to first member
    updateData.currentMemberCycleNumber = 1;
    console.log(`Full ROSCA cycle completed, resetting to first member (cycle 1)`);
  } else {
    // Otherwise, advance to next member
    const nextMemberCycle = currentMemberCycle + 1;
    updateData.currentMemberCycleNumber = nextMemberCycle;
    console.log(`Advancing to next member, cycle ${nextMemberCycle}`);
  }
  
  // Set next cycle date and cyclesCompleted flag
  if (nextCycleDate) {
    updateData.nextCycleDate = nextCycleDate;
    updateData.cyclesCompleted = false;
    console.log(`Next cycle scheduled for ${nextCycleDate.toISOString()}`);
  } else {
    if (fullROSCACycleCompleted) {
      updateData.cyclesCompleted = true;
      console.log(`🏁 ALL CYCLES TRULY COMPLETED - No more dates and full ROSCA cycle finished`);
    } else {
      updateData.cyclesCompleted = false;
      console.log(`⚠️ No more dates but ROSCA cycle not complete - forcing continuation`);
    }
  }
  
  console.log(`Updating group with data: ${JSON.stringify(updateData)}`);
  
  // Update the group
  await tx.group.update({
    where: { id: groupId },
    data: updateData
  });

  // CRITICAL FIX: Only reset ALL members' hasBeenPaid status when a FULL ROSCA cycle is completed
  if (fullROSCACycleCompleted && (nextCycleDate || !updateData.cyclesCompleted)) {
    await tx.groupMembership.updateMany({
      where: { 
        groupId: group.id,
        status: MembershipStatus.Active
      },
      data: {
        hasBeenPaid: false
      }
    });
    console.log(`🔄 Reset payment status for ALL members for the next FULL cycle`);
  }
  // DO NOT RESET THE CURRENT PAYEE'S STATUS OTHERWISE - THEY SHOULD REMAIN MARKED AS PAID!

  console.log(`Cycle ${cycleNumber} completed for group ${groupId}.`);
  
  if (nextCycleDate) {
    console.log(`Next cycle scheduled for: ${nextCycleDate.toISOString()}`);
  } else {
    console.log(`No more cycles scheduled - ${fullROSCACycleCompleted ? 'all cycles completed' : 'missing future dates'}`);
  }
}
/**
 * Helper function to safely parse the futureCyclesJson from the database
 * Handles the type conversion safely with enhanced debugging
 */
function parseFutureCyclesJson(json: unknown): string[] {
  if (!json) {
    console.log(`parseFutureCyclesJson received empty input`);
    return [];
  }
  
  try {
    console.log(`Parsing futureCyclesJson of type: ${typeof json}`);
    
    // If it's already an array, check each element
    if (Array.isArray(json)) {
      console.log(`Input is an array with ${json.length} elements`);
      
      return json
        .map((item, index) => {
          // Ensure each item is a string
          if (typeof item === 'string') {
            return item;
          } else if (item instanceof Date) {
            return item.toISOString();
          } else if (item && typeof item === 'object' && 'toISOString' in item) {
            // Handle date-like objects
            return (item as Date).toISOString();
          } else {
            // Debug the problematic item
            console.log(`⚠️ Invalid date at index ${index} in futureCyclesJson: ${JSON.stringify(item)}`);
            return null;
          }
        })
        .filter((item): item is string => item !== null); // Type guard to ensure non-null
    }
    
    // If it's a string, try to parse it as JSON
    if (typeof json === 'string') {
      try {
        console.log(`Input is a string, attempting to parse as JSON`);
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          console.log(`Successfully parsed string to array with ${parsed.length} elements`);
          return parseFutureCyclesJson(parsed); // Recursively parse
        } else {
          console.log(`Parsed JSON is not an array: ${typeof parsed}`);
        }
      } catch (e) {
        console.error(`Error parsing futureCyclesJson string:`, e);
      }
    }
    
    // Handle potential object with specific format
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      console.log(`Input is an object, checking for dates property`);
      // Some systems might store as {dates: [...]} or similar
      if ('dates' in json && Array.isArray((json as any).dates)) {
        console.log(`Found dates array in object with ${(json as any).dates.length} elements`);
        return parseFutureCyclesJson((json as any).dates);
      }
      
      // Try to convert to array if it has numeric keys
      const objKeys = Object.keys(json);
      if (objKeys.length > 0 && objKeys.every(k => !isNaN(Number(k)))) {
        console.log(`Object appears to be array-like with ${objKeys.length} elements`);
        const values = objKeys.map(k => (json as any)[k]);
        return parseFutureCyclesJson(values);
      }
    }
    
    console.log(`Could not parse futureCyclesJson, unsupported format: ${JSON.stringify(json).substring(0, 100)}...`);
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
 * Process contribution cycle for a group with enhanced debugging and concurrency control
 */
export async function processContributionCycle(job: Job) {
  const { groupId, testMode } = job.data;
  console.log(`\n=== processContributionCycle started for group=${groupId} ===`);

  // CRITICAL FIX: Add distributed locking to prevent multiple workers processing the same group
  const lockKey = `process-lock:${groupId}`;
  const lockValue = `job-${job.id}`;
  
  try {
    // Try to acquire a Redis lock for this group using separate commands
    const redisClient = job.queue.client;
    
    // First try to set the key only if it doesn't exist
    const acquired = await redisClient.setnx(lockKey, lockValue);
    
    if (acquired !== 1) {
      console.log(`⚠️ Another job is already processing group ${groupId}, skipping...`);
      return;
    }
    
    // If lock was acquired, set an expiration separately
    await redisClient.expire(lockKey, 60); // 60 second expiry
    console.log(`🔒 Acquired processing lock for group ${groupId}`);

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
          payoutOrder: true,
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
        console.log(`Member ${m.user.firstName} ${m.user.lastName} (${m.id}): hasBeenPaid=${m.hasBeenPaid}, payoutOrder=${m.payoutOrder}`);
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

        // CRITICAL FIX: Find the current payee based directly on payoutOrder, handling potential offset
        console.log(`Current member cycle number: ${group.currentMemberCycleNumber}`);
        
        // Get all members with their payoutOrder for debugging
        const memberOrders = group.groupMemberships.map(m => 
          `${m.user.firstName} ${m.user.lastName}: order=${m.payoutOrder}, paid=${m.hasBeenPaid}`
        );
        console.log(`Member payout orders: ${memberOrders.join(', ')}`);
        
        // CRITICAL FIX: Find payee by payoutOrder directly
        // First try with potential offset (if currentMemberCycleNumber is 0 but payoutOrder starts at 1)
        let currentCyclePayee = group.groupMemberships.find(
          m => m.payoutOrder === group.currentMemberCycleNumber + 1
        );
        
        // If not found with offset, try direct match
        if (!currentCyclePayee) {
          currentCyclePayee = group.groupMemberships.find(
            m => m.payoutOrder === group.currentMemberCycleNumber
          );
        }
        
        // If still not found, default to the first unpaid member in payout order
        if (!currentCyclePayee) {
          console.log(`⚠️ Could not find payee with expected payout order. Defaulting to first unpaid member.`);
          
          // Get all unpaid members and sort by payoutOrder
          const unpaidMembers = group.groupMemberships
            .filter(m => !m.hasBeenPaid)
            .sort((a, b) => (a.payoutOrder || 999) - (b.payoutOrder || 999));
          
          if (unpaidMembers.length > 0) {
            currentCyclePayee = unpaidMembers[0];
            console.log(`Selected unpaid member with lowest payout order: ${currentCyclePayee.payoutOrder}`);
          } else {
            // If all members have been paid, reset and start with the first member
            console.log(`All members have been paid. Starting new cycle from first member.`);
            
            // Reset all members to unpaid
            for (const member of group.groupMemberships) {
              await tx.groupMembership.update({
                where: { id: member.id },
                data: { hasBeenPaid: false }
              });
            }
            
            // Select the first member by payoutOrder
            const firstMember = group.groupMemberships
              .sort((a, b) => (a.payoutOrder || 999) - (b.payoutOrder || 999))[0];
              
            currentCyclePayee = firstMember;
            console.log(`Reset all members and selected first member: ${currentCyclePayee.user.firstName} (order=${currentCyclePayee.payoutOrder})`);
          }
        }

        if (!currentCyclePayee) {
          throw new Error(`Could not find any eligible payee member`);
        }

        console.log(`🎯 Current cycle payee: ${currentCyclePayee.user.firstName} ${currentCyclePayee.user.lastName} (order=${currentCyclePayee.payoutOrder})`);
        
        // If the payee has already been marked as paid, finalize the cycle
        if (currentCyclePayee.hasBeenPaid) {
          console.log(`✅ Payee already marked as paid. Finalizing cycle.`);
          await checkAndFinalizeCycle(tx, groupId, group.currentMemberCycleNumber);
          return;
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

        const totalMembers = group.groupMemberships.length;
        const safeDecimal = group.contributionAmount;
        const expectedTotal = safeDecimal.mul(totalMembers - 1);

        console.log(`Processing cycle ${group.currentMemberCycleNumber}:`, {
          payee: `${currentCyclePayee.user.firstName} ${currentCyclePayee.user.lastName}`,
          totalMembers,
          contributionAmount: safeDecimal.toString(),
          expectedTotal: expectedTotal.toString()
        });

        const payeeUser = await tx.user.findUnique({
          where: { id: currentCyclePayee.userId },
          select: { stripeAccountId: true, email: true },
        });

        if (!payeeUser?.stripeAccountId) {
          throw new Error(`Payee missing Stripe ID: ${currentCyclePayee.userId}`);
        }

        // CRITICAL FIX: Check for existing payments in this cycle before creating new ones
        const existingPayments = await tx.payment.findMany({
          where: { 
            groupId: group.id, 
            cycleNumber: group.currentMemberCycleNumber
          }
        });
        
        console.log(`Found ${existingPayments.length} existing payments for cycle ${group.currentMemberCycleNumber}`);

        // Process payments for everyone EXCEPT the current payee
        for (const membership of group.groupMemberships) {
          const user = membership.user;
          
          // CRITICAL FIX: Skip the current cycle's payee - they should receive, not contribute
          if (user.id === currentCyclePayee.userId) {
            console.log(`Skipping payee: ${user.id} (${user.firstName} ${user.lastName})`);
            continue;
          }

          if (!user.stripeCustomerId || !user.stripeBecsPaymentMethodId || !user.stripeMandateId) {
            console.warn(`User ${user.id} missing Stripe setup`);
            continue;
          }

          // CRITICAL FIX: Check if payment already exists for this user in this cycle
          const existingPayment = existingPayments.find(p => 
            p.userId === user.id && p.cycleNumber === group.currentMemberCycleNumber
          );

          if (existingPayment) {
            console.log(`Payment exists for user ${user.id}, cycle ${group.currentMemberCycleNumber}`);
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
                cycleNumber: group.currentMemberCycleNumber.toString(),
                nextPayoutUser: payeeUser.email,
              },
            });

            await tx.payment.create({
              data: {
                userId: user.id,
                groupId: group.id,
                cycleNumber: group.currentMemberCycleNumber,
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
                    description: `Contribution for cycle ${group.currentMemberCycleNumber}`
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
                cycleNumber: group.currentMemberCycleNumber,
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
                    description: `Failed contribution - cycle ${group.currentMemberCycleNumber}`
                  }
                }
              }
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
        
        // Mark that we're processing this cycle if not already
        if (!group.cycleStarted) {
          await tx.group.update({
            where: { id: group.id },
            data: { cycleStarted: true }
          });
          console.log(`🔄 Updated group to mark cycle as started`);
        }
        
        // // CRITICAL FIX: Mark ONLY the current cycle's payee as having been paid
        // console.log(`🔍 CRITICAL: Marking payee ${currentCyclePayee.id} (${currentCyclePayee.user.firstName}) as paid`);
        
        // await tx.groupMembership.update({
        //   where: {
        //     id: currentCyclePayee.id
        //   },
        //   data: {
        //     hasBeenPaid: true
        //   }
        // });
        
        // Verify within transaction that update worked
        const verifyMember = await tx.groupMembership.findUnique({
          where: { id: currentCyclePayee.id },
          select: { hasBeenPaid: true }
        });
        
        console.log(`🔍 Verifying payee ${currentCyclePayee.id} status: hasBeenPaid=${verifyMember?.hasBeenPaid}`);
        
        if (!verifyMember?.hasBeenPaid) {
          console.error(`⚠️ WARNING: Failed to update hasBeenPaid status for payee ${currentCyclePayee.id}`);
        } else {
          console.log(`✅ Successfully marked payee ${currentCyclePayee.id} as paid`);
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
          payoutOrder: true,
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
        console.log(`Member ${m.user.firstName} ${m.user.lastName} (${m.id}): hasBeenPaid=${m.hasBeenPaid}, payoutOrder=${m.payoutOrder}`);
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
            select: { id: true, hasBeenPaid: true, userId: true, payoutOrder: true }
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
    } finally {
      // CRITICAL FIX: Always release the lock, even if processing fails
      const currentLock = await redisClient.get(lockKey);
      if (currentLock === lockValue) {
        await redisClient.del(lockKey);
        console.log(`🔓 Released processing lock for group ${groupId}`);
      }
    }
  } catch (lockError) {
    console.error(`Lock acquisition failed for group ${groupId}:`, lockError);
    // Don't rethrow - this is a locking error, not a processing error
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