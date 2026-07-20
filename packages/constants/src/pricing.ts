import { FREE_ITEM_COUNT } from './gallery'

/**
 * Promotional pricing shown across the marketing site + Electron app.
 *
 * NOTE: this controls the *displayed* price only. What Stripe actually charges
 * is the Stripe catalog Price (referenced by the website's `STRIPE_PRICE_ID`
 * env var — different ID per test/live). Keep `billedAmount` in sync with that
 * Price's `unit_amount` and `billingPeriodMonths` with its `interval_count`
 * (the website's pricing-drift test enforces both).
 *
 * Billing is *batched* to cut Stripe's per-transaction fee (2.9% + $0.33 is steep
 * on a sub-$1 charge): instead of charging `promoPrice` every month, Stripe charges
 * `billedAmount` once every `billingPeriodMonths` months — one transaction instead
 * of three, same money. The headline we advertise stays per-month; `billedAmount`
 * is exactly `promoPrice × billingPeriodMonths`.
 *
 * The promo is a limited-time launch offer: `promoPrice` now, reverting to
 * `regularPrice` after `promoThrough`. Centralised here so the end date + both
 * prices live in one place across every surface that advertises them.
 */
export const PRICING = {
  /** Headline per-month promotional price we advertise. */
  promoPrice: '$0.99',
  /** Regular per-month price, shown struck-through; takes over once the promo ends. */
  regularPrice: '$2',
  interval: '/month',
  /**
   * The amount Stripe actually charges per billing cycle = `promoPrice × billingPeriodMonths`.
   * Must equal the Stripe catalog Price's `unit_amount`.
   */
  billedAmount: '$2.97',
  /**
   * How many months each charge covers. Must equal the Stripe Price's
   * `recurring.interval_count` (with `recurring.interval = 'month'`).
   */
  billingPeriodMonths: 3,
  /**
   * Short human cadence label shown next to the per-month headline (we don't
   * surface the batched `billedAmount` in the UI — Stripe shows it at checkout).
   * Keep in sync with `billingPeriodMonths` (3 → quarterly).
   */
  billingNote: 'Billed quarterly',
  /**
   * How many artworks free (un-subscribed) users get — the headline of the free
   * tier, shown across the site + app. Sourced from `FREE_ITEM_COUNT` (the count
   * of `free: true` pieces in gallery.json) so the advertised number can never
   * drift from the actual free-tier size.
   */
  freeItemCount: FREE_ITEM_COUNT,
  /** Human-readable last day the promo price is valid. */
  promoThrough: '2026/12/31',
  /**
   * One-time "Own it forever" purchase — unlocks the full gallery (including all
   * future art) with no recurring billing. Must equal the Stripe catalog Price
   * referenced by the website's `STRIPE_LIFETIME_PRICE_ID` env var (a one-time
   * Price; the pricing-drift test enforces the amount).
   */
  lifetimePrice: '$15.99',
  /** Display name of the one-time offer, shared across every surface. */
  lifetimeLabel: 'Own it forever',
  /** One-line pitch under the lifetime price. */
  lifetimeNote: 'One payment, no renewals.',
} as const

/** The two paid offers. `monthly` is the subscription; `lifetime` the one-time purchase. */
export type PaidPlan = 'monthly' | 'lifetime'

/**
 * The minimal shape of a `subscriptions` row that access decisions need. Both
 * the website (server routes) and the Electron app hold rows of this shape.
 */
export interface SubscriptionAccess {
  status?: string | null
  /** Set once the user completes the one-time "Own it forever" purchase. */
  lifetime_purchased_at?: string | null
}

/**
 * The single "does this user have full gallery access?" rule: a lifetime
 * purchase, or a subscription that is active/trialing. Every gate (gallery API,
 * cache-sync via `isSubscribed`, the account cards) derives from this.
 */
export function isSubscriptionActive(sub: SubscriptionAccess | null | undefined): boolean {
  if (!sub) return false
  return Boolean(sub.lifetime_purchased_at) || sub.status === 'active' || sub.status === 'trialing'
}

/**
 * The canonical `subscriptions.status` vocabulary — the only values the webhook
 * is allowed to write, and the exact set the account card renders a chip for.
 *
 * Note the British `cancelled`: Stripe spells it `canceled`, but our schema (see
 * CLAUDE.md) and UI have always used the double-L form, so the webhook
 * normalizes on write rather than letting both spellings into the column.
 */
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'inactive'

/**
 * Map a raw Stripe subscription status onto our vocabulary.
 *
 * Stripe's set is wider than ours (`incomplete`, `incomplete_expired`, `unpaid`,
 * `paused`, …). Everything we don't model explicitly collapses to `inactive` —
 * they all mean "no access", which is exactly how `isSubscriptionActive` already
 * treats them, so this only makes the stored value match the documented schema.
 *
 * Accepts our own spelling too, so it's safe to run over rows already in the DB
 * (the account card does exactly that, which fixes legacy rows without a
 * migration).
 */
export function normalizeSubscriptionStatus(raw: string | null | undefined): SubscriptionStatus {
  switch (raw) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
      return 'past_due'
    // Stripe's spelling + ours — one logical state, one stored value.
    case 'canceled':
    case 'cancelled':
      return 'cancelled'
    default:
      return 'inactive'
  }
}
