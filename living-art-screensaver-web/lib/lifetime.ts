import 'server-only'

import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'

// Service role: bypasses RLS.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export function isLifetimeCheckoutSession(session: Stripe.Checkout.Session): boolean {
  return session.mode === 'payment' && session.metadata?.purpose === 'lifetime'
}

/**
 * Record a lifetime purchase and cancel any running subscription, so an
 * upgrading subscriber isn't billed again. Idempotent: the webhook and the
 * post-checkout page both call it. It writes only the lifetime columns (and
 * customer id), and subscription syncs never write those, so neither can
 * undo the other.
 */
export async function recordLifetimePurchase(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.supabase_user_id
  if (!userId) {
    // Created outside our flow.
    console.error('Lifetime checkout session without supabase_user_id:', session.id)
    return
  }

  // Save the receipt URL now, for the account page's "View receipt".
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

  // End the subscription immediately; lifetime covers the rest of its period.
  try {
    const { data: row } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', userId)
      .single()
    if (row?.stripe_subscription_id && row.status !== 'cancelled') {
      const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id)
      if (sub.status !== 'canceled') {
        await stripe.subscriptions.cancel(sub.id)
      }
    }
  } catch (err) {
    // Don't fail the purchase over this; the portal can still cancel it.
    console.error('Failed to auto-cancel subscription after lifetime purchase:', err)
  }
}
