import type { Provider } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { log } from './log'

// Must exactly match an entry in Supabase Auth → URL Configuration → Redirect URLs.
const REDIRECT_URL = 'livingart://auth-callback'

export type OAuthProvider = 'apple' | 'google' | 'azure'

export const OAUTH_PROVIDER_LABELS: Record<OAuthProvider, string> = {
  apple: 'Apple',
  google: 'Google',
  azure: 'Microsoft',
}

// Per-provider OAuth options, following Supabase's social-login guides:
//
// - Azure (Microsoft): the `email` scope is REQUIRED. Supabase Auth needs a
//   valid email back from Azure and rejects the sign-in otherwise, which is why
//   Microsoft login was failing. `offline_access` additionally yields a provider
//   refresh token. https://supabase.com/docs/guides/auth/social-login/auth-azure
//
// - Apple: takes no extra scopes or query params here (the scopes are configured
//   on Supabase's side, and Apple doesn't support a `prompt` param). Passing one
//   would error. https://supabase.com/docs/guides/auth/social-login/auth-apple
//
// - Google: `prompt: select_account` shows the account chooser so a user already
//   signed into Google in their browser can pick a different account. We do NOT
//   request `access_type: offline` / `prompt: consent` (which the docs suggest
//   only when you need the *provider* refresh token to call Google APIs) — we
//   never call Google on the user's behalf, and Supabase issues its own session
//   refresh token regardless. https://supabase.com/docs/guides/auth/social-login/auth-google
const PROVIDER_OPTIONS: Record<
  OAuthProvider,
  { scopes?: string; queryParams?: Record<string, string> }
> = {
  apple: {},
  google: { queryParams: { prompt: 'select_account' } },
  azure: { scopes: 'email offline_access', queryParams: { prompt: 'select_account' } },
}

/**
 * Kick off an OAuth sign-in. We never embed the provider's page in an Electron
 * window (Google blocks embedded webviews); instead we open the real system
 * browser and let the result come back via the livingart:// deep link.
 *
 * Returns once the browser has been opened — the actual session is established
 * later in completeOAuthFromUrl when the deep link fires.
 */
export async function startOAuth(provider: OAuthProvider): Promise<{ error?: string }> {
  const { scopes, queryParams } = PROVIDER_OPTIONS[provider]

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
 * Pure parser for the OAuth deep-link callback. The implicit flow returns the
 * session tokens in the URL hash fragment; provider errors can land in either
 * the hash or the query string. Extracted (no supabase dependency) so it can be
 * unit-tested.
 */
export function parseOAuthCallbackUrl(
  url: string,
): { tokens: { access_token: string; refresh_token: string } } | { error: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { error: 'Received a malformed sign-in response. Please try again.' }
  }

  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const providerError =
    hash.get('error_description') ||
    hash.get('error') ||
    parsed.searchParams.get('error_description') ||
    parsed.searchParams.get('error')
  if (providerError) return { error: providerError }

  const access_token = hash.get('access_token')
  const refresh_token = hash.get('refresh_token')
  if (!access_token || !refresh_token) {
    return { error: 'Sign-in response was missing tokens. Please try again.' }
  }
  return { tokens: { access_token, refresh_token } }
}

/**
 * Complete the sign-in from the deep-link callback URL. Hands the parsed tokens
 * to supabase.setSession, which then emits SIGNED_IN (navigating to the gallery).
 */
export async function completeOAuthFromUrl(url: string): Promise<{ error?: string }> {
  const result = parseOAuthCallbackUrl(url)
  if ('error' in result) {
    log.warn('oauth', 'callback could not be completed', { error: result.error })
    return { error: result.error }
  }
  const { error } = await supabase.auth.setSession(result.tokens)
  if (error) return { error: error.message }
  return {}
}
