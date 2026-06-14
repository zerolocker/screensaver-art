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
   * tier, shown across the site + app. Sourced from `FREE_ITEM_COUNT` so the
   * advertised number can never drift from the backend's actual free-tier slice.
   */
  freeItemCount: FREE_ITEM_COUNT,
  /** Human-readable last day the promo price is valid. */
  promoThrough: '2026/12/31',
} as const
