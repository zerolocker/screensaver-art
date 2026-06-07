# Stripe Setup & Webhooks

The webhook handler lives at `app/api/webhooks/stripe/route.ts` and handles these events:
- `checkout.session.completed` — records the subscription after the first successful payment
- `customer.subscription.created` — records subs made outside Checkout (e.g. customer portal)
- `customer.subscription.updated` — syncs subscription status / period changes
- `customer.subscription.deleted` — marks subscription as cancelled
- `invoice.paid` — the canonical "renewed / recovered" signal: re-marks active + extends the period
- `invoice.payment_failed` — marks subscription as past_due
- `invoice.payment_action_required` — SCA / 3-D Secure: a renewal needs cardholder authentication (common for international cards)

> **Reliability model:** for every event except `deleted`/`payment_failed`, the handler **re-fetches the subscription from Stripe by id and writes that canonical state** — it does not trust the event payload. Stripe does not guarantee event order and may retry/duplicate, so treating each event as "go re-read the truth" makes the writes order-independent and idempotent. `isSubscribed` is `status ∈ {active, trialing}`; every other status (`past_due`, `incomplete`, `unpaid`, `cancelled`, …) falls back to the free tier.

---

## How Stripe is wired

- **Server-side checkout only.** `lib/stripe.ts` builds the SDK from `STRIPE_SECRET_KEY`. `app/actions/stripe.ts` → `createCheckoutSession()` creates a Stripe-hosted Checkout URL and the browser is redirected to it.
- **The charged price is a Stripe catalog Price**, referenced by the **`STRIPE_PRICE_ID`** env var (`createCheckoutSession()` passes `{ price: STRIPE_PRICE_ID }`). Price IDs are **mode-specific** — the test and live Prices have different IDs — so `STRIPE_PRICE_ID` is set per-environment in Vercel (test for Preview/Dev, live for Production). The *displayed* price lives separately in `@screensaver-art/ui`'s `PRICING`; `lib/products.ts` holds display metadata only (no price number, to avoid drift).
- **No publishable key is used.** Checkout is fully redirect-based (no `@stripe/stripe-js` / `loadStripe`). The Stripe values the app reads are **`STRIPE_SECRET_KEY`**, **`STRIPE_WEBHOOK_SECRET`**, and **`STRIPE_PRICE_ID`**.

### Where the price lives (three concerns, deliberately separate)

| Concern | Source of truth | Notes |
|---|---|---|
| **What Stripe charges** | Stripe catalog **Price** (`STRIPE_PRICE_ID`) | Different ID per test/live; set per-env in Vercel. |
| **What the UI displays** | `PRICING` in `packages/ui/src/pricing.ts` | Compiled into the website *and* the Electron app at build time. Carries promo/regular/`promoThrough` framing Stripe can't hold. |
| **Product metadata** (name, features) | `lib/products.ts` | Display/registry only — no price number. |

Keep `PRICING.promoPrice` in sync with the Stripe Price amount when either changes (they change ~once a year, by hand, in a PR).

---

## Environments: test (local + preview) vs live (production)

Stripe has two fully separate worlds — **Test** and **Live** — with their own keys, customers, subscriptions, webhook endpoints, and dashboards. Nothing crosses between them. Our convention:

| Environment | Stripe mode | `STRIPE_SECRET_KEY` | `STRIPE_WEBHOOK_SECRET` | `STRIPE_PRICE_ID` |
|---|---|---|---|---|
| Local dev (`.env.local`) | **test** | `sk_test_…` | `whsec_…` from `stripe listen` (see below) | test `price_…` |
| Vercel **Preview** + **Development** | **test** | `sk_test_…` | from the test-mode dashboard endpoint (optional) | test `price_…` |
| Vercel **Production** | **live** | `sk_live_…` | `whsec_…` from the **live**-mode dashboard endpoint | live `price_…` |

> ⚠️ Key mode and Price mode must match within an environment. A `sk_live_` key with a test `price_…` (or vice-versa) fails checkout with `No such price`.

> ⚠️ Test-mode customers/subscriptions do **not** exist in live mode. Any `subscriptions` rows created while in test mode point at test customer/subscription IDs that aren't valid in live mode (their billing-portal link will 404). Clean those rows out of Supabase before/at launch.

---

## Local Development

Uses the **Stripe CLI** to forward live Stripe events to your local server.

### One-time setup

Install the Stripe CLI (if not already installed):
```bash
brew install stripe/stripe-cli/stripe
```

### Every time you develop locally

1. Start your dev server:
   ```bash
   pnpm dev
   ```

2. In a separate terminal, start the webhook forwarder:
   ```bash
   stripe listen \
     --api-key sk_test_<your_key> \
     --forward-to localhost:3000/api/webhooks/stripe
   ```

3. The CLI will print a signing secret like:
   ```
   Ready! Your webhook signing secret is whsec_xxxxxxxxxxxx
   ```

4. Make sure `.env.local` has that exact value:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
   ```
   > Note: this `whsec_` value is stable for local dev — it won't change between `stripe listen` sessions as long as you use the same API key.

### Triggering test events

```bash
# Test a completed checkout
stripe trigger checkout.session.completed --api-key sk_test_<your_key>

# Test a subscription update
stripe trigger customer.subscription.updated --api-key sk_test_<your_key>

# Test a failed payment
stripe trigger invoice.payment_failed --api-key sk_test_<your_key>
```

You should see `POST /api/webhooks/stripe 200` in your dev server logs.

---

## Production (Vercel) — live mode

Production must run in **live mode**. Do this in the Stripe dashboard with the **Test mode** toggle turned **off** (top-right), so the key and webhook you copy are the live ones.

### One-time setup in Stripe Dashboard (live mode)

0. **Activate your account** first (business details + bank account for payouts) — required before live charges work.
1. Toggle **Test mode off**.
2. **Developers → API keys** → copy the live secret key (`sk_live_…`).
2a. **Create the live Price** (test Prices don't exist in live mode). Either in the dashboard (**Product catalog** → the Living Art product → add a $0.99/month recurring price) or via CLI, then copy the live `price_…`:
   ```bash
   # In live mode (use your sk_live_ key):
   stripe products create --name "Living Art Screensaver" \
     --description "Transform your Mac into a living art gallery" --api-key sk_live_…
   stripe prices create --product prod_… --unit-amount 99 --currency usd \
     -d "recurring[interval]=month" --api-key sk_live_…   # → live price_…
   ```
3. **Developers → Webhooks** → [https://dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks) → **"Add endpoint"**.
4. Set the endpoint URL:
   ```
   https://living-art-screensaver.com/api/webhooks/stripe
   ```
5. Under **"Select events"**, add:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `invoice.payment_action_required`
6. Click **"Add endpoint"**.
7. On the endpoint detail page, click **"Reveal"** under *Signing secret* — copy the live `whsec_...` value.

### Set the Production-scoped values in Vercel

Set these for **Production only** (leave Preview + Development on the test values):

- `STRIPE_SECRET_KEY` = `sk_live_…`
- `STRIPE_WEBHOOK_SECRET` = live `whsec_…`
- `STRIPE_PRICE_ID` = live `price_…`

**Via dashboard:** [vercel.com/dashboard](https://vercel.com/dashboard) → project **v0-living-art-screensaver** → **Settings → Environment Variables**. Edit each var, set the Production value to the live one (a var can hold a different value per environment).

**Via CLI** (from `living-art-screensaver-web/`, repo is already `vercel link`ed):
```bash
# Replace the Production value only; Preview + Development keep their test values.
vercel env rm  STRIPE_SECRET_KEY      production --yes
vercel env add STRIPE_SECRET_KEY      production --value sk_live_…   --yes
vercel env rm  STRIPE_WEBHOOK_SECRET  production --yes
vercel env add STRIPE_WEBHOOK_SECRET  production --value whsec_…     --yes
vercel env rm  STRIPE_PRICE_ID        production --yes
vercel env add STRIPE_PRICE_ID        production --value price_…     --yes
vercel --prod                                                        # redeploy production
```

### Verifying in production

After deploying, go back to the live webhook endpoint and click **"Send test webhook"** for any subscribed event. The attempt log should show `200`.

---

## Testing the live flow without a real charge

Two worries to separate:

1. **Does the integration work?** (checkout → webhook → Supabase row → gallery unlock). **Test mode covers this completely** — it runs the *exact same code path*; only the key values differ and card networks aren't really contacted. Card `4242 4242 4242 4242` (and the other [test cards](https://docs.stripe.com/testing) for declines / 3-D Secure) fully exercise the integration. This is sufficient for verifying logic.

2. **Do my live keys / live webhook / account activation actually work end-to-end?** Test mode can *not* prove this. You need exactly one real live transaction — but it doesn't have to cost money:

   - **Best — 100%-off live coupon (zero cost):** in live mode create a coupon (100% off) + a promotion code (e.g. `LAUNCHTEST`). The checkout already passes `allow_promotion_codes: true`, so enter the code at checkout → a real `active` subscription is created, `$0.00` charged, and the live webhook fires + writes to Supabase. Delete/expire the promo code afterward. This validates everything.
   - **Free trial (zero cost now):** add `subscription_data.trial_period_days` to the checkout session → status `trialing`, no charge until the trial ends (cancel before then). Validates most of the flow; the card is saved.
   - **Real charge + refund (~$0.30 fee):** subscribe with your own card, then refund from the dashboard. Note Stripe does **not** return the processing fee on refunds, so this costs the ~2.9% + $0.30 fee on $0.99 (~$0.33). No code change needed.

   For recurring-billing behavior (renewals, trial-end, dunning) without waiting a month, use **[test clocks](https://docs.stripe.com/billing/testing/test-clocks)** — test mode only, but they validate the same webhook handlers.

---

## Not handled yet: disputes & refunds (if fraud/piracy becomes real)

We intentionally do **not** handle `charge.dispute.created` or `charge.refunded` today. If chargebacks/fraud become a real problem, add them as a **separate decision layer** — not as another writer of `status`:

- **Don't write `status` directly from charge events.** They're charge-level (resolve `charge → invoice → subscription` first) and, more importantly, a stale charge event arriving *after* a later successful payment could wrongly revoke an account that's legitimately active again.
- **On dispute → revoke access** by either cancelling the subscription via the Stripe API (`stripe.subscriptions.cancel()`, which then flows through the canonical re-fetch sync above) **or** setting a separate `blocked` flag that a later `invoice.paid` cannot clear (you lift it manually).
- **Refunds are a policy choice** — a refund does not imply cancellation. If "refund = leaving", cancel the sub via the API too.

**Ordering note:** Stripe doesn't guarantee delivery order, and our `subscriptions.updated_at` is *processing* time (set by the handler), not event time — so it can't order events. The signal that does reflect ordering is each event's `created` (second-granularity). The canonical re-fetch pattern sidesteps ordering for everything except the direct-write cases (`invoice.payment_failed`, `customer.subscription.deleted`).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `400 Invalid signature` | Wrong `STRIPE_WEBHOOK_SECRET` | Make sure you're using the `whsec_` from the correct endpoint (local CLI vs. production dashboard) |
| `400 No signature` | Request not from Stripe | Expected — direct browser requests will fail |
| `500 Webhook handler failed` | Code error in handler | Check server logs |
| Events not arriving locally | Stripe CLI not running | Run `stripe listen ...` in a separate terminal |
| Webhook 400s in prod even though endpoint exists | Live `STRIPE_SECRET_KEY` but a **test**-mode `whsec_` (or vice-versa) | Key mode and webhook-endpoint mode must match. Use the live `whsec_` from the **live**-mode endpoint in Production. |
| `No such customer` / billing portal 404 | Subscription row was created in **test** mode, but Production is now **live** | Stale test-mode rows in Supabase `subscriptions` — delete them; the customer/subscription IDs don't exist in live mode. |
| Checkout works but nobody is charged | Key is `sk_test_…` | You're in test mode. Production must use `sk_live_…`. |
| `No such price: price_…` | `STRIPE_PRICE_ID` mode ≠ `STRIPE_SECRET_KEY` mode | Use the live `price_…` with the live key (and the test `price_…` with the test key). |
| `Pricing is not configured` error | `STRIPE_PRICE_ID` env var missing for that environment | Set it (test Price for Preview/Dev, live Price for Production). |
