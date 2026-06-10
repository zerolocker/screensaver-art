import { createClient, type Session } from '@supabase/supabase-js'

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

// supabase-js persists the session at this localStorage key. We recompute its
// default (`sb-<project-ref>-auth-token`) rather than hardcoding it, and never
// override `storageKey` — changing it would orphan already-signed-in users.
const SESSION_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`

/**
 * The last session supabase-js wrote to storage, read directly — no refresh, no
 * network. Use this as an offline fallback for the *initial* auth decision:
 * getSession() refreshes an expired access token and, when offline, retries for
 * ~25s before giving up, which would otherwise hang startup. The stored session
 * is enough to keep the user signed in for everything that doesn't need the
 * network (browse the cached gallery, set the screensaver, view the account).
 * Its access token may be expired; supabase-js auto-refreshes it (emitting
 * TOKEN_REFRESHED) once connectivity returns.
 *
 * Returns null when nothing valid is stored — i.e. the user is genuinely signed
 * out, or supabase-js cleared a revoked session. Falls back safely (null) if the
 * stored shape ever changes.
 */
export function getStoredSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Session> | null
    // The same shape check supabase-js uses to consider a stored session valid.
    if (
      parsed &&
      typeof parsed === 'object' &&
      'access_token' in parsed &&
      'refresh_token' in parsed &&
      'expires_at' in parsed
    ) {
      return parsed as Session
    }
    return null
  } catch {
    return null
  }
}

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
