import type { Provider } from '@supabase/supabase-js'
import { OAUTH_PROVIDER_OPTIONS, type OAuthProvider } from '@screensaver-art/ui'
import { supabase } from './supabase'
import { log } from './log'

// OAuth happens in the system browser. We deliberately do NOT redirect straight
// to the livingart:// deep link — the browser would be left spinning on a
// half-finished navigation to a custom scheme even after the app signed in.
// Instead the provider redirects to a web page we control, which forwards the
// PKCE code to the deep link and shows a "you can close this tab" message. That
// page (livingart://auth-callback) is what the main process actually receives.
// This web URL must be listed in Supabase Auth → URL Configuration → Redirect URLs.
const REDIRECT_URL = 'https://living-art-screensaver.com/auth/desktop-callback'

// Provider list, labels, and per-provider scopes/queryParams are shared with the
// website in @screensaver-art/ui (see packages/ui/src/oauth.ts).
export type { OAuthProvider }

/**
 * Kick off an OAuth sign-in. We never embed the provider's page in an Electron
 * window (Google blocks embedded webviews); instead we open the real system
 * browser and let the result come back via the livingart:// deep link.
 *
 * Returns once the browser has been opened — the actual session is established
 * later in completeOAuthFromUrl when the deep link fires.
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

/**
 * Pure parser for the OAuth (PKCE) deep-link callback. Supabase redirects back to
 * livingart://auth-callback?code=… on success, or ?error=…&error_description=… if
 * the provider or user rejected. Both live in the query string under PKCE (no URL
 * hash). Extracted (no supabase dependency) so it can be unit-tested.
 */
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

/**
 * Complete the sign-in from the deep-link callback URL. Exchanges the PKCE code
 * for a session — supabase-js pairs it with the code verifier it stashed when
 * startOAuth ran — which then emits SIGNED_IN (navigating to the gallery). This
 * mirrors the website's /auth/callback route; both use the PKCE flow.
 */
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
