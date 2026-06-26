'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

// Client tracker for the public app-initiated checkout return page. This page
// has no website session, but the browser that ran Stripe checkout is the same
// one that opened from the marketing/app link, so posthog-js still has the
// visitor's distinct_id — these events stitch to that person. The authoritative
// "they actually paid" signal is the server-side `subscription_started` webhook
// event; this just captures the funnel's final client step.
export function CheckoutTracker({ status }: { status: string | undefined }) {
  useEffect(() => {
    if (status === 'success') {
      posthog.capture('checkout_completed', { source: 'app_initiated' })
    } else if (status === 'canceled') {
      posthog.capture('checkout_canceled', { source: 'app_initiated' })
    }
  }, [status])

  return null
}
