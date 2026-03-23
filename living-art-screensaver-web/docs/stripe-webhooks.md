# Stripe Webhook Setup

The webhook handler lives at `app/api/webhooks/stripe/route.ts` and handles these events:
- `checkout.session.completed` — creates/updates subscription after successful payment
- `customer.subscription.updated` — syncs subscription status changes
- `customer.subscription.deleted` — marks subscription as cancelled
- `invoice.payment_failed` — marks subscription as past_due

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

## Production (Vercel)

### One-time setup in Stripe Dashboard

1. Go to [https://dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**
3. Set the endpoint URL:
   ```
   https://living-art-screensaver.com/api/webhooks/stripe
   ```
4. Under **"Select events"**, add:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click **"Add endpoint"**
6. On the endpoint detail page, click **"Reveal"** under *Signing secret* — copy the `whsec_...` value

### Set the secret in Vercel

1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard) → project **v0-living-art-screensaver**
2. Navigate to **Settings → Environment Variables**
3. Add (or update) the variable:
   - **Name:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** `whsec_...` (from the Stripe endpoint above)
   - **Environment:** Production (and Preview if needed)
4. Redeploy the project so the new env var takes effect

### Verifying in production

After deploying, go back to the Stripe dashboard webhook endpoint and click **"Send test webhook"** for any of the subscribed events. Check the webhook attempt log — it should show a `200` response.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `400 Invalid signature` | Wrong `STRIPE_WEBHOOK_SECRET` | Make sure you're using the `whsec_` from the correct endpoint (local CLI vs. production dashboard) |
| `400 No signature` | Request not from Stripe | Expected — direct browser requests will fail |
| `500 Webhook handler failed` | Code error in handler | Check server logs |
| Events not arriving locally | Stripe CLI not running | Run `stripe listen ...` in a separate terminal |
