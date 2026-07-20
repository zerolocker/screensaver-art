import { describe, it, expect } from 'vitest'
import { isSubscriptionActive, normalizeSubscriptionStatus } from './pricing'

describe('normalizeSubscriptionStatus', () => {
  it('collapses both spellings of cancelled onto ours', () => {
    // The whole point: Stripe writes `canceled`, the deleted-webhook wrote
    // `cancelled`, and the account card only had a chip for the latter — so the
    // same state rendered as "Cancelled" or "Inactive" depending on which event
    // landed last.
    expect(normalizeSubscriptionStatus('canceled')).toBe('cancelled')
    expect(normalizeSubscriptionStatus('cancelled')).toBe('cancelled')
  })

  it('passes through the statuses we model', () => {
    expect(normalizeSubscriptionStatus('active')).toBe('active')
    expect(normalizeSubscriptionStatus('trialing')).toBe('trialing')
    expect(normalizeSubscriptionStatus('past_due')).toBe('past_due')
    expect(normalizeSubscriptionStatus('inactive')).toBe('inactive')
  })

  it('collapses the rest of Stripe’s vocabulary to inactive', () => {
    for (const raw of ['incomplete', 'incomplete_expired', 'unpaid', 'paused']) {
      expect(normalizeSubscriptionStatus(raw)).toBe('inactive')
    }
  })

  it('handles a missing status (no row / null column)', () => {
    expect(normalizeSubscriptionStatus(null)).toBe('inactive')
    expect(normalizeSubscriptionStatus(undefined)).toBe('inactive')
    expect(normalizeSubscriptionStatus('')).toBe('inactive')
  })

  it('never widens access: only active/trialing survive as "has access"', () => {
    // Guards against someone later mapping e.g. past_due → active.
    const grants = ['active', 'trialing', 'past_due', 'canceled', 'unpaid', null].filter((raw) =>
      isSubscriptionActive({ status: normalizeSubscriptionStatus(raw) }),
    )
    expect(grants).toEqual(['active', 'trialing'])
  })
})

describe('isSubscriptionActive', () => {
  it('grants access for an active or trialing subscription', () => {
    expect(isSubscriptionActive({ status: 'active' })).toBe(true)
    expect(isSubscriptionActive({ status: 'trialing' })).toBe(true)
  })

  it('denies access for every non-active status', () => {
    for (const status of ['cancelled', 'past_due', 'inactive']) {
      expect(isSubscriptionActive({ status })).toBe(false)
    }
  })

  it('grants access for a lifetime owner regardless of subscription status', () => {
    // The upgrade path leaves the row cancelled + lifetime set; access must hold.
    expect(
      isSubscriptionActive({ status: 'cancelled', lifetime_purchased_at: '2026-07-19T00:00:00Z' }),
    ).toBe(true)
  })

  it('denies access for a missing row', () => {
    expect(isSubscriptionActive(null)).toBe(false)
    expect(isSubscriptionActive(undefined)).toBe(false)
  })
})
