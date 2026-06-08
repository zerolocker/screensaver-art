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

/**
 * Kick off an OAuth sign-in. We never embed the provider's page in an Electron
 * window (Google blocks embedded webviews); instead we open the real system
 * browser and let the result come back via the livingart:// deep link.
 *
 * Returns once the browser has been opened — the actual session is established
 * later in completeOAuthFromUrl when the deep link fires.
 */
export async function startOAuth(provider: OAuthProvider): Promise<{ error?: string }> {
  // `select_account` forces the account chooser so a user already signed into a
  // Google/Microsoft account in their browser can still pick a different one.
  // Apple has a single Apple ID and doesn't take this param, so we omit it.
  const queryParams = provider === 'apple' ? undefined : { prompt: 'select_account' }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo: REDIRECT_URL,
      skipBrowserRedirect: true,
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
