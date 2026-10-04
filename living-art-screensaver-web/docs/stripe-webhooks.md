# Stripe setup

## How it's wired

- Checkout is server-side and redirect-based. `lib/checkout.ts` builds the session for both the website (`app/actions/stripe.ts`) and the app (`app/api/checkout/route.ts`). No publishable key is used.
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` (subscription) and `STRIPE_LIFETIME_PRICE_ID` (one-time). Price IDs differ between test and live mode.
- The subscription Price is `unit_amount = 297` with `recurring.interval = month` and `interval_count = 3`: $2.97 every 3 months, shown as $0.99/month. Billing quarterly avoids Stripe's fixed fee on every $0.99 charge.
- The lifetime checkout runs in `payment` mode with `metadata.purpose = 'lifetime'`. The webhook records it (`lib/lifetime.ts`) and cancels any running subscription.

The price lives in three places on purpose:

| What | Where |
|---|---|
| What Stripe charges | The Stripe Prices behind `STRIPE_PRICE_ID` / `STRIPE_LIFETIME_PRICE_ID` |
| What the UI shows | `PRICING` in `packages/constants/src/pricing.ts`, compiled into the website and the app |
| Product names and features | `lib/products.ts` (no prices) |

`lib/__tests__/pricing-drift.test.ts` fails if `PRICING` and the subscription Price disagree. In CI it checks the live Price, using the `STRIPE_READONLY_KEY` (a restricted, read-only live key) and `STRIPE_PRICE_ID` GitHub secrets. Without them it skips.

## The webhook

`app/api/webhooks/stripe/route.ts` handles:
- `checkout.session.completed`: a subscription started or a lifetime purchase
- `customer.subscription.created` / `updated`: status and period changes, including subscriptions made in the customer portal
- `customer.subscription.deleted`: marks the row `cancelled`
- `invoice.paid`: a renewal or recovery
- `invoice.payment_failed`: marks the row `past_due`
- `invoice.payment_action_required`: the card needs 3-D Secure authentication

Stripe can deliver events late, twice, or out of order. So for most events the handler re-fetches the subscription from Stripe and writes that, rather than trusting the payload. The exceptions are `deleted` and `payment_failed`, which write directly.

Disputes and refunds aren't handled. If they become a problem, don't set `status` from charge events (a late event could revoke a user who has since paid). Cancel the subscription through the API, or add a separate `blocked` flag.

## Environments

Test and live mode are separate worlds with their own keys, Prices, customers and webhooks.

| Environment | Mode | `STRIPE_WEBHOOK_SECRET` from |
|---|---|---|
| Local (`.env.local`) | test | `stripe listen` |
| Vercel Preview and Development | test | the test-mode dashboard endpoint |
| Vercel Production | live | the live-mode dashboard endpoint |

The key, Prices and webhook secret in one environment must all be the same mode.

## Local development

```bash
brew install stripe/stripe-cli/stripe
pnpm dev
stripe listen --api-key sk_test_… --forward-to localhost:3000/api/webhooks/stripe
```

Put the `whsec_…` that `stripe listen` prints into `.env.local` as `STRIPE_WEBHOOK_SECRET`. It stays the same across sessions for the same API key. Trigger events with, for example, `stripe trigger checkout.session.completed --api-key sk_test_…`.

## Production setup

In the Stripe dashboard, with test mode off:

1. Activate the account (business details and bank account).
2. Copy the live secret key from Developers → API keys.
3. Create the live Prices: $2.97 every 3 months, and $15.99 one-time. With the CLI:
   ```bash
   stripe prices create --product prod_… --unit-amount 297 --currency usd \
     -d "recurring[interval]=month" -d "recurring[interval_count]=3" --api-key sk_live_…
   ```
4. Add a webhook endpoint at `https://living-art-screensaver.com/api/webhooks/stripe` with the seven events above, and copy its signing secret.
5. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` and `STRIPE_LIFETIME_PRICE_ID` for **Production only** in the Vercel project `v0-living-art-screensaver`, then redeploy. With the CLI, per variable:
   ```bash
   vercel env rm  STRIPE_PRICE_ID production --yes
   vercel env add STRIPE_PRICE_ID production --value price_… --yes
   vercel --prod
   ```
6. In the dashboard, "Send test webhook" should return `200`.

Rows created in test mode point at customers that don't exist in live mode. Delete them from Supabase before going live.

## Changing the price

Stripe Prices can't be edited, so a change means a new Price. Do it in test mode first, then live.

1. Create the new Price.
2. Point `STRIPE_PRICE_ID` at it in `.env.local` and Vercel, and redeploy. Also update the `STRIPE_PRICE_ID` GitHub secret with the live id (`gh secret set STRIPE_PRICE_ID --body price_…`), or CI's drift test fails.
3. Update `PRICING` in `packages/constants/src/pricing.ts` in the same PR.
4. Move existing subscribers with `scripts/migrate-to-quarterly.mjs`. It's a dry run unless you pass `--apply`. Active subscriptions switch now with proration; trialing ones switch without a charge; others are skipped. Make sure that mode's webhook is live first, since the webhooks update Supabase.
   ```bash
   cd living-art-screensaver-web
   STRIPE_SECRET_KEY=sk_… OLD_PRICE_ID=price_old NEW_PRICE_ID=price_new node scripts/migrate-to-quarterly.mjs [--apply]
   ```
5. Archive the old Price once nobody is on it.

## Testing live mode without paying

Test mode runs the same code, so test cards (`4242 4242 4242 4242`) prove the integration. To prove the live keys and webhook work, you need one real live checkout:
- **Free:** create a 100%-off live coupon with a promotion code, enter it at checkout (promotion codes are enabled), then delete the code.
- **Small cost:** subscribe with your own card and refund it. Stripe keeps its fee (about $0.42).

For renewals and failed payments without waiting, use [test clocks](https://docs.stripe.com/billing/testing/test-clocks) in test mode.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `400 Invalid signature` | `STRIPE_WEBHOOK_SECRET` is from the wrong endpoint, or the wrong mode |
| `400 No signature` | The request didn't come from Stripe |
| Events don't arrive locally | Start `stripe listen` |
| `No such price` | The Price and the key are in different modes |
| `No such customer`, or the billing portal 404s | A test-mode row in Supabase while production is live. Delete it. |
| Checkout works but nobody is charged | Production is using a `sk_test_` key |
| "Pricing is not configured" | The Price env var is missing for that environment |
