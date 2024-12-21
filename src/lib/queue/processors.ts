import { Job } from 'bull';
import { db } from '@/src/db';
import { stripe } from '@/src/lib/stripe';
import { PaymentStatus, PayoutStatus, MembershipStatus, GroupStatus } from '@prisma/client';
import { SchedulerService } from '../services/schedulerService';
import { sendPaymentFailureEmail, sendPayoutProcessedEmail } from '@/src/lib/emailService';

export async function processContributionCycle(job: Job) {
  const { groupId } = job.data;

  try {
    // Start transaction for contribution cycle
    await db.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: { id: groupId },
        include: {
          groupMemberships: {
            where: { status: MembershipStatus.Active },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  stripeCustomerId: true,
                  stripeBecsPaymentMethodId: true,
                }
              }
            }
          }
        }
      });

      if (!group || group.status !== GroupStatus.Active) {
        throw new Error(`Group ${groupId} is not active or not found`);
      }

      // Create PaymentIntents for each member
      const paymentPromises = group.groupMemberships.map(async (membership) => {
        const user = membership.user;
        
        if (!user.stripeCustomerId || !user.stripeBecsPaymentMethodId) {
          console.error(`User ${user.id} missing payment setup`);
          return null;
        }

        try {
          // Create Stripe PaymentIntent
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(Number(group.contributionAmount) * 100), // Convert to cents
            currency: 'aud',
            customer: user.stripeCustomerId,
            payment_method: user.stripeBecsPaymentMethodId,
            confirm: true,
            metadata: {
              groupId: group.id,
              userId: user.id,
              cycleDate: new Date().toISOString()
            }
          });

          // Create payment record
          return tx.payment.create({
            data: {
              userId: user.id,
              groupId: group.id,
              amount: group.contributionAmount!,
              status: PaymentStatus.Pending,
              stripePaymentIntentId: paymentIntent.id
            }
          });
        } catch (error) {
          console.error(`Payment creation failed for user ${user.id}:`, error);
          // Send failure notification
          await sendPaymentFailureEmail({
            recipient: {
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName
            },
            groupName: group.name,
            amount: group.contributionAmount!.toString()
          });
          return null;
        }
      });

      // Wait for all payments to be processed
      await Promise.all(paymentPromises);
    });

    // Schedule next cycle
    await SchedulerService.scheduleNextCycle(groupId);

  } catch (error) {
    console.error(`Failed to process contribution cycle for group ${groupId}:`, error);
    throw error;
  }
}

export async function processGroupPayout(job: Job) {
  const { groupId } = job.data;

  try {
    await db.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: { id: groupId },
        include: {
          groupMemberships: {
            where: { status: MembershipStatus.Active },
            orderBy: { payoutOrder: 'asc' },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  stripeAccountId: true
                }
              }
            }
          },
          payments: {
            where: { status: PaymentStatus.Successful }
          }
        }
      });

      if (!group || group.status !== GroupStatus.Active) {
        throw new Error(`Group ${groupId} is not active or not found`);
      }

      // Calculate total available for payout
      const totalAvailable = group.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0
      );

      // Find next recipient based on payout order
      const recipient = group.groupMemberships.find(m => 
        m.user.stripeAccountId && 
        !group.payments.some(p => p.userId === m.user.id)
      );

      if (!recipient || !recipient.user.stripeAccountId) {
        throw new Error('No eligible recipient found for payout');
      }

      try {
        // Create Stripe transfer
        const transfer = await stripe.transfers.create({
          amount: Math.round(totalAvailable * 100), // Convert to cents
          currency: 'aud',
          destination: recipient.user.stripeAccountId,
          metadata: {
            groupId: group.id,
            recipientId: recipient.user.id,
            payoutDate: new Date().toISOString()
          }
        });

        // Create payout record
        await tx.payout.create({
          data: {
            groupId: group.id,
            userId: recipient.user.id,
            amount: totalAvailable,
            status: PayoutStatus.Completed,
            stripeTransferId: transfer.id,
            scheduledPayoutDate: new Date(),
            payoutOrder: recipient.payoutOrder
          }
        });

        // Send confirmation email
        await sendPayoutProcessedEmail({
          recipient: {
            email: recipient.user.email,
            firstName: recipient.user.firstName,
            lastName: recipient.user.lastName
          },
          groupName: group.name,
          amount: totalAvailable.toString()
        });

      } catch (error) {
        console.error(`Payout failed for group ${groupId}:`, error);
        throw error;
      }
    });

    // Schedule next payout
    await SchedulerService.scheduleNextCycle(groupId);

  } catch (error) {
    console.error(`Failed to process payout for group ${groupId}:`, error);
    throw error;
  }
}