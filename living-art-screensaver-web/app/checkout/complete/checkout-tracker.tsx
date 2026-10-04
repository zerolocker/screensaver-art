'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

// Records the return from an app checkout. The webhook's events are the real
// record of payment; this is the funnel's last browser step.
export function CheckoutTracker({ status, plan }: { status: string | undefined; plan: string | undefined }) {
  useEffect(() => {
    if (status === 'success') {
      posthog.capture('checkout_completed', { source: 'app_initiated', plan })
    } else if (status === 'canceled') {
      posthog.capture('checkout_canceled', { source: 'app_initiated', plan })
    }
  }, [status, plan])

  return null
}
