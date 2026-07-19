import { CHECKOUT_ENDPOINT } from './api'
import { getAccessToken } from './supabase'
import { log } from './log'
import { track } from './analytics'
import type { PaidPlan } from '@screensaver-art/constants'

// Fallback target when we can't open a direct Stripe checkout (offline, already
// subscribed, server error, no token): the website's account page, where the
// user can sign in and subscribe/manage the old way.
const ACCOUNT_URL = 'https://living-art-screensaver.com/account'

/**
 * Start a purchase (subscription or one-time lifetime) from inside the app.
 *
 * The app is already signed in, so rather than sending the user to the website
 * (where they'd have to log in again and click "Subscribe" a second time) we
 * exchange their Supabase access token at `/api/checkout` for a Stripe Checkout
 * URL and open that directly — straight to payment. The purchase is synced
 * by the Stripe webhook; the Account page re-verifies on window focus, so the
 * app reflects the new status when the user returns.
 *
 * Any failure falls back to opening the website account page, so the button
 * always does *something* useful.
 *
 * `source` records which CTA the user clicked (gallery lock, upsell banner,
 * account card) so PostHog can break the conversion funnel down by entry point.
 */
export async function startCheckout(source: string, plan: PaidPlan): Promise<void> {
  track('subscribe_clicked', { source, plan })
  try {
    const accessToken = await getAccessToken()
    if (accessToken) {
      const res = await fetch(CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      })
      const data: { url?: string; error?: string } = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        await window.electronAPI.shell.openExternal(data.url)
        return
      }
      log.warn('checkout', 'checkout session not created; falling back to web', {
        status: res.status,
        error: data.error,
      })
    } else {
      log.warn('checkout', 'no access token; falling back to web')
    }
  } catch (err) {
    log.warn('checkout', 'checkout request threw; falling back to web', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
  await window.electronAPI.shell.openExternal(ACCOUNT_URL)
}
