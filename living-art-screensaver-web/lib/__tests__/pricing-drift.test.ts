import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Stripe from 'stripe'
import { PRICING } from '@screensaver-art/constants'

// The displayed price (PRICING) must match what Stripe charges. See
// docs/stripe-webhooks.md. Uses .env.local locally and secrets in CI; skips
// without keys.

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
const lifetimePriceId = process.env.STRIPE_LIFETIME_PRICE_ID
const configured = Boolean(secretKey && priceId)
const lifetimeConfigured = Boolean(secretKey && lifetimePriceId)

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
  // Monthly price × billing period = the amount charged.
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

      expect(price.active).toBe(true)
      expect(price.type).toBe('recurring')

      expect(price.unit_amount).toBe(displayPriceToCents(PRICING.billedAmount))
      expect(price.currency).toBe('usd')
      expect(price.recurring?.interval).toBe(intervalWord(PRICING.interval))
      expect(price.recurring?.interval_count).toBe(PRICING.billingPeriodMonths)
    },
    20_000,
  )

  // The same check for the lifetime Price.
  it.runIf(lifetimeConfigured)(
    'PRICING.lifetimePrice matches the Stripe lifetime Price (one-time)',
    async () => {
      const stripe = new Stripe(secretKey!)
      const price = await stripe.prices.retrieve(lifetimePriceId!)

      expect(price.active).toBe(true)
      expect(price.type).toBe('one_time')
      expect(price.unit_amount).toBe(displayPriceToCents(PRICING.lifetimePrice))
      expect(price.currency).toBe('usd')
    },
    20_000,
  )

  it.skipIf(configured && lifetimeConfigured)(
    'skipped: STRIPE_SECRET_KEY / STRIPE_PRICE_ID / STRIPE_LIFETIME_PRICE_ID not fully set',
    () => {
      // Empty: only records why the check is off.
      expect(true).toBe(true)
    },
  )
})
