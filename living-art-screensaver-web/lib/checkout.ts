import 'server-only'

import { stripe } from '@/lib/stripe'

export interface CheckoutSessionOptions {
  /** Supabase user id — stamped into Stripe metadata so the webhook can attribute the sub. */
  userId: string
  userEmail?: string | null
  /** Reuse this Stripe customer if the user already has one; otherwise we create one. */
  existingCustomerId?: string | null
  successUrl: string
  cancelUrl: string
}

/**
 * Creates a Stripe Checkout Session for the single subscription product. Shared
 * by the website server action (cookie-authed) and the `/api/checkout` route
 * (Bearer-authed, called by the Electron app) so there's one place that knows
 * how the session is built.
 *
 * The charged amount is the Stripe catalog Price (`STRIPE_PRICE_ID`, set
 * per-environment in Vercel — test vs live differ by ID). See
 * docs/stripe-webhooks.md.
 */
export async function createSubscriptionCheckoutSession(
  opts: CheckoutSessionOptions,
): Promise<{ url?: string; error?: string }> {
  const priceId = process.env.STRIPE_PRICE_ID
  if (!priceId) {
    console.error('STRIPE_PRICE_ID is not configured')
    return { error: 'Pricing is not configured. Please contact support.' }
  }

  let customerId = opts.existingCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: opts.userEmail ?? undefined,
      metadata: { supabase_user_id: opts.userId },
    })
    customerId = customer.id
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    // Lets users enter a Stripe promotion code at checkout. Doubles as the
    // zero-cost way to smoke-test the *live* flow: a 100%-off live coupon runs
    // the full checkout → webhook → Supabase path without a real charge.
    allow_promotion_codes: true,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    subscription_data: {
      metadata: { supabase_user_id: opts.userId },
    },
    metadata: { supabase_user_id: opts.userId },
  })

  return { url: session.url ?? undefined }
}
