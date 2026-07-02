'use client'

import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'
import { detectIsMac } from '@/lib/device'

/**
 * Handles arrivals from the "email me a download link" flow. The email link
 * (sent by /api/download-link) points at `/?src=email-download`, so a visitor
 * landing here with that param is the click we count: `download_email_link_clicked`.
 * On a Mac we also start the DMG; the home page's own Download CTA is the manual
 * fallback. Renders nothing.
 *
 * (The Supabase auth-token fragment that rides along is already stripped in
 * instrumentation-client.ts before analytics load.)
 */
export function EmailArrivalTracker() {
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('src') !== 'email-download') return
    handled.current = true

    posthog.capture('download_email_link_clicked')

    if (detectIsMac()) {
      // Hidden iframe so an error response can't replace the page.
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = '/download/mac'
      document.body.appendChild(iframe)
    }

    // Drop our tracking param so the URL is clean and a refresh won't re-trigger.
    params.delete('src')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
  }, [])

  return null
}
