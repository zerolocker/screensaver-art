import { NextRequest, NextResponse, after } from 'next/server'
import { verifyNativeAuth } from '@/lib/auth/verify-native-auth'
import { createSubscriptionCheckoutSession } from '@/lib/checkout'
import { getPostHogClient, flushPostHog } from '@/lib/posthog-server'
import type { PaidPlan } from '@screensaver-art/constants'

/**
 * App-initiated checkout. The Electron app is already signed in, so instead of
 * bouncing the user to the website (re-login + a second "Subscribe" click) it
 * POSTs its Supabase access token here (with `{ plan }` in the JSON body) and
 * we hand back a Stripe Checkout URL the app opens directly — straight to
 * payment, no website session needed.
 *
 * Success/cancel land on the public `/checkout/complete` page (the browser that
 * opens Stripe checkout has no website session, so it can't use `/account`).
 * The purchase itself is synced by the Stripe webhook, and the app re-verifies
 * subscription status when its window regains focus.
 */
export async function POST(request: NextRequest) {
  const { user, isSubscribed, subscription } = await verifyNativeAuth(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // `plan` defaults to monthly so requests from app versions that predate the
  // lifetime offer keep working.
  const body: { plan?: string } = await request.json().catch(() => ({}))
  const plan: PaidPlan = body.plan === 'lifetime' ? 'lifetime' : 'monthly'

  if (subscription?.lifetime_purchased_at) {
    return NextResponse.json(
      { error: 'You already own the full gallery' },
      { status: 409 },
    )
  }

  // An active subscriber may still buy lifetime (the upgrade path — the webhook
  // cancels their subscription on purchase); another subscription is a no.
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

  // Conversion event for the in-app ("Subscribe" inside the Electron app) flow.
  // The matching client intent (`subscribe_clicked`) is sent from the renderer;
  // this server event is the ad-blocker-safe confirmation a session was created.
  getPostHogClient().capture({
    distinctId: user.id,
    event: 'app_checkout_session_created',
    properties: { source: 'electron_app', plan, existing_customer: Boolean(subscription?.stripe_customer_id) },
  })
  after(flushPostHog)

  return NextResponse.json({ url: result.url })
}

// Behind Vercel's proxy the public host is in x-forwarded-host; prefer it so the
// success/cancel URLs target the public domain (mirrors /auth/callback).
function resolveOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https'
    return `${proto}://${forwardedHost}`
  }
  return new URL(request.url).origin
}
