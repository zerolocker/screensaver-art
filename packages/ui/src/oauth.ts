// Shared OAuth provider config, used by both the Electron app and the website so
// the two stay in lockstep. Only the *mechanism* differs between them (the app
// opens the system browser and returns via a deep link; the website does a normal
// browser redirect + /auth/callback) — the providers, labels, and the scopes /
// query params we request are identical.

export type OAuthProvider = 'apple' | 'google' | 'azure'

export const OAUTH_PROVIDERS: OAuthProvider[] = ['apple', 'google', 'azure']

export const OAUTH_PROVIDER_LABELS: Record<OAuthProvider, string> = {
  apple: 'Apple',
  google: 'Google',
  azure: 'Microsoft',
}

// Per-provider options, following Supabase's social-login guides:
//
// - Azure (Microsoft): the `email` scope is REQUIRED. Supabase Auth needs a
//   valid email back from Azure and rejects the sign-in otherwise (this is why
//   Microsoft login used to fail). `offline_access` additionally yields a
//   provider refresh token. https://supabase.com/docs/guides/auth/social-login/auth-azure
//
// - Apple: takes no extra scopes or query params here (scopes are configured on
//   Supabase's side, and Apple doesn't support a `prompt` param — passing one
//   errors). https://supabase.com/docs/guides/auth/social-login/auth-apple
//
// - Google: `prompt: select_account` shows the account chooser so a user already
//   signed into Google can pick a different account. We do NOT request
//   `access_type: offline` / `prompt: consent` (the docs suggest those only when
//   you need the *provider* refresh token to call Google APIs) — we never call
//   Google on the user's behalf, and Supabase issues its own session refresh
//   token regardless. https://supabase.com/docs/guides/auth/social-login/auth-google
export const OAUTH_PROVIDER_OPTIONS: Record<
  OAuthProvider,
  { scopes?: string; queryParams?: Record<string, string> }
> = {
  apple: {},
  google: { queryParams: { prompt: 'select_account' } },
  azure: { scopes: 'email offline_access', queryParams: { prompt: 'select_account' } },
}
