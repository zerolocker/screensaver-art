'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { createClient } from '@/lib/supabase/client'

// Keeps PostHog's browser identity in sync with the Supabase session. Only a
// client-side identify() links anonymous browsing to a user, and OAuth sign-in
// and returning visitors would otherwise stay anonymous.
export function PostHogAuthBridge() {
  useEffect(() => {
    const supabase = createClient()

    const identify = (user: { id: string; email?: string }) => {
      // Skip if already identified.
      if (posthog.get_distinct_id() !== user.id) {
        posthog.identify(user.id, { email: user.email })
      }
    }

    // INITIAL_SESSION covers returning visitors and the OAuth landing. On
    // SIGNED_OUT, reset so the next person isn't attributed to this user.
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
