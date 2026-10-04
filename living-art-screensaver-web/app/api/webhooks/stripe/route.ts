import { headers } from 'next/headers'
import { NextResponse, after } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getPostHogClient, flushPostHog } from '@/lib/posthog-server'
import { isLifetimeCheckoutSession, recordLifetimePurchase } from '@/lib/lifetime'

// Service role: bypasses RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function toIso(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null
}

// Webhook payloads are minimal (unexpanded), so `subscription` is a string id.
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
  return invoice.parent?.subscription_details?.subscription as string | undefined
}

// The Supabase user id our checkout stored in the subscription's metadata, or
// null (created elsewhere, or the lookup failed). For PostHog.
async function userIdForSubscription(subscriptionId: string): Promise<string | null> {
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    const id = sub.metadata?.supabase_user_id
    return typeof id === 'string' && id ? id : null
  } catch {
    return null
  }
}

/**
 * Re-fetch the subscription from Stripe and write its current state to Supabase.
 * Ignoring the event payload means late or duplicate events can't overwrite
 * newer state.
 */
async function syncSubscriptionById(subscriptionId: string) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  const item = sub.items.data[0]
  const userId = sub.metadata?.supabase_user_id

  const row = {
    stripe_customer_id: sub.customer as string,
    stripe_subscription_id: sub.id,
    // Our schema spells it `cancelled`.
    status: sub.status === 'canceled' ? 'cancelled' : sub.status,
    current_period_start: toIso(item?.current_period_start),
    current_period_end: toIso(item?.current_period_end),
    updated_at: new Date().toISOString(),
  }

  if (userId) {
    // Upsert by user, which also covers an event arriving before the row exists.
    await supabaseAdmin
      .from('subscriptions')
      .upsert({ user_id: userId, ...row }, { onConflict: 'user_id' })
  } else {
    // Created outside our checkout: update an existing row, never create an orphan.
    await supabaseAdmin
      .from('subscriptions')
      .update(row)
      .eq('stripe_subscription_id', sub.id)
  }
}

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const posthog = getPostHogClient()

  try {
    switch (event.type) {
      // A subscription started, or a lifetime purchase.
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (isLifetimeCheckoutSession(session)) {
          await recordLifetimePurchase(session)
          const userId = session.metadata?.supabase_user_id
          if (userId) {
            posthog.capture({
              distinctId: userId,
              event: 'lifetime_purchased',
              properties: { stripe_checkout_session_id: session.id },
            })
          }
        } else if (session.subscription) {
          await syncSubscriptionById(session.subscription as string)
          const userId = session.metadata?.supabase_user_id
          if (userId) {
            posthog.capture({
              distinctId: userId,
              event: 'subscription_started',
              properties: { stripe_subscription_id: session.subscription as string },
            })
          }
        }
        break
      }

      // `created` also covers subscriptions made in the customer portal.
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await syncSubscriptionById(subscription.id)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id)
        const userId = subscription.metadata?.supabase_user_id
        if (userId) {
          posthog.capture({
            distinctId: userId,
            event: 'subscription_cancelled',
            properties: { stripe_subscription_id: subscription.id },
          })
        }
        break
      }

      // Payment arrived: a renewal or recovery. Re-sync status and period.
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = subscriptionIdFromInvoice(invoice)
        if (subscriptionId) {
          await syncSubscriptionById(subscriptionId)
          // The first invoice is the purchase itself, not a renewal.
          if (invoice.billing_reason === 'subscription_cycle') {
            const userId = await userIdForSubscription(subscriptionId)
            if (userId) {
              posthog.capture({
                distinctId: userId,
                event: 'subscription_renewed',
                properties: { stripe_subscription_id: subscriptionId },
              })
            }
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = subscriptionIdFromInvoice(invoice)
        if (subscriptionId) {
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', subscriptionId)
          const userId = await userIdForSubscription(subscriptionId)
          if (userId) {
            posthog.capture({
              distinctId: userId,
              event: 'subscription_payment_failed',
              properties: { stripe_subscription_id: subscriptionId },
            })
          }
        }
        break
      }

      // 3-D Secure: a renewal needs the cardholder to authenticate. Sync the real status.
      case 'invoice.payment_action_required': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = subscriptionIdFromInvoice(invoice)
        if (subscriptionId) {
          await syncSubscriptionById(subscriptionId)
        }
        break
      }
    }

    after(flushPostHog)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    posthog.captureException(err)
    await flushPostHog()
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
