import { NextRequest, NextResponse, after } from 'next/server'
import { verifyNativeAuth } from '@/lib/auth/verify-native-auth'
import { createSubscriptionCheckoutSession } from '@/lib/checkout'
import { getPostHogClient, flushPostHog } from '@/lib/posthog-server'
import type { PaidPlan } from '@screensaver-art/constants'

/**
 * Checkout from the app: it posts its Supabase token and `{ plan }`, and gets a
 * Stripe Checkout URL to open, so the user never signs in to the website.
 * Stripe returns to the public `/checkout/complete` page (that browser has no
 * website session). The webhook records the purchase.
 */
export async function POST(request: NextRequest) {
  const { user, isSubscribed, subscription } = await verifyNativeAuth(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Defaults to monthly for older app versions.
  const body: { plan?: string } = await request.json().catch(() => ({}))
  const plan: PaidPlan = body.plan === 'lifetime' ? 'lifetime' : 'monthly'

  if (subscription?.lifetime_purchased_at) {
    return NextResponse.json(
      { error: 'You already own the full gallery' },
      { status: 409 },
    )
  }

  // A subscriber may upgrade to lifetime, but not buy a second subscription.
  if (plan === 'monthly' && isSubscribed) {
    return NextResponse.json(
      { error: 'You already have an active subscription' },
      { status: 409 },
    )
  }

  const origin = resolveOrigin(request)
  const result = await createSubscriptionCheckoutSession({
    plan,
    userId: user.id,
    userEmail: user.email,
    existingCustomerId: subscription?.stripe_customer_id,
    successUrl: `${origin}/checkout/complete?status=success&plan=${plan}`,
    cancelUrl: `${origin}/checkout/complete?status=canceled&plan=${plan}`,
  })

  if (result.error || !result.url) {
    return NextResponse.json(
      { error: result.error ?? 'Could not start checkout' },
      { status: 500 },
    )
  }

  getPostHogClient().capture({
    distinctId: user.id,
    event: 'app_checkout_session_created',
    properties: { source: 'electron_app', plan, existing_customer: Boolean(subscription?.stripe_customer_id) },
  })
  after(flushPostHog)

  return NextResponse.json({ url: result.url })
}

// Behind Vercel's proxy, x-forwarded-host is the public host.
function resolveOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https'
    return `${proto}://${forwardedHost}`
  }
  return new URL(request.url).origin
}
