import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// /api/checkout is the Electron app's one-click purchase entry point. The app is
// already signed in, so it POSTs its Bearer token + {plan} and we hand back a
// Stripe Checkout URL it opens directly. Behavior locked in here:
//   - the `plan` in the body picks the offer (this is the ONLY app-specific
//     logic — everything downstream is the shared checkout builder). Getting it
//     wrong would silently sell a subscription to someone who clicked "Buy once".
//   - a body-less request (app versions predating the lifetime offer) still works
//   - a lifetime OWNER can't buy anything again (409)
//   - an active SUBSCRIBER can still buy lifetime (the upgrade path) but not a
//     second subscription (409)

const { authMock, checkoutMock, captureMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  checkoutMock: vi.fn(),
  captureMock: vi.fn(),
}))

// `after()` requires a real request scope; outside the server it throws. Keep
// the rest of next/server intact (NextRequest/NextResponse) and no-op just that.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: () => {},
}))

vi.mock('@/lib/auth/verify-native-auth', () => ({ verifyNativeAuth: authMock }))
vi.mock('@/lib/checkout', () => ({ createSubscriptionCheckoutSession: checkoutMock }))
vi.mock('@/lib/posthog-server', () => ({
  getPostHogClient: () => ({ capture: captureMock }),
  flushPostHog: vi.fn(),
}))

import { POST } from '../route'

function makeReq(body?: unknown): NextRequest {
  return new NextRequest('https://example.com/api/checkout', {
    method: 'POST',
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  })
}

const FREE_USER = { user: { id: 'u1', email: 'a@b.c' }, isSubscribed: false, subscription: null }

describe('POST /api/checkout', () => {
  beforeEach(() => {
    authMock.mockReset()
    checkoutMock.mockReset()
    captureMock.mockReset()
    checkoutMock.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' })
  })

  it('returns 401 when the Bearer token resolves no user', async () => {
    authMock.mockResolvedValue({ user: null, isSubscribed: false, subscription: null })
    const res = await POST(makeReq({ plan: 'lifetime' }))
    expect(res.status).toBe(401)
    expect(checkoutMock).not.toHaveBeenCalled()
  })

  it('passes plan="lifetime" through to the checkout builder', async () => {
    authMock.mockResolvedValue(FREE_USER)
    const res = await POST(makeReq({ plan: 'lifetime' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' })
    expect(checkoutMock).toHaveBeenCalledWith(expect.objectContaining({ plan: 'lifetime' }))
  })

  it('passes plan="monthly" through to the checkout builder', async () => {
    authMock.mockResolvedValue(FREE_USER)
    await POST(makeReq({ plan: 'monthly' }))
    expect(checkoutMock).toHaveBeenCalledWith(expect.objectContaining({ plan: 'monthly' }))
  })

  it('defaults to monthly when the body is absent (pre-lifetime app versions)', async () => {
    authMock.mockResolvedValue(FREE_USER)
    await POST(makeReq())
    expect(checkoutMock).toHaveBeenCalledWith(expect.objectContaining({ plan: 'monthly' }))
  })

  it('defaults to monthly for an unrecognized plan value', async () => {
    authMock.mockResolvedValue(FREE_USER)
    await POST(makeReq({ plan: 'bogus' }))
    expect(checkoutMock).toHaveBeenCalledWith(expect.objectContaining({ plan: 'monthly' }))
  })

  it('stamps the plan into the success/cancel URLs so the return page can theme itself', async () => {
    authMock.mockResolvedValue(FREE_USER)
    await POST(makeReq({ plan: 'lifetime' }))
    const opts = checkoutMock.mock.calls[0][0]
    expect(opts.successUrl).toContain('plan=lifetime')
    expect(opts.cancelUrl).toContain('plan=lifetime')
  })

  it('409s a lifetime owner for either plan — there is nothing left to sell', async () => {
    authMock.mockResolvedValue({
      user: { id: 'u2' },
      isSubscribed: true,
      subscription: { lifetime_purchased_at: '2026-07-19T00:00:00Z' },
    })
    for (const plan of ['lifetime', 'monthly']) {
      const res = await POST(makeReq({ plan }))
      expect(res.status).toBe(409)
    }
    expect(checkoutMock).not.toHaveBeenCalled()
  })

  it('lets an active subscriber buy lifetime (the upgrade path)', async () => {
    authMock.mockResolvedValue({
      user: { id: 'u3' },
      isSubscribed: true,
      subscription: { stripe_customer_id: 'cus_3', lifetime_purchased_at: null },
    })
    const res = await POST(makeReq({ plan: 'lifetime' }))
    expect(res.status).toBe(200)
    expect(checkoutMock).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'lifetime', existingCustomerId: 'cus_3' }),
    )
  })

  it('409s an active subscriber trying to buy a SECOND subscription', async () => {
    authMock.mockResolvedValue({
      user: { id: 'u4' },
      isSubscribed: true,
      subscription: { stripe_customer_id: 'cus_4', lifetime_purchased_at: null },
    })
    const res = await POST(makeReq({ plan: 'monthly' }))
    expect(res.status).toBe(409)
    expect(checkoutMock).not.toHaveBeenCalled()
  })

  it('500s when the checkout builder fails (app falls back to opening the website)', async () => {
    authMock.mockResolvedValue(FREE_USER)
    checkoutMock.mockResolvedValue({ error: 'Pricing is not configured.' })
    const res = await POST(makeReq({ plan: 'lifetime' }))
    expect(res.status).toBe(500)
  })
})
