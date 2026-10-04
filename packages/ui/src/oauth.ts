// OAuth provider settings shared by the app and the website. Only the redirect
// differs: the app returns through a deep link, the website through /auth/callback.

export type OAuthProvider = 'apple' | 'google' | 'azure'

export const OAUTH_PROVIDERS: OAuthProvider[] = ['apple', 'google', 'azure']

export const OAUTH_PROVIDER_LABELS: Record<OAuthProvider, string> = {
  apple: 'Apple',
  google: 'Google',
  azure: 'Microsoft',
}

// Per-provider options, following Supabase's social-login guides:
//
// - Azure (Microsoft): the `email` scope is required, or Supabase rejects the
//   sign-in. `offline_access` adds a provider refresh token.
//   https://supabase.com/docs/guides/auth/social-login/auth-azure
//
// - Apple: nothing extra; a `prompt` param causes an error.
//   https://supabase.com/docs/guides/auth/social-login/auth-apple
//
// - Google: `prompt: select_account` shows the account chooser. No offline
//   access: we never call Google APIs for the user.
//   https://supabase.com/docs/guides/auth/social-login/auth-google
export const OAUTH_PROVIDER_OPTIONS: Record<
  OAuthProvider,
  { scopes?: string; queryParams?: Record<string, string> }
> = {
  apple: {},
  google: { queryParams: { prompt: 'select_account' } },
  azure: { scopes: 'email offline_access', queryParams: { prompt: 'select_account' } },
}
