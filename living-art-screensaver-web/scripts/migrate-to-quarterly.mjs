#!/usr/bin/env node
/**
 * One-off migration: move existing monthly subscribers onto the new quarterly
 * Stripe Price ($2.97 every 3 months). Run once per Stripe mode — test, then live.
 *
 * For each ACTIVE subscription on OLD_PRICE_ID this calls subscriptions.update with:
 *   - items: [{ id, price: NEW_PRICE_ID }]
 *   - proration_behavior: 'create_prorations'  // credit the unused part of the current month
 *   - billing_cycle_anchor: 'now'              // start a fresh 3-month cycle today + invoice now
 * => the customer is invoiced immediately for ~$2.97 minus a credit for the unused
 *    days of their current month. The daily rate is unchanged ($0.99/mo == $2.97/90d),
 *    so nobody overpays — they just move to one charge every 3 months.
 *
 * TRIALING subs are switched WITHOUT charging (proration_behavior 'none', anchor
 * 'unchanged') so the trial is preserved and converts to quarterly at trial end.
 * canceled / past_due / incomplete / unpaid subs are SKIPPED (logged).
 *
 * Supabase is NOT written here. The resulting `customer.subscription.updated` +
 * `invoice.paid` webhooks re-sync each row's status/current_period_end via the
 * app's canonical sync path (app/api/webhooks/stripe/route.ts). Make sure the
 * webhook endpoint for this mode is live before running with --apply.
 *
 * DRY RUN by default — prints what it *would* do and changes nothing.
 * Pass --apply to actually mutate Stripe.
 *
 * Run history: the launch monthly→quarterly migration ($0.99/mo -> $2.97/quarter)
 * was applied to both test and live in 2026-06. Kept as the template for future
 * price/interval changes — see living-art-screensaver-web/docs/stripe-webhooks.md.
 *
 * Usage (from living-art-screensaver-web/):
 *   # preview (test mode)
 *   STRIPE_SECRET_KEY=sk_test_... OLD_PRICE_ID=price_oldMonthly NEW_PRICE_ID=price_newQuarterly \
 *     node scripts/migrate-to-quarterly.mjs
 *   # execute
 *     ... node scripts/migrate-to-quarterly.mjs --apply
 *   # live mode: same command with sk_live_ and the live price ids
 *
 * STRIPE_SECRET_KEY / OLD_PRICE_ID / NEW_PRICE_ID may also be set in .env.local
 * (auto-loaded). CLI flags --old=price_… --new=price_… override the env.
 */

import Stripe from 'stripe'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Minimal .env.local loader (same approach as the pricing-drift test) so the
// script runs without dotenv. Existing process.env always wins.
function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val
  }
}
loadEnvLocal()

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const flag = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

const SECRET_KEY = process.env.STRIPE_SECRET_KEY
const OLD_PRICE_ID = flag('old') || process.env.OLD_PRICE_ID
const NEW_PRICE_ID = flag('new') || process.env.NEW_PRICE_ID

function die(msg) {
  console.error(`✖ ${msg}`)
  process.exit(1)
}

if (!SECRET_KEY) die('STRIPE_SECRET_KEY is not set.')
if (!OLD_PRICE_ID) die('OLD_PRICE_ID is not set (the current monthly price id, or pass --old=price_…).')
if (!NEW_PRICE_ID) die('NEW_PRICE_ID is not set (the new quarterly price id, or pass --new=price_…).')
if (OLD_PRICE_ID === NEW_PRICE_ID) die('OLD_PRICE_ID and NEW_PRICE_ID are the same.')

const mode = SECRET_KEY.startsWith('sk_live') ? 'LIVE' : 'TEST'
const stripe = new Stripe(SECRET_KEY)

console.log(`\nMigrate monthly → quarterly  [${mode} mode]  ${APPLY ? '*** APPLY ***' : '(dry run)'}`)
console.log(`  old price: ${OLD_PRICE_ID}`)
console.log(`  new price: ${NEW_PRICE_ID}\n`)

const counts = { migrated: 0, trialMoved: 0, skipped: 0, errors: 0 }

// Sanity-check both prices exist in this mode and the new one is recurring.
try {
  const newPrice = await stripe.prices.retrieve(NEW_PRICE_ID)
  const r = newPrice.recurring
  console.log(
    `  new price = ${(newPrice.unit_amount ?? 0) / 100} ${newPrice.currency.toUpperCase()} ` +
      `every ${r?.interval_count ?? '?'} ${r?.interval ?? '?'}(s)\n`,
  )
} catch (e) {
  die(`Could not load NEW_PRICE_ID in ${mode} mode: ${e.message}`)
}

// status: 'all' so we can see (and explicitly skip) non-active subs. The `price`
// filter returns only subs still on the old price, so re-running is idempotent.
for await (const sub of stripe.subscriptions.list({ price: OLD_PRICE_ID, status: 'all', limit: 100 })) {
  const item = sub.items.data.find((i) => i.price.id === OLD_PRICE_ID)
  const who = `${sub.id} (cust ${sub.customer}, ${sub.status})`

  if (!item) {
    console.log(`  · skip  ${who} — no line item on the old price`)
    counts.skipped++
    continue
  }

  if (sub.status === 'active') {
    console.log(`  → move  ${who} → quarterly, invoice now (prorated)`)
    if (APPLY) {
      try {
        await stripe.subscriptions.update(sub.id, {
          items: [{ id: item.id, price: NEW_PRICE_ID }],
          proration_behavior: 'create_prorations',
          billing_cycle_anchor: 'now',
        })
        counts.migrated++
      } catch (e) {
        console.error(`    ✖ failed: ${e.message}`)
        counts.errors++
      }
    } else {
      counts.migrated++
    }
  } else if (sub.status === 'trialing') {
    console.log(`  → trial ${who} → quarterly at trial end, no charge now`)
    if (APPLY) {
      try {
        await stripe.subscriptions.update(sub.id, {
          items: [{ id: item.id, price: NEW_PRICE_ID }],
          proration_behavior: 'none',
          billing_cycle_anchor: 'unchanged',
        })
        counts.trialMoved++
      } catch (e) {
        console.error(`    ✖ failed: ${e.message}`)
        counts.errors++
      }
    } else {
      counts.trialMoved++
    }
  } else {
    console.log(`  · skip  ${who} — status not active/trialing`)
    counts.skipped++
  }
}

console.log(
  `\nDone. active→quarterly: ${counts.migrated}  trialing→quarterly: ${counts.trialMoved}  ` +
    `skipped: ${counts.skipped}  errors: ${counts.errors}`,
)
if (!APPLY) console.log('Dry run — nothing changed. Re-run with --apply to execute.')
if (counts.errors > 0) process.exit(1)
