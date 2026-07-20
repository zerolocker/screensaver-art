import 'server-only'

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { normalizeSubscriptionStatus } from '@screensaver-art/constants'

// Service-role client: lifetime purchases are recorded server-to-server (webhook
// or post-checkout sync), bypassing RLS.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export function isLifetimeCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.mode === 'payment' && session.metadata?.purpose === 'lifetime'
}

/**
 * Records a completed one-time "Own it forever" purchase from its Checkout
 * Session, and cancels any still-running subscription so an upgrading
 * subscriber is never billed again ("no double billing").
 *
 * Idempotent — both the Stripe webhook and the website's post-checkout sync
 * call it, and a re-run just rewrites the same columns. It only ever touches
 * the lifetime columns (plus customer id), so it can't clobber concurrent
 * subscription syncs; conversely the subscription sync never writes the
 * lifetime columns, so a later subscription event can't revoke lifetime access.
 */
export async function recordLifetimePurchase(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.supabase_user_id
  if (!userId) {
    // Created outside our flow — nothing to attribute it to.
    console.error('Lifetime checkout session without supabase_user_id:', session.id)
    return
  }

  // The Stripe-hosted receipt lives on the payment's charge; grab it now so
  // "View receipt" on the account page needs no later Stripe round-trip.
  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  let receiptUrl: string | null = null
  if (paymentIntentId) {
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge'],
      })
      const charge = intent.latest_charge
      if (charge && typeof charge !== 'string') receiptUrl = charge.receipt_url ?? null
    } catch (err) {
      console.error('Failed to fetch lifetime receipt url:', err)
    }
  }

  await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: session.customer as string,
      lifetime_purchased_at: new Date().toISOString(),
      lifetime_receipt_url: receiptUrl,
      stripe_payment_intent_id: paymentIntentId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  // Upgrade path: end the recurring subscription now that everything is owned
  // outright. Cancellation is immediate (lifetime already covers the remaining
  // paid period); the resulting `customer.subscription.deleted` webhook marks
  // the row's status 'cancelled' without touching the lifetime columns.
  try {
    const { data: row } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', userId)
      .single()
    // Normalize before comparing: a row synced straight from Stripe could carry
    // `canceled`, which wouldn't match our `cancelled` and would send us on a
    // pointless retrieve (harmless — the Stripe-side check below still guards
    // the actual cancel — but the intent should read correctly).
    if (row?.stripe_subscription_id && normalizeSubscriptionStatus(row.status) !== 'cancelled') {
      const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id)
      if (sub.status !== 'canceled') {
        await stripe.subscriptions.cancel(sub.id)
      }
    }
  } catch (err) {
    // Never fail the purchase over this — the user has lifetime access either
    // way; a stray subscription can still be ended from the customer portal.
    console.error('Failed to auto-cancel subscription after lifetime purchase:', err)
  }
}
