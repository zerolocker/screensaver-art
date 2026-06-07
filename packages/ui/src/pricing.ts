/**
 * Promotional pricing shown across the marketing site + Electron app.
 *
 * NOTE: this controls the *displayed* price only. What Stripe actually charges
 * is the Stripe catalog Price (referenced by the website's `STRIPE_PRICE_ID`
 * env var — different ID per test/live). While the promo runs, keep `promoPrice`
 * in sync with that Price's amount.
 *
 * The promo is a limited-time launch offer: `promoPrice` now, reverting to
 * `regularPrice` after `promoThrough`. Centralised here so the end date + both
 * prices live in one place across every surface that advertises them.
 */
export const PRICING = {
  /** Current promotional price the user is actually charged. */
  promoPrice: '$0.99',
  /** Regular price, shown struck-through; takes over once the promo ends. */
  regularPrice: '$2',
  interval: '/month',
  /** Human-readable last day the promo price is valid. */
  promoThrough: '2026/12/31',
} as const
