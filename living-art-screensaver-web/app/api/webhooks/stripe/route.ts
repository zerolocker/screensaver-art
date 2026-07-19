import { headers } from 'next/headers'
import { NextResponse, after } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getPostHogClient, flushPostHog } from '@/lib/posthog-server'
import { isLifetimeCheckoutSession, recordLifetimePurchase } from '@/lib/lifetime'

// Use service role for webhook handling (bypasses RLS)
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

// Our checkout stamps the Supabase user id into subscription metadata; resolve
// it so PostHog events attach to the right person. Returns null if the sub was
// created outside our flow (no mapping) or the lookup fails.
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
 * Canonical sync: given a Stripe subscription id, re-fetch the *current* state
 * from Stripe and write it to Supabase.
 *
 * Re-fetching (instead of trusting the event's payload) makes us immune to
 * Stripe's out-of-order and duplicate delivery — every event just means "go
 * re-read the truth", so a stale event can never overwrite newer state. The
 * write is idempotent.
 */
async function syncSubscriptionById(subscriptionId: string) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  const item = sub.items.data[0]
  const userId = sub.metadata?.supabase_user_id

  const row = {
    stripe_customer_id: sub.customer as string,
    stripe_subscription_id: sub.id,
    status: sub.status,
    current_period_start: toIso(item?.current_period_start),
    current_period_end: toIso(item?.current_period_end),
    updated_at: new Date().toISOString(),
  }

  if (userId) {
    // Our checkout stamps supabase_user_id into subscription metadata, so we can
    // create-or-update keyed on the user — this also handles an event arriving
    // before the row exists.
    await supabaseAdmin
      .from('subscriptions')
      .upsert({ user_id: userId, ...row }, { onConflict: 'user_id' })
  } else {
    // Subscription created outside our checkout (no user mapping) — only update
    // an existing row; don't create an orphan we can't attribute to a user.
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
      // A purchase completed via our Checkout — either the subscription starting
      // or the one-time lifetime purchase. This is the canonical "a free user
      // converted to paid" moment.
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

      // Subscription lifecycle. `created` also covers subs made outside Checkout
      // (e.g. the customer portal); both just re-sync canonical state.
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

      // Money actually arrived — the canonical "active / renewed / recovered"
      // signal. Re-syncs status (-> active) and extends the period each renewal.
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = subscriptionIdFromInvoice(invoice)
        if (subscriptionId) {
          await syncSubscriptionById(subscriptionId)
          // Only a recurring cycle is a "renewal"; the first invoice is the
          // initial purchase (already tracked as subscription_started).
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

      // SCA / 3-D Secure: a renewal (common for EU / international cards) needs
      // the cardholder to authenticate before it clears. Sync Stripe's real
      // status so the app can surface "payment needs action" rather than
      // silently dropping the user to the free tier.
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
