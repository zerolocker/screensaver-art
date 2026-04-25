import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// /api/subscription/verify is a thin auth check used by the Electron app to
// surface "your subscription expired" UI. Behavior we lock in:
//   - 401 when the user can't be resolved from the Bearer token
//   - 200 with { isActive, subscription } when they can
//   - subscription is forwarded as-is so the client can render dates etc.

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}))

vi.mock('@/lib/auth/verify-native-auth', () => ({
  verifyNativeAuth: authMock,
}))

import { GET } from '../route'

function makeReq(): NextRequest {
  return new NextRequest('https://example.com/api/subscription/verify')
}

describe('GET /api/subscription/verify', () => {
  beforeEach(() => {
    authMock.mockReset()
  })

  it('returns 401 when no user is resolved (missing or invalid token)', async () => {
    authMock.mockResolvedValue({ user: null, isSubscribed: false, subscription: null })
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
    expect(body.isActive).toBe(false)
  })

  it('returns 200 with isActive=true for an active subscriber', async () => {
    const subscription = {
      id: 'sub_1',
      user_id: 'u1',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_stripe_1',
      status: 'active',
      current_period_start: '2026-04-01T00:00:00Z',
      current_period_end: '2026-05-01T00:00:00Z',
    }
    authMock.mockResolvedValue({ user: { id: 'u1' }, isSubscribed: true, subscription })
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isActive).toBe(true)
    // The full subscription row gets forwarded so the client can render dates
    expect(body.subscription).toEqual(subscription)
  })

  it('returns 200 with isActive=false for an authed user without a subscription', async () => {
    authMock.mockResolvedValue({ user: { id: 'u2' }, isSubscribed: false, subscription: null })
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isActive).toBe(false)
    expect(body.subscription).toBeNull()
  })

  it('returns 200 with isActive=false for an authed user whose subscription is past_due', async () => {
    // verifyNativeAuth maps non-active/trialing → isSubscribed=false but still
    // forwards the subscription row so the client can show "your card was declined"
    const subscription = {
      id: 'sub_2',
      user_id: 'u3',
      stripe_customer_id: 'cus_3',
      stripe_subscription_id: null,
      status: 'past_due',
      current_period_start: null,
      current_period_end: null,
    }
    authMock.mockResolvedValue({ user: { id: 'u3' }, isSubscribed: false, subscription })
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isActive).toBe(false)
    expect(body.subscription).toEqual(subscription)
  })
})
