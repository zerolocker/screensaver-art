import 'server-only'

import { stripe } from '@/lib/stripe'
import type { PaidPlan } from '@screensaver-art/constants'

export interface CheckoutSessionOptions {
  /** Which paid offer: the recurring subscription or the one-time lifetime purchase. */
  plan: PaidPlan
  /** Supabase user id — stamped into Stripe metadata so the webhook can attribute the sub. */
  userId: string
  userEmail?: string | null
  /** Reuse this Stripe customer if the user already has one; otherwise we create one. */
  existingCustomerId?: string | null
  successUrl: string
  cancelUrl: string
}

/**
 * Creates a Stripe Checkout Session for either paid offer. Shared by the
 * website server action (cookie-authed) and the `/api/checkout` route
 * (Bearer-authed, called by the Electron app) so there's one place that knows
 * how the session is built.
 *
 * The charged amounts are Stripe catalog Prices, set per-environment in Vercel
 * (test vs live differ by ID): `STRIPE_PRICE_ID` (recurring, quarterly) and
 * `STRIPE_LIFETIME_PRICE_ID` (one-time, $15.99). See docs/stripe-webhooks.md.
 *
 * Lifetime sessions run in `payment` mode and carry `purpose: 'lifetime'` in
 * metadata — that's what the webhook keys on to record the purchase (and cancel
 * any running subscription, so an upgrading subscriber is never double-billed).
 */
export async function createSubscriptionCheckoutSession(
  opts: CheckoutSessionOptions,
): Promise<{ url?: string; error?: string }> {
  const priceId =
    opts.plan === 'lifetime' ? process.env.STRIPE_LIFETIME_PRICE_ID : process.env.STRIPE_PRICE_ID
  if (!priceId) {
    console.error(
      opts.plan === 'lifetime'
        ? 'STRIPE_LIFETIME_PRICE_ID is not configured'
        : 'STRIPE_PRICE_ID is not configured',
    )
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

  const metadata = {
    supabase_user_id: opts.userId,
    ...(opts.plan === 'lifetime' ? { purpose: 'lifetime' } : {}),
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: opts.plan === 'lifetime' ? 'payment' : 'subscription',
    payment_method_types: ['card'],
    // Lets users enter a Stripe promotion code at checkout. Doubles as the
    // zero-cost way to smoke-test the *live* flow: a 100%-off live coupon runs
    // the full checkout → webhook → Supabase path without a real charge.
    allow_promotion_codes: true,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    ...(opts.plan === 'lifetime'
      ? { payment_intent_data: { metadata } }
      : { subscription_data: { metadata } }),
    metadata,
  })

  return { url: session.url ?? undefined }
}
