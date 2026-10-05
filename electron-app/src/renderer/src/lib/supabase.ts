import { createClient, type Session } from '@supabase/supabase-js'

// Public anon keys, safe in client code.
const SUPABASE_URL = 'https://fcrkikggdvgshuopshgm.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjcmtpa2dnZHZnc2h1b3BzaGdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTAyNTUsImV4cCI6MjA4OTEyNjI1NX0.ia0iWugP97L0cOX4OTI20vB9C3U1_f4w84Xumjsvc7c'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // PKCE, like the website. See lib/oauth.ts.
    flowType: 'pkce',
  },
})

// supabase-js's default storage key. Never change `storageKey`: it would sign
// everyone out.
const SESSION_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`

/**
 * The stored session, read without refreshing or touching the network: the
 * offline fallback at startup (see App.tsx). Its token may be expired;
 * supabase-js refreshes it once online. Null when signed out.
 */
export function getStoredSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Session> | null
    // The same check supabase-js uses.
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
 * A fresh access token for API calls. Don't use the one in React state: the
 * renderer's throttled timers let it expire, which caused 401s.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
