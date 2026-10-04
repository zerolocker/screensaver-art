'use client'

import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'
import { detectIsMac } from '@/lib/device'

/**
 * Counts clicks on the emailed download link (`/?src=email-download`) and, on a
 * Mac, starts the download. Renders nothing.
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

    // Drop the param so a refresh doesn't trigger it again.
    params.delete('src')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
  }, [])

  return null
}
