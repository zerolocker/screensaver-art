# PostHog analytics

The website and the Electron app send events to one PostHog project (US cloud).

| Where | SDK | Identity | Setup |
|---|---|---|---|
| Website, browser | `posthog-js` | Anonymous, then `identify(user.id)` | `instrumentation-client.ts`. Autocapture, pageviews, session replay. |
| Website, server | `posthog-node` | `user.id`, or the visitor's PostHog cookie id | `lib/posthog-server.ts`, flushed with `after(flushPostHog)` |
| Electron main | `posthog-node` | A device UUID, then `identify(user.id)` on first sync | `src/main/posthog.ts` |
| Electron renderer | none | Same as main | `src/renderer/src/lib/analytics.ts` forwards events over IPC |

- **Ad blockers.** The website sends browser events through a same-origin proxy (`/ingest/*` rewrites in `next.config.mjs`). Events that measure conversion are captured on the server, where nothing can block them.
- **One identity per app install.** Renderer events go through the main process so every event has the same id. The device id lives in `<userData>/posthog-device-id.json`; the first signed-in sync merges it into the user.
- **Browser identity.** Only a client-side `identify()` can link an anonymous browser session to a user. `components/posthog-auth-bridge.tsx` does this on load and on sign-in, and calls `reset()` on sign-out.
- **Session replay** is on, with `maskAllInputs: false` so replays are readable. Passwords are always masked. Add the `ph-no-capture` class to hide a field.

## Events

**Website, browser**
- Autocaptured pageviews, page leaves and clicks
- `download_clicked` `{ location: hero | pricing_section | cta }`
- `subscribe_clicked` `{ location, is_logged_in? }`
- `customer_portal_opened`
- `oauth_sign_in_clicked` `{ provider }`, `otp_code_requested`
- `login_completed` `{ method: email_otp }`
- `feedback_submitted` `{ source: website, has_image }`
- `checkout_completed` / `checkout_canceled` `{ source: app_initiated }`, from `/checkout/complete`
- `platform_interest_opened`, `platform_interest_selected` `{ platforms, location }`, `platform_interest_submitted` `{ email, platforms, location }`. The demand probe has no backend; the email is stored on the event.
- Email-the-link flow: `download_email_modal_opened`, `download_email_submitted`, `download_email_link_clicked` (see `living-art-screensaver-web/docs/download-link-email.md`)

**Website, server**
- `checkout_started` `{ source: web, product_id }` (`app/actions/stripe.ts`)
- `app_checkout_session_created` `{ source: electron_app, existing_customer }` (`app/api/checkout/route.ts`)
- `login_completed` `{ method: oauth }` (`app/auth/callback/route.ts`)
- `download_served` `{ platform, asset }` (`app/download/[os]/route.ts`), the reliable download count
- `download_link_requested` (`app/api/download-link/route.ts`)
- From the Stripe webhook: `subscription_started`, `subscription_renewed`, `subscription_payment_failed`, `subscription_cancelled`

**Electron main**
- `app_launched` `{ version, platform, arch, electron, packaged }`
- `gallery_synced` `{ item_count, is_subscribed, pruned }`, `gallery_sync_failed` `{ error }`
- `screensaver_registered` `{ version }`, `screensaver_activated`
- `cache_cleared`
- `feedback_submitted` `{ source: app, has_image }`

**Electron renderer**
- `subscribe_clicked` `{ source: gallery_lock | upsell_banner | account_card }`
- `screensaver_preview_clicked`

## Configuration

- **Website:** `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` (`https://us.i.posthog.com`), in `.env.local` and in Vercel for all environments.
- **Electron:** hardcoded in `src/main/posthog.ts`. It's a public write key, safe to ship. Override with `LART_POSTHOG_KEY` / `LART_POSTHOG_HOST`.
