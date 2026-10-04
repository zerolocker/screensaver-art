import type { Provider } from '@supabase/supabase-js'
import { OAUTH_PROVIDER_OPTIONS, type OAuthProvider } from '@screensaver-art/ui'
import { supabase } from './supabase'
import { log } from './log'

// The provider redirects to this web page, which forwards the PKCE code to the
// livingart://auth-callback deep link. (Redirecting to the deep link directly
// leaves the browser spinning.) It must be in Supabase's redirect URL list.
const REDIRECT_URL = 'https://living-art-screensaver.com/auth/desktop-callback'

// Provider settings are shared with the website (packages/ui/src/oauth.ts).
export type { OAuthProvider }

/**
 * Start OAuth in the system browser (Google blocks embedded webviews). Returns
 * once the browser opens; completeOAuthFromUrl finishes on the deep link.
 */
export async function startOAuth(provider: OAuthProvider): Promise<{ error?: string }> {
  const { scopes, queryParams } = OAUTH_PROVIDER_OPTIONS[provider]

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo: REDIRECT_URL,
      skipBrowserRedirect: true,
      scopes,
      queryParams,
    },
  })
  if (error) return { error: error.message }
  if (!data?.url) return { error: 'Could not start sign-in. Please try again.' }

  log.info('oauth', 'opening provider in system browser', { provider })
  await window.electronAPI.shell.openExternal(data.url)
  return {}
}

/** Parse the deep link: `?code=…` on success, or `?error=…&error_description=…`. */
export function parseOAuthCallbackUrl(url: string): { code: string } | { error: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { error: 'Received a malformed sign-in response. Please try again.' }
  }

  const params = parsed.searchParams
  const providerError = params.get('error_description') || params.get('error')
  if (providerError) return { error: providerError }

  const code = params.get('code')
  if (!code) return { error: 'Sign-in response was missing its code. Please try again.' }
  return { code }
}

/** Exchange the code for a session, which emits SIGNED_IN. */
export async function completeOAuthFromUrl(url: string): Promise<{ error?: string }> {
  const result = parseOAuthCallbackUrl(url)
  if ('error' in result) {
    log.warn('oauth', 'callback could not be completed', { error: result.error })
    return { error: result.error }
  }
  const { error } = await supabase.auth.exchangeCodeForSession(result.code)
  if (error) return { error: error.message }
  return {}
}
