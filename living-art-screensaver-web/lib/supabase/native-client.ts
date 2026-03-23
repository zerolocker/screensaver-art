import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client authenticated via a Bearer token (for native macOS app requests).
 * Unlike the cookie-based server client, this uses the access_token JWT directly.
 */
export function createNativeClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
