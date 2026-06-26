'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { createClient } from '@/lib/supabase/client'

// Keeps posthog-js's identity in sync with the Supabase session for the whole
// site (mounted once in the root layout).
//
// Why this is needed: posthog-js only associates browser events with a user when
// `identify()` is called *client-side* — that's what merges the prior anonymous
// session into the user. The email-OTP screen does that inline, but OAuth login
// completes on a server route (`/auth/callback`) the browser SDK never sees, and
// a returning visitor starts each session anonymous. Calling identify on
// load + on every sign-in (and reset on sign-out) covers all of those.
export function PostHogAuthBridge() {
  useEffect(() => {
    const supabase = createClient()

    const identify = (user: { id: string; email?: string }) => {
      // identify is idempotent, but skip the no-op call once we're already the user.
      if (posthog.get_distinct_id() !== user.id) {
        posthog.identify(user.id, { email: user.email })
      }
    }

    // INITIAL_SESSION fires on mount with the restored session (covers returning
    // logged-in visitors + the OAuth redirect landing). SIGNED_IN covers fresh
    // logins. SIGNED_OUT unlinks the device so later anonymous browsing — or the
    // next user on a shared machine — isn't attributed to the signed-out user.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
        identify(session.user)
      } else if (event === 'SIGNED_OUT') {
        posthog.reset()
      }
    })

    return () => data.subscription.unsubscribe()
  }, [])

  return null
}
