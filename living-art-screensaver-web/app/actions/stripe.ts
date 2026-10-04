'use server'

import { after } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getProduct } from '@/lib/products'
import { createSubscriptionCheckoutSession } from '@/lib/checkout'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getPostHogClient, flushPostHog } from '@/lib/posthog-server'
import { isLifetimeCheckoutSession, recordLifetimePurchase } from '@/lib/lifetime'

/** Website checkout. `cancelPath` must be a real route. */
export async function createCheckoutSession(
  productId: string,
  origin: string,
  cancelPath = '/account',
) {
  const product = getProduct(productId)
  if (!product) {
    return { error: 'Product not found' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Please sign in to subscribe' }
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Lifetime owners have nothing left to buy.
  if (subscription?.lifetime_purchased_at) {
    return { error: 'You already own the full gallery' }
  }

  // A subscriber may upgrade to lifetime, but not buy a second subscription.
  if (product.plan === 'monthly' && subscription?.status === 'active') {
    return { error: 'You already have an active subscription' }
  }

  getPostHogClient().capture({
    distinctId: user.id,
    event: 'checkout_started',
    properties: { source: 'web', product_id: productId },
  })
  after(flushPostHog)

  return createSubscriptionCheckoutSession({
    plan: product.plan,
    userId: user.id,
    userEmail: user.email,
    existingCustomerId: subscription?.stripe_customer_id,
    successUrl: `${origin}/account?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}${cancelPath}`,
  })
}

export async function syncSubscriptionFromSession(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    if (session.metadata?.supabase_user_id !== user.id) {
      return { error: 'Session does not belong to current user' }
    }

    // Record lifetime here too, so the account page shows it straight away.
    if (isLifetimeCheckoutSession(session)) {
      if (session.payment_status !== 'paid') {
        return { error: 'Payment not completed' }
      }
      await recordLifetimePurchase(session)
      return { success: true }
    }

    if (!session.subscription || typeof session.subscription === 'string') {
      return { error: 'No subscription in session' }
    }

    const subscription = session.subscription

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const periodStart = subscription.items?.data?.[0]?.created
    const periodEnd = subscription.items?.data?.[0]?.created

    await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })

    return { success: true }
  } catch (err) {
    console.error('Failed to sync subscription:', err)
    return { error: 'Failed to sync subscription' }
  }
}

export async function createCustomerPortalSession(origin: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Please sign in to manage your subscription' }
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!subscription?.stripe_customer_id) {
    return { error: 'No subscription found' }
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${origin}/account`,
  })

  return { url: session.url }
}
