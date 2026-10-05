import 'server-only'

import { stripe } from '@/lib/stripe'
import type { PaidPlan } from '@screensaver-art/constants'

export interface CheckoutSessionOptions {
  plan: PaidPlan
  /** Stored in Stripe metadata so the webhook can find the user. */
  userId: string
  userEmail?: string | null
  /** Reused if set; otherwise a new Stripe customer is created. */
  existingCustomerId?: string | null
  successUrl: string
  cancelUrl: string
}

/**
 * Create a Stripe Checkout Session, for the website's server action and for
 * the app's `/api/checkout`. Lifetime sessions use `payment` mode and
 * `metadata.purpose = 'lifetime'`, which the webhook keys on. See
 * docs/stripe-webhooks.md.
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
    // Also lets a 100%-off live coupon test the live flow for free.
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
