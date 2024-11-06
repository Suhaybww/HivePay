import { db } from '@/src/db'
import { stripe } from '@/src/lib/stripe'
import { headers } from 'next/headers'
import type Stripe from 'stripe'

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

  const session = event.data
    .object as Stripe.Checkout.Session

  if (!session?.metadata?.userId) {
    return new Response(null, {
      status: 200,
    })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      )

      await db.user.update({
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
          subscriptionStatus: 'Active', // Add this to update the status
        },
      })

      // Create subscription record
      await db.subscription.create({
        data: {
          userId: session.metadata.userId,
          stripeSubscriptionId: subscription.id,
          status: 'Active',
          startDate: new Date(),
          planId: session.metadata.planSlug === 'pro' ? 'pro_plan' : 'basic_plan', // Adjust based on your Plan IDs
        },
      })
    }

    if (event.type === 'invoice.payment_succeeded') {
      // Retrieve the subscription details from Stripe.
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      )

      await db.user.update({
        where: {
          stripeSubscriptionId: subscription.id,
        },
        data: {
          stripePriceId: subscription.items.data[0]?.price.id,
          stripeCurrentPeriodEnd: new Date(
            subscription.current_period_end * 1000
          ),
          subscriptionStatus: 'Active', // Ensure status stays active on renewal
        },
      })
    }

    // Add handling for subscription cancellation
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription

      await db.user.update({
        where: {
          stripeSubscriptionId: subscription.id,
        },
        data: {
          subscriptionStatus: 'Canceled',
          stripeSubscriptionId: null,
          stripePriceId: null,
          stripeCurrentPeriodEnd: null,
        },
      })

      // Update subscription record
      await db.subscription.updateMany({
        where: {
          stripeSubscriptionId: subscription.id,
        },
        data: {
          status: 'Canceled',
          endDate: new Date(),
        },
      })
    }

    return new Response(null, { status: 200 })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(
      `Webhook Error: ${
        error instanceof Error ? error.message : 'Unknown Error'
      }`,
      { status: 500 }
    )
  }
}