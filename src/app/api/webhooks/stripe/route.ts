import { db } from '@/src/db'
import { stripe } from '@/src/lib/stripe'
import { headers } from 'next/headers'
import type Stripe from 'stripe'
import { SubscriptionStatus, OnboardingStatus, PaymentStatus } from '@prisma/client'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = headers().get('Stripe-Signature') ?? ''

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response(
      `Webhook Error: ${
        err instanceof Error ? err.message : 'Unknown Error'
      }`,
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (!session?.metadata?.userId) {
          console.log('No userId in session metadata')
          return new Response(null, { status: 200 })
        }

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        )

        console.log('Processing subscription:', subscription.id, 'for user:', session.metadata.userId)

        const existingUser = await db.user.findUnique({
          where: { id: session.metadata.userId }
        })

        if (!existingUser) {
          console.log('User not found:', session.metadata.userId)
          return new Response(null, { status: 404 })
        }

        console.log('Current user subscription status:', existingUser.subscriptionStatus)

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
            subscriptionStatus: 'Active' as SubscriptionStatus,
            subscriptions: {
              create: {
                stripeSubscriptionId: subscription.id,
                status: 'Active' as SubscriptionStatus,
                startDate: new Date(),
                planId: session.metadata.planSlug === 'pro' ? 'pro_plan' : 'basic_plan',
              }
            }
          },
          include: {
            subscriptions: true
          }
        })

        console.log('Update result:', updateResult)
        break
      }

      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent

        if (!setupIntent.customer || !setupIntent.payment_method) {
          console.log('Missing customer or payment_method in SetupIntent')
          return new Response(null, { status: 200 })
        }

        const paymentMethod = await stripe.paymentMethods.retrieve(
          setupIntent.payment_method as string
        )

        if (!paymentMethod.au_becs_debit) {
          console.log('Payment method is not BECS')
          return new Response(null, { status: 200 })
        }

        const customerId = setupIntent.customer as string
        const mandateId = paymentMethod.mandate

        const user = await db.user.findUnique({
          where: { stripeCustomerId: customerId }
        })

        if (!user) {
          console.log('User not found for customer ID:', customerId)
          return new Response(null, { status: 404 })
        }

        await db.user.update({
          where: { id: user.id },
          data: {
            stripePaymentMethodId: paymentMethod.id,
            stripeMandateId: mandateId,
          },
        })

        console.log('Updated user with PaymentMethod ID and Mandate ID')
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (!subscriptionId) {
          console.log('No subscription ID in invoice')
          break
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)

        await db.user.update({
          where: {
            stripeSubscriptionId: subscriptionId,
          },
          data: {
            stripePriceId: invoice.lines.data[0]?.price?.id,
            stripeCurrentPeriodEnd: new Date(
              subscription.current_period_end * 1000
            ),
            subscriptionStatus: 'Active' as SubscriptionStatus,
          },
        })

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        await db.user.update({
          where: {
            stripeSubscriptionId: subscription.id,
          },
          data: {
            subscriptionStatus: 'Canceled' as SubscriptionStatus,
            stripeSubscriptionId: null,
            stripePriceId: null,
            stripeCurrentPeriodEnd: null,
          },
        })

        await db.subscription.updateMany({
          where: {
            stripeSubscriptionId: subscription.id,
          },
          data: {
            status: 'Canceled' as SubscriptionStatus,
            endDate: new Date(),
          },
        })

        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        
        console.log('Processing account update for:', account.id);
        
        // Get current user details
        const user = await db.user.findUnique({
          where: { stripeAccountId: account.id },
          select: { 
            id: true, 
            onboardingStatus: true,
            stripeAccountId: true 
          }
        });

        if (!user) {
          console.log('No user found for Stripe account:', account.id);
          break;
        }

        let newStatus: OnboardingStatus = 'Pending';
        
        if (account.details_submitted) {
          // Check if charges and payouts are enabled
          if (account.charges_enabled && account.payouts_enabled) {
            newStatus = 'Completed';
          } else if (!account.charges_enabled || !account.payouts_enabled) {
            newStatus = 'Failed';
          }
        }

        console.log(`Updating user ${user.id} onboarding status to:`, newStatus);

        await db.user.update({
          where: { stripeAccountId: account.id },
          data: {
            onboardingStatus: newStatus,
            onboardingDate: newStatus === 'Completed' ? new Date() : null
          }
        });

        // If onboarding failed, deactivate active group memberships
        if (newStatus === 'Failed') {
          console.log(`Deactivating memberships for user ${user.id} due to failed onboarding`);
          
          await db.groupMembership.updateMany({
            where: {
              userId: user.id,
              status: 'Active'
            },
            data: {
              status: 'Inactive'
            }
          });
        }

        break;
      }

      case 'account.application.deauthorized': {
        // For this event, we only get the account ID in the data
        const accountId = (event.data.object as { account?: string }).account;
        
        if (!accountId) {
          console.log('No account ID in deauthorized event')
          break
        }
        
        console.log('Account deauthorized:', accountId)
        
        await db.user.update({
          where: { stripeAccountId: accountId },
          data: {
            stripeAccountId: null,
            onboardingStatus: 'Failed' as OnboardingStatus,
            onboardingDate: null
          }
        })
      
        // Deactivate all active memberships for this user
        const user = await db.user.findUnique({
          where: { stripeAccountId: accountId }
        })
      
        if (user) {
          await db.groupMembership.updateMany({
            where: {
              userId: user.id,
              status: 'Active'
            },
            data: {
              status: 'Inactive'
            }
          })
        }
      
        break
      }

      case 'capability.updated': {
        const capability = event.data.object as Stripe.Capability
        
        console.log('Capability updated for account:', capability.account)
        
        // Check if this impacts the overall account status
        const account = await stripe.accounts.retrieve(capability.account as string)
        
        const user = await db.user.findUnique({
          where: { stripeAccountId: account.id }
        })

        if (!user) {
          console.log('No user found for account:', account.id)
          break
        }

        // Update status based on capabilities
        if (!account.charges_enabled || !account.payouts_enabled) {
          await db.user.update({
            where: { stripeAccountId: account.id },
            data: {
              onboardingStatus: 'Failed' as OnboardingStatus
            }
          })
        }

        break
      }

case 'payment_intent.succeeded': {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  await db.payment.update({
    where: {
      stripePaymentIntentId: paymentIntent.id,
    },
    data: {
      status: 'Successful',
    },
  });
  
  break;
}

case 'payment_intent.payment_failed': {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  await db.payment.update({
    where: {
      stripePaymentIntentId: paymentIntent.id,
    },
    data: {
      status: 'Failed',
    },
  });
  
  break;
}

case 'payment_intent.processing': {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  await db.payment.update({
    where: {
      stripePaymentIntentId: paymentIntent.id,
    },
    data: {
      status: 'Pending',
    },
  });
  
  break;
}
    }

    return new Response(null, { status: 200 })
  } catch (error) {
    console.error('Error processing webhook:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      console.error('Error stack:', error.stack)
    }
    return new Response(
      `Webhook Error: ${
        error instanceof Error ? error.message : 'Unknown Error'
      }`,
      { status: 500 }
    )
  }
}