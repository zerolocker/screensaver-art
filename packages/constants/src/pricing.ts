import { FREE_ITEM_COUNT } from './gallery'

/**
 * The prices shown on the website and in the app. Stripe's Prices are what's
 * actually charged; the website's pricing-drift test checks the two match.
 *
 * We advertise a monthly price but bill every `billingPeriodMonths` months, so
 * Stripe's fixed fee isn't paid on every $0.99 charge.
 */
export const PRICING = {
  /** Headline per-month promotional price we advertise. */
  promoPrice: '$0.99',
  /** Shown struck through; applies after `promoThrough`. */
  regularPrice: '$2',
  interval: '/month',
  /** `promoPrice × billingPeriodMonths`. Must equal the Stripe Price's `unit_amount`. */
  billedAmount: '$2.97',
  /** Must equal the Stripe Price's `recurring.interval_count` (interval `month`). */
  billingPeriodMonths: 3,
  /** Must match `billingPeriodMonths`. Stripe shows `billedAmount` at checkout. */
  billingNote: 'Billed quarterly',
  /** Size of the free tier. */
  freeItemCount: FREE_ITEM_COUNT,
  /** Human-readable last day the promo price is valid. */
  promoThrough: '2026/12/31',
  /** One-time purchase of the whole gallery, including future art. Must equal `STRIPE_LIFETIME_PRICE_ID`'s amount. */
  lifetimePrice: '$15.99',
  /** Display name of the one-time offer, shared across every surface. */
  lifetimeLabel: 'Own it forever',
  /** One-line pitch under the lifetime price. */
  lifetimeNote: 'One payment, no renewals.',
} as const

/** The two paid offers. `monthly` is the subscription; `lifetime` the one-time purchase. */
export type PaidPlan = 'monthly' | 'lifetime'

/** The part of a `subscriptions` row that access decisions need. */
export interface SubscriptionAccess {
  status?: string | null
  /** Set once the user completes the one-time "Own it forever" purchase. */
  lifetime_purchased_at?: string | null
}

/** The one access rule: a lifetime purchase, or an active or trialing subscription. */
export function isSubscriptionActive(sub: SubscriptionAccess | null | undefined): boolean {
  if (!sub) return false
  return Boolean(sub.lifetime_purchased_at) || sub.status === 'active' || sub.status === 'trialing'
}
