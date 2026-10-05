import { CHECKOUT_ENDPOINT } from './api'
import { getAccessToken } from './supabase'
import { log } from './log'
import { track } from './analytics'
import type { PaidPlan } from '@screensaver-art/constants'

// Opened when a direct checkout isn't possible.
const ACCOUNT_URL = 'https://living-art-screensaver.com/account'

/**
 * Open Stripe checkout directly, using the app's session (`/api/checkout`), so
 * the user never signs in to the website. Any failure opens the website's
 * account page instead. `source` is the button clicked, for analytics.
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
