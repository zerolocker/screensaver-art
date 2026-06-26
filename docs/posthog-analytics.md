# PostHog analytics

Product analytics for both shipping surfaces — the **website**
(`living-art-screensaver-web/`) and the **Electron app** (`electron-app/`) — into
one PostHog project (US cloud).

## Design at a glance

| Surface | SDK | Identity | Notes |
|---|---|---|---|
| Website (browser) | `posthog-js` | anonymous → `identify(user.id)` via `PostHogAuthBridge` | Init in `instrumentation-client.ts`. Autocapture + SPA pageviews + session replay. |
| Website (server: API routes, server actions, webhook) | `posthog-node` | `user.id` (or PostHog cookie id for anonymous downloads) | Singleton in `lib/posthog-server.ts`; flushed via `after(flushPostHog)`. |
| Electron main | `posthog-node` | stable device UUID → `identify(user.id)` on first sync | `src/main/posthog.ts`. Key is hardcoded (publishable). |
| Electron renderer | none (forwards over IPC) | same as main | `src/renderer/src/lib/analytics.ts` → `analytics:capture` IPC → main client. |

Two deliberate choices:

- **Ad-blocker resilience.** The website routes `posthog-js` through a
  same-origin reverse proxy (`/ingest/*` rewrites in `next.config.mjs`; `ingest`
  is excluded from the Supabase middleware matcher in `proxy.ts`). The
  conversion-critical events (`checkout_started`, `app_checkout_session_created`,
  `download_served`, the Stripe webhook lifecycle) are captured **server-side**,
  where no blocker can drop them.
- **One identity per Electron install.** The renderer has no PostHog SDK; UI
  events are forwarded to the main process so every event — main or renderer —
  carries the same device/user `distinctId`. A device UUID
  (`<userData>/posthog-device-id.json`) covers pre-login events; the first
  authenticated sync calls `identify()` + `alias()` to merge it into the user.
- **Browser identity is client-side.** Only a client-side `identify()` merges a
  browser's anonymous session into the user — server-side identify can't (it
  never sees the browser's anon id). So `components/posthog-auth-bridge.tsx`
  (mounted in the root layout) identifies off the Supabase session on load + on
  every sign-in, and `reset()`s on sign-out. The email-OTP screen and
  `/auth/callback` (OAuth) still fire their own `identify`/`login_completed`, but
  the bridge is what guarantees OAuth + returning-visitor browser events attach
  to the user.

### Session replay
Enabled at the PostHog **project** level; the reverse proxy already carries the
recorder asset (`/ingest/static/recorder.js`) and snapshot uploads (`/ingest/s/`).
Privacy posture: this app has minimal privacy surface, so we set
`maskAllInputs: false` in `instrumentation-client.ts` for fully legible replays
(input values, incl. the login email, are captured; passwords are always masked
by PostHog regardless). If a sensitive field ever needs hiding, add the
`ph-no-capture` class to that element.

## Events

### Website — client (`posthog-js`)
- autocaptured **pageviews / pageleaves / clicks** (via `defaults`)
- `download_clicked` `{ location: hero | pricing_section | cta }`
- `subscribe_clicked` `{ location: pricing_section | account_page, is_logged_in? }`
- `customer_portal_opened`
- `oauth_sign_in_clicked` `{ provider }`, `otp_code_requested`
- `login_completed` `{ method: email_otp }` (+ `identify`)
- `feedback_submitted` `{ source: website, has_image }`
- `checkout_completed` / `checkout_canceled` `{ source: app_initiated }` (the public `/checkout/complete` page)

### Website — server (`posthog-node`)
- `checkout_started` `{ source: web, product_id }` — `app/actions/stripe.ts`
- `app_checkout_session_created` `{ source: electron_app, existing_customer }` — `app/api/checkout/route.ts`
- `login_completed` `{ method: oauth }` (+ `identify`) — `app/auth/callback/route.ts`
- `download_served` `{ platform, asset }` — `app/download/[os]/route.ts` (**ad-blocker-safe download count**; reuses the visitor's PostHog cookie id)
- Stripe webhook (`app/api/webhooks/stripe/route.ts`):
  - `subscription_started` — `checkout.session.completed`
  - `subscription_renewed` — `invoice.paid` with `billing_reason = subscription_cycle`
  - `subscription_payment_failed` — `invoice.payment_failed`
  - `subscription_cancelled` — `customer.subscription.deleted`

### Electron — main (`posthog-node`)
- `app_launched` `{ version, platform, arch, electron, packaged }`
- `gallery_synced` `{ item_count, is_subscribed, pruned }` (+ `identify` on the access token's user id)
- `gallery_sync_failed` `{ error }`
- `screensaver_registered` `{ version }`
- `screensaver_activated`
- `cache_cleared`
- `feedback_submitted` `{ source: app, has_image }`

### Electron — renderer (forwarded over IPC)
- `subscribe_clicked` `{ source: gallery_lock | upsell_banner | account_card }`
- `screensaver_preview_clicked`

## Configuration

Project token (publishable `phc_…`) + host live in:

- **Website:** `living-art-screensaver-web/.env.local` (gitignored) and **Vercel**
  project env (Production + Preview + Development):
  - `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`
  - `NEXT_PUBLIC_POSTHOG_HOST` = `https://us.i.posthog.com`
- **Electron:** hardcoded in `src/main/posthog.ts` (same convention as the
  Supabase anon key in `src/renderer/src/lib/supabase.ts`; the token is a
  client-side write key and safe to ship). Override for dev with
  `LART_POSTHOG_KEY` / `LART_POSTHOG_HOST`.