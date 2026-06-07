import { createClient } from '@supabase/supabase-js'

// These are public anon keys — safe to include in client code
const SUPABASE_URL = 'https://fcrkikggdvgshuopshgm.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjcmtpa2dnZHZnc2h1b3BzaGdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTAyNTUsImV4cCI6MjA4OTEyNjI1NX0.ia0iWugP97L0cOX4OTI20vB9C3U1_f4w84Xumjsvc7c'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Electron stores session in localStorage (Chromium provides this)
    persistSession: true,
    autoRefreshToken: true,
  },
})

/**
 * Returns a guaranteed-fresh access token for native API calls (gallery,
 * subscription verify, error reports).
 *
 * Why not just use `session.access_token` from React state? In Electron the
 * renderer's background timers get throttled, so supabase-js's auto-refresh can
 * lag behind the 1-hour token expiry — leaving a stale (expired) token in the
 * component prop. Hitting `/api/*` with that token returns 401, which surfaced
 * as "Unauthorized" on the error-report button and as a silently-stuck
 * subscription status. `getSession()` transparently refreshes an expired token
 * before returning it, closing that gap.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
