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
} from '@prisma/client';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = headers().get('Stripe-Signature') ?? '';

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    // Log whether this is a Connect account event or platform event
    console.log(
      'Received webhook type:',
      event.type,
      event.account ? `for Connect account: ${event.account}` : 'for platform'
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
      // ====== Subscription Events ======
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (!session?.metadata?.userId) {
          console.log('No userId in session metadata');
          return new NextResponse(null, { status: 200 });
        }

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        console.log(
          'Processing subscription:',
          subscription.id,
          'for user:',
          session.metadata.userId
        );

        const existingUser = await db.user.findUnique({
          where: { id: session.metadata.userId },
        });

        if (!existingUser) {
          console.log('User not found:', session.metadata.userId);
          return new NextResponse(null, { status: 404 });
        }

        console.log(
          'Current user subscription status:',
          existingUser.subscriptionStatus
        );

        // Update user subscription details
        const updateResult = await db.user.update({
          where: {
            id: session.metadata.userId,
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
                planId:
                  session.metadata.planSlug === 'pro'
                    ? 'pro_plan'
                    : 'basic_plan',
              },
            },
          },
          include: {
            subscriptions: true,
          },
        });

        console.log('Update result:', updateResult);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) {
          console.log('No subscription ID in invoice');
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId
        );

        await db.user.update({
          where: {
            stripeSubscriptionId: subscriptionId,
          },
          data: {
            stripePriceId: invoice.lines.data[0]?.price?.id,
            stripeCurrentPeriodEnd: new Date(
              subscription.current_period_end * 1000
            ),
            subscriptionStatus: SubscriptionStatus.Active,
          },
        });

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await db.user.update({
          where: {
            stripeSubscriptionId: subscription.id,
          },
          data: {
            subscriptionStatus: SubscriptionStatus.Canceled,
            stripeSubscriptionId: null,
            stripePriceId: null,
            stripeCurrentPeriodEnd: null,
          },
        });

        await db.subscription.updateMany({
          where: {
            stripeSubscriptionId: subscription.id,
          },
          data: {
            status: SubscriptionStatus.Canceled,
            endDate: new Date(),
          },
        });

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

      // ====== Payment Intent Events ======
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        await db.payment.updateMany({
          where: {
            stripePaymentIntentId: paymentIntent.id,
          },
          data: {
            status: PaymentStatus.Successful,
          },
        });

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        await db.payment.updateMany({
          where: {
            stripePaymentIntentId: paymentIntent.id,
          },
          data: {
            status: PaymentStatus.Failed,
          },
        });

        break;
      }

      case 'payment_intent.processing': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        await db.payment.updateMany({
          where: {
            stripePaymentIntentId: paymentIntent.id,
          },
          data: {
            status: PaymentStatus.Pending,
          },
        });

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

        break;
      }

      // ====== Transfer Events ======
      case 'transfer.reversed': {
        const transfer = event.data.object as Stripe.Transfer;

        // Update the payout status to 'Failed' when transfer is reversed
        await db.payout.updateMany({
          where: { stripeTransferId: transfer.id },
          data: { status: PayoutStatus.Failed },
        });

        // Optionally, notify the user about the failed payout
        // You can implement a notification system here

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
