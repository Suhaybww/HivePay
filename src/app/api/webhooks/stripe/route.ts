import { NextResponse } from 'next/server';
import { db } from '@/src/db';
import { stripe } from '@/src/lib/stripe';
import { headers } from 'next/headers';
import type Stripe from 'stripe';
import {
  SubscriptionStatus,
  OnboardingStatus,
  PaymentStatus,
  PayoutStatus,
  BECSSetupStatus,
  MembershipStatus,
  GroupStatus,
  PauseReason,
  CycleStatus
} from '@prisma/client';
import { sendGroupPausedEmail, sendPayoutProcessedEmail } from '@/src/lib/emailService';
import { Decimal } from "@prisma/client/runtime/library";
import { SchedulerService } from '@/src/lib/services/schedulerService';
import { checkAndFinalizeCycle } from '@/src/lib/queue/processors';

// ----------------------------------------------------------
// Helper to recalc group totals for Payment columns
// ----------------------------------------------------------
async function updateGroupPaymentStats(groupId: string) {
  const allPayments = await db.payment.findMany({
    where: { groupId },
  });

  let totalDebited = new Decimal(0);
  let totalPending = new Decimal(0);
  let totalSuccess = new Decimal(0);

  for (const pay of allPayments) {
    // Count everything that's NOT "Failed" as "debited"
    if (pay.status !== PaymentStatus.Failed) {
      totalDebited = totalDebited.plus(pay.amount);
    }
    if (pay.status === PaymentStatus.Pending) {
      totalPending = totalPending.plus(pay.amount);
    } else if (pay.status === PaymentStatus.Successful) {
      totalSuccess = totalSuccess.plus(pay.amount);
    }
  }

  await db.group.update({
    where: { id: groupId },
    data: {
      totalDebitedAmount: totalDebited,
      totalPendingAmount: totalPending,
      totalSuccessAmount: totalSuccess,
    },
  });

  console.log(
    `Updated group ${groupId} payment stats:\n` +
      `  totalDebited=${totalDebited},\n` +
      `  totalPending=${totalPending},\n` +
      `  totalSuccess=${totalSuccess}`
  );
}
export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get('Stripe-Signature') ?? '';

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    console.log(
      'Received webhook:',
      {
        type: event.type,
        account: event.account || 'platform',
        id: event.id
      }
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new NextResponse(
      `Webhook Error: ${err instanceof Error ? err.message : 'Unknown Error'}`,
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Define metadata type
        interface SessionMetadata {
          userId: string;
          planSlug: string;
          priceId: string;
        }
        
        // Type assertion for metadata
        const metadata = session.metadata as SessionMetadata | null;
        
        console.log('Processing checkout session:', {
          sessionId: session.id,
          metadata: metadata,
          subscriptionId: session.subscription,
          customerId: session.customer
        });
      
        // Type guard for metadata
        if (!metadata?.userId) {
          console.log('No metadata or userId in session');
          return new NextResponse(null, { status: 200 });
        }
      
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
      
        console.log('Retrieved subscription:', {
          id: subscription.id,
          status: subscription.status,
          customerId: subscription.customer,
          priceId: subscription.items.data[0]?.price.id,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000)
        });
      
        try {
          const updateResult = await db.$transaction(async (tx) => {
            const user = await tx.user.update({
              where: {
                id: metadata.userId,
              },
              data: {
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: subscription.customer as string,
                stripePriceId: subscription.items.data[0]?.price.id,
                stripeCurrentPeriodEnd: new Date(
                  subscription.current_period_end * 1000
                ),
                subscriptionStatus: SubscriptionStatus.Active,
                subscriptions: {
                  create: {
                    stripeSubscriptionId: subscription.id,
                    status: SubscriptionStatus.Active,
                    startDate: new Date(),
                    planId: metadata.planSlug === 'pro' ? 'pro_plan' : 'basic_plan',
                  },
                },
              },
              include: {
                subscriptions: true,
              },
            });
      
            console.log('User update successful:', {
              userId: user.id,
              subscriptionId: user.stripeSubscriptionId,
              status: user.subscriptionStatus
            });
      
            return user;
          });
      
          console.log('Transaction completed successfully:', updateResult.id);
        } catch (error) {
          console.error('Failed to update user subscription:', error);
          console.error('Update attempt data:', {
            userId: metadata.userId,
            subscriptionId: subscription.id,
            customerId: subscription.customer,
            priceId: subscription.items.data[0]?.price.id
          });
          throw error;
        }
      
        break;
      }

      case 'test_helpers.test_clock.created':
      case 'test_helpers.test_clock.ready': {
        console.log(`Test clock event: ${event.type}`);
        break;
      }

      case 'customer.updated': {
        console.log('Customer updated:', event.data.object.id);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Processing invoice payment:', {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
          customerId: invoice.customer
        });

        if (!invoice.subscription) {
          console.log('No subscription ID in invoice');
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        );

        await db.user.update({
          where: {
            stripeSubscriptionId: invoice.subscription as string,
          },
          data: {
            stripePriceId: invoice.lines.data[0]?.price?.id,
            stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
            subscriptionStatus: SubscriptionStatus.Active,
          },
        });

        console.log('Successfully updated user subscription from invoice');
        break;
      }


      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Processing subscription deletion:', {
          subscriptionId: subscription.id,
          customerId: subscription.customer
        });
      
        await db.$transaction(async (transaction) => { // Renamed to transaction for clarity
          const user = await transaction.user.findFirst({
            where: { 
              stripeCustomerId: subscription.customer as string 
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              groupMemberships: {
                where: {
                  status: MembershipStatus.Active,
                },
                select: {
                  groupId: true,
                  group: {
                    select: {
                      id: true,
                      name: true,
                      status: true,
                      groupMemberships: {
                        include: {
                          user: {
                            select: {
                              id: true,
                              email: true,
                              firstName: true,
                              lastName: true,
                              subscriptionStatus: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          });
      
          if (!user) {
            console.log('No user found for customer:', subscription.customer);
            return;
          }
      
          // Update user subscription status
          await transaction.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: SubscriptionStatus.Canceled,
              stripeSubscriptionId: null,
              stripePriceId: null,
              stripeCurrentPeriodEnd: null,
            },
          });
      
          // Process each group the user is a member of
          for (const membership of user.groupMemberships) {
            const group = membership.group;
            if (!group || group.status === GroupStatus.Paused) continue;
      
            // Pause group and notify members
            await transaction.group.update({
              where: { id: group.id },
              data: { status: GroupStatus.Paused }
            });
      
            const inactiveMembers = group.groupMemberships
              .filter((m: { user: { subscriptionStatus: SubscriptionStatus } }) => 
                m.user?.subscriptionStatus !== SubscriptionStatus.Active
              )
              .map((m: { user?: { firstName?: string; lastName?: string } }) => 
                m.user ? `${m.user.firstName} ${m.user.lastName}`.trim() : ''
              )
              .filter(Boolean);
      
            const emailPromises = group.groupMemberships
              .filter((m: { user?: { email?: string } }) => m.user?.email)
              .map((m: { user: { email: string; firstName: string; lastName: string } }) => 
                sendGroupPausedEmail({
                  groupName: group.name,
                  inactiveMembers,
                  recipient: {
                    email: m.user.email,
                    firstName: m.user.firstName,
                    lastName: m.user.lastName
                  }
                })
              );
      
            await Promise.allSettled(emailPromises);
          }
        });
      
        console.log('Successfully processed subscription deletion');
        break;
      }

case 'customer.subscription.deleted': {
  const subscription = event.data.object as Stripe.Subscription;
  console.log('Processing subscription deletion:', {
    subscriptionId: subscription.id,
    customerId: subscription.customer
  });

  await db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { 
        stripeCustomerId: subscription.customer as string 
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        groupMemberships: {
          where: {
            status: MembershipStatus.Active,
          },
          select: {
            groupId: true,
            group: {
              select: {
                id: true,
                name: true,
                status: true,
                groupMemberships: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        subscriptionStatus: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      console.log('No user found for customer:', subscription.customer);
      return;
    }

    // Update user subscription status
    await tx.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: SubscriptionStatus.Canceled,
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
      },
    });

    // Process each group the user is a member of
    for (const membership of user.groupMemberships) {
      const group = membership.group;
      if (!group || group.status === GroupStatus.Paused) continue;

      // Pause group and notify members
      await tx.group.update({
        where: { id: group.id },
        data: { status: GroupStatus.Paused }
      });

      const inactiveMembers = group.groupMemberships
        .filter(m => m.user?.subscriptionStatus !== SubscriptionStatus.Active)
        .map(m => m.user ? `${m.user.firstName} ${m.user.lastName}` : '')
        .filter(Boolean);

      const emailPromises = group.groupMemberships
        .filter(m => m.user?.email)
        .map(m => m.user && sendGroupPausedEmail({
          groupName: group.name,
          inactiveMembers,
          recipient: {
            email: m.user.email,
            firstName: m.user.firstName,
            lastName: m.user.lastName
          }
        }));

      await Promise.allSettled(emailPromises);
    }
  });

  console.log('Successfully processed subscription deletion');
  break;
}

      // ====== BECS Direct Debit Events ======
      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent;

        if (!setupIntent.customer || !setupIntent.payment_method) {
          console.log('Missing customer or payment_method in SetupIntent');
          return new NextResponse(null, { status: 200 });
        }

        const paymentMethod = await stripe.paymentMethods.retrieve(
          setupIntent.payment_method as string
        );

        if (!paymentMethod.au_becs_debit) {
          console.log('Payment method is not BECS');
          return new NextResponse(null, { status: 200 });
        }

        const customerId = setupIntent.customer as string;
        // Extract just the mandate ID string
        const mandateId =
          typeof setupIntent.mandate === 'string'
            ? setupIntent.mandate
            : setupIntent.mandate?.id;

        const user = await db.user.findUnique({
          where: { stripeCustomerId: customerId },
        });

        if (!user) {
          console.log('User not found for customer ID:', customerId);
          return new NextResponse(null, { status: 404 });
        }

        await db.user.update({
          where: { id: user.id },
          data: {
            stripeBecsPaymentMethodId: paymentMethod.id,
            stripeMandateId: mandateId || null,
            becsSetupStatus: BECSSetupStatus.Completed,
          },
        });

        console.log('Updated user with PaymentMethod ID and Mandate ID');
        break;
      }

     //==============================
      // Payment Intents (ROSCA or otherwise)
      //==============================
  
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        console.log(`PaymentIntent succeeded: ${pi.id}`);
      
        // 1) Mark local Payment => Successful
        const { count } = await db.payment.updateMany({
          where: { stripePaymentIntentId: pi.id },
          data: { status: PaymentStatus.Successful },
        });
        console.log(`Marked ${count} Payment(s) as Successful for PI=${pi.id}`);
      
        // 2) Get successful payments with all necessary fields
        const successPayments = await db.payment.findMany({
          where: { stripePaymentIntentId: pi.id },
          select: {
            id: true,
            groupId: true,
            cycleNumber: true,
          },
        });
      
        // 3) Recompute totals for each distinct group
        const groupIds = new Set(successPayments.map((p) => p.groupId));
        for (const gid of groupIds) {
          await updateGroupPaymentStats(gid);
        }
      
        // 4) Check if all payments for the cycle are successful and process payout
        for (const payment of successPayments) {
          const { groupId, cycleNumber, id } = payment;
      
          // Validate cycleNumber
          if (typeof cycleNumber !== 'number') {
            throw new Error(`Invalid cycleNumber: ${cycleNumber} for payment ${id}`);
          }
      
          const allPayments = await db.payment.findMany({
            where: { groupId, cycleNumber },
          });
      
          // Get group details with all memberships to check completion status
          const group = await db.group.findUnique({
            where: { id: groupId },
            include: {
              groupMemberships: {
                where: { status: MembershipStatus.Active },
                orderBy: { payoutOrder: 'asc' },
              },
            },
          });
      
          if (!group) continue;
      
          const allSuccessful = allPayments.every(p => p.status === PaymentStatus.Successful);
      
          if (allSuccessful) {
            console.log(`All payments successful for cycle ${cycleNumber} in group ${groupId}. Finalizing cycle...`);
      
            await db.$transaction(async (tx) => {
              // Find the payee for this cycle
              const payee = await tx.groupMembership.findFirst({
                where: {
                  groupId,
                  payoutOrder: cycleNumber,
                },
                include: { user: true },
              });
      
              if (!payee) {
                console.error(`Payee not found for cycle ${cycleNumber} in group ${groupId}`);
                return;
              }
      
              // Calculate payout based on total members (minus payee) × contribution amount
              const totalMembers = group.groupMemberships.length;
              const baseContribution = group.contributionAmount;
      
              if (!baseContribution) {
                throw new Error(`Group ${groupId} has no contribution amount set`);
              }
      
              const totalPayout = baseContribution.mul(totalMembers - 1);
      
              // Process normal payout...
              await tx.payout.create({
                data: {
                  groupId,
                  userId: payee.userId,
                  scheduledPayoutDate: new Date(),
                  amount: totalPayout,
                  status: PayoutStatus.Completed,
                  payoutOrder: cycleNumber,
                  transactions: {
                    create: {
                      userId: payee.userId,
                      groupId,
                      amount: totalPayout,
                      transactionType: 'Credit',
                      transactionDate: new Date(),
                      description: `Payout for cycle ${cycleNumber}`,
                      relatedPaymentId: null,
                    }
                  }
                },
              });
      
              // Mark member as paid
              await tx.groupMembership.update({
                where: { id: payee.id },
                data: { hasBeenPaid: true },
              });
      
              // Fetch the latest group memberships to ensure consistency
              const updatedMemberships = await tx.groupMembership.findMany({
                where: { groupId, status: MembershipStatus.Active },
              });
      
              // Debugging: Log the `hasBeenPaid` status of each member
              console.log(
                `Members' payment status for group ${groupId}:`,
                updatedMemberships.map(m => ({ id: m.id, hasBeenPaid: m.hasBeenPaid }))
              );
      
              // Check if all members have been paid
              const allMembersPaid = updatedMemberships.every(member => member.hasBeenPaid);
      
              if (allMembersPaid) {
                console.log(`All members have been paid. Finalizing cycle ${cycleNumber} for group ${groupId}.`);
                await checkAndFinalizeCycle(tx, groupId, cycleNumber);
              } else {
                console.log(`Not all members have been paid yet. Continuing to next cycle.`);
              }
      
              // Send payout processed email
              await sendPayoutProcessedEmail({
                recipient: {
                  email: payee.user.email,
                  firstName: payee.user.firstName,
                  lastName: payee.user.lastName,
                },
                groupName: group.name,
                amount: totalPayout.toString(),
              });
      
              // Update group's nextCycleDate and futureCyclesJson
              const updatedGroup = await tx.group.findUnique({
                where: { id: groupId },
                select: { futureCyclesJson: true },
              });
      
              if (updatedGroup?.futureCyclesJson) {
                const futureCycles = updatedGroup.futureCyclesJson as unknown as Date[];
                const remainingCycles = futureCycles.slice(1);
                const nextCycleDate = remainingCycles[0] || null;
      
                await tx.group.update({
                  where: { id: groupId },
                  data: {
                    nextCycleDate,
                    futureCyclesJson: remainingCycles,
                  },
                });
      
                if (nextCycleDate && !allMembersPaid) {
                  console.log(`Scheduling next cycle for group ${groupId} at ${nextCycleDate}`);
                  await SchedulerService.scheduleNextCycle(groupId);
                } else {
                  console.log(`No more cycles scheduled for group ${groupId}`);
                }
              }
            });
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        console.log(`PaymentIntent failed: ${pi.id}`);

        // 1) Mark local Payment(s) => Failed + increment retryCount
        const failedPayments = await db.payment.findMany({
          where: { stripePaymentIntentId: pi.id },
        });
        const groupIds = new Set<string>();

        for (const pay of failedPayments) {
          const updated = await db.payment.update({
            where: { id: pay.id },
            data: {
              status: PaymentStatus.Failed,
              retryCount: { increment: 1 },
            },
          });
          groupIds.add(updated.groupId);

          console.log(
            `Payment ${pay.id} => Failed (retryCount=${updated.retryCount})`
          );

          // 2) If 3+ => pause group
          if (updated.retryCount >= 3) {
            console.log(
              `Pausing group ${updated.groupId}, Payment ${pay.id} exceeded retry limit...`
            );
            await db.group.update({
              where: { id: updated.groupId },
              data: { status: GroupStatus.Paused },
            });
            // Optionally email group members about the pause
          }
        }

        // 3) Recompute totals for all impacted groups
        for (const gid of groupIds) {
          await updateGroupPaymentStats(gid);
        }

        // (Optional) Mark user sub inactive if needed
        if (pi.customer) {
          const custId = pi.customer as string;
          const user = await db.user.findUnique({
            where: { stripeCustomerId: custId },
          });
          if (user) {
            await db.user.update({
              where: { id: user.id },
              data: { subscriptionStatus: SubscriptionStatus.Inactive },
            });
            console.log(
              `User ${user.id} sub => Inactive due to PaymentIntent fail`
            );
          }
        }

        break;
      }

    

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Processing invoice payment failed:', {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
          customerId: invoice.customer
        });

        if (!invoice.subscription) {
          console.log('No subscription ID in invoice');
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        );

        // Set subscriptionStatus to Inactive
        await db.user.update({
          where: {
            stripeSubscriptionId: invoice.subscription as string,
          },
          data: {
            subscriptionStatus: SubscriptionStatus.Inactive,
          },
        });

        console.log(`User with subscription ${invoice.subscription} set to Inactive due to payment failure.`);
        break;
      }

      // ====== Account and Capability Events ======
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;

        console.log('Processing account update for:', account.id);

        // Get current user details
        const user = await db.user.findUnique({
          where: { stripeAccountId: account.id },
          select: {
            id: true,
            onboardingStatus: true,
            stripeAccountId: true,
          },
        });

        if (!user) {
          console.log('No user found for Stripe account:', account.id);
          break;
        }

        let newStatus: OnboardingStatus = OnboardingStatus.Pending;

        if (account.details_submitted) {
          // Check if charges and payouts are enabled
          if (account.charges_enabled && account.payouts_enabled) {
            newStatus = OnboardingStatus.Completed;
          } else {
            newStatus = OnboardingStatus.Failed;
          }
        }

        console.log(
          `Updating user ${user.id} onboarding status to:`,
          newStatus
        );

        await db.user.update({
          where: { stripeAccountId: account.id },
          data: {
            onboardingStatus: newStatus,
            onboardingDate:
              newStatus === OnboardingStatus.Completed ? new Date() : null,
          },
        });

        console.log(`User ${user.id} onboarding status updated to ${newStatus}.`);
        break;
      }

      case 'account.application.deauthorized': {
        // Since this is an application event, we need to get the associated account
        if (!event.account) {
          // event.account will have the connected account ID
          console.log('No account ID in deauthorized event');
          break;
        }

        console.log('Account deauthorized:', event.account);

        await db.user.update({
          where: { stripeAccountId: event.account }, // Use event.account
          data: {
            stripeAccountId: null,
            onboardingStatus: OnboardingStatus.Failed,
            onboardingDate: null,
          },
        });

        // Deactivate all active memberships for this user
        const user = await db.user.findUnique({
          where: { stripeAccountId: event.account },
        });

        if (user) {
          await db.groupMembership.updateMany({
            where: {
              userId: user.id,
              status: MembershipStatus.Active,
            },
            data: {
              status: MembershipStatus.Inactive,
            },
          });

          console.log(`Deactivated all active memberships for user ${user.id}.`);
        }

        break;
      }

      case 'capability.updated': {
        const capability = event.data.object as Stripe.Capability;

        console.log('Capability updated for account:', capability.account);

        const account = await stripe.accounts.retrieve(
          capability.account as string
        );

        const user = await db.user.findUnique({
          where: { stripeAccountId: account.id },
        });

        if (!user) {
          console.log('No user found for account:', account.id);
          break;
        }

        let newStatus: OnboardingStatus = OnboardingStatus.Pending;

        if (account.details_submitted) {
          if (account.charges_enabled && account.payouts_enabled) {
            newStatus = OnboardingStatus.Completed;
          } else if (
            capability.requirements?.errors &&
            Array.isArray(capability.requirements.errors) &&
            capability.requirements.errors.length > 0
          ) {
            newStatus = OnboardingStatus.Failed;
            console.log(
              'Failed due to errors:',
              capability.requirements.errors
            );
          }
        }

        console.log(
          `Updating user ${user.id} onboarding status to:`,
          newStatus
        );

        await db.user.update({
          where: { stripeAccountId: account.id },
          data: {
            onboardingStatus: newStatus,
            onboardingDate:
              newStatus === OnboardingStatus.Completed ? new Date() : null,
          },
        });

        console.log(`User ${user.id} onboarding status updated to ${newStatus}.`);
        break;
      }
// ====== Transfer Events ======
case 'transfer.reversed': {
  const transfer = event.data.object as Stripe.Transfer;

  await db.payout.updateMany({
    where: { stripeTransferId: transfer.id },
    data: { status: PayoutStatus.Failed },
  });

  console.log(`Payout with Transfer ID ${transfer.id} marked as Failed.`);
  break;
}

default:
  console.log(`Unhandled event type ${event.type}`);
  break;
}

return new NextResponse(null, { status: 200 });
} catch (error) {
console.error('Error processing webhook:', error);
if (error instanceof Error) {
console.error('Error details:', error.message);
console.error('Error stack:', error.stack);
}
return new NextResponse(
`Webhook Error: ${error instanceof Error ? error.message : 'Unknown Error'}`,
{ status: 500 }
);
}
}