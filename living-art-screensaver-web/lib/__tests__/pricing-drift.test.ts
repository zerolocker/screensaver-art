import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Stripe from 'stripe'
// Import the shared display pricing directly from source (not the package
// barrel, which pulls in React components that don't load in a node test env).
import { PRICING } from '../../../packages/ui/src/pricing'

// Drift guard: the price we *display* (PRICING, compiled into the website and
// the Electron app) must equal the price Stripe actually *charges* (the catalog
// Price referenced by STRIPE_PRICE_ID). These live in two places on purpose —
// Stripe can't hold the promo/regular/end-date framing — so this test is the
// thing that stops them silently drifting apart. See docs/stripe-webhooks.md.
//
// Billing is batched (monthly headline, charged once every billingPeriodMonths
// months to cut Stripe's per-transaction fee), so the Stripe Price carries the
// *quarterly* amount (billedAmount) on a `month` interval with interval_count = 3.
//
// It runs against whichever Stripe mode the env points at:
//   - locally: loads .env.local (test key + test Price)
//   - CI: set STRIPE_SECRET_KEY + STRIPE_PRICE_ID as secrets to activate it
// If neither is configured it skips (so it never blocks contributors w/o keys).

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const [, key] = m
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvLocal()

const secretKey = process.env.STRIPE_SECRET_KEY
const priceId = process.env.STRIPE_PRICE_ID
const configured = Boolean(secretKey && priceId)

/** "$0.99" -> 99 (cents). */
function displayPriceToCents(display: string): number {
  const amount = parseFloat(display.replace(/[^0-9.]/g, ''))
  return Math.round(amount * 100)
}

/** "/month" -> "month". */
function intervalWord(interval: string): string {
  return interval.replace(/[^a-z]/gi, '').toLowerCase()
}

describe('pricing drift: displayed PRICING vs Stripe catalog Price', () => {
  // Offline invariant: the per-month headline times the billing period must equal
  // the amount we actually batch into one charge. Guards the "$0.99/mo" framing.
  it('billedAmount equals promoPrice × billingPeriodMonths', () => {
    expect(displayPriceToCents(PRICING.billedAmount)).toBe(
      displayPriceToCents(PRICING.promoPrice) * PRICING.billingPeriodMonths,
    )
  })

  it.runIf(configured)(
    'PRICING matches the Stripe Price amount/currency/interval/interval_count',
    async () => {
      const stripe = new Stripe(secretKey!)
      const price = await stripe.prices.retrieve(priceId!)

      // Active, recurring price (not archived, not one-time).
      expect(price.active).toBe(true)
      expect(price.type).toBe('recurring')

      // Amount the user is charged == the batched amount we advertise, billed
      // once every billingPeriodMonths months.
      expect(price.unit_amount).toBe(displayPriceToCents(PRICING.billedAmount))
      expect(price.currency).toBe('usd')
      expect(price.recurring?.interval).toBe(intervalWord(PRICING.interval))
      expect(price.recurring?.interval_count).toBe(PRICING.billingPeriodMonths)
    },
    20_000,
  )

  it.skipIf(configured)('skipped: STRIPE_SECRET_KEY / STRIPE_PRICE_ID not set', () => {
    // Intentionally empty — this branch only documents why the guard is inactive.
    expect(true).toBe(true)
  })
})
