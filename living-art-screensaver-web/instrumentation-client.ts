import posthog from 'posthog-js'

// A Supabase invite / magic-link redirect appends the session tokens to the URL
// fragment (#access_token=…). We land these on the marketing home page (the
// "email me a download link" flow → `/?src=email-download`), so strip the token
// fragment before analytics initialise — otherwise it would ride along in a
// PostHog pageview URL and session replay, and linger in browser history. The
// site's own auth is PKCE (`?code=` at /auth/callback), so this only ever
// matches these email-link redirects and never consumes a real session.
if (typeof window !== 'undefined') {
  const hash = window.location.hash
  if (hash && /\b(?:access_token|refresh_token|error_code)=/.test(hash)) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}

// Client-side PostHog init for the marketing + account site. Next.js 15.3+ runs
// this file automatically on the client before hydration — it is the canonical
// place to initialise posthog-js.
//
// `api_host: '/ingest'` routes events through our own origin (see the rewrites
// in next.config.mjs) so ad/tracker blockers don't drop them. `defaults` opts
// into PostHog's current default behaviour (autocapture + SPA pageviews +
// pageleave), so we don't hand-wire pageview tracking.
//
// IMPORTANT: do NOT also initialise posthog-js elsewhere (e.g. a PostHogProvider
// component). instrumentation-client.ts is the single client init for Next.js.
//
// Session replay is enabled at the PostHog project level (and proxied through
// `/ingest/s/` like every other event). This app has minimal privacy surface
// (no real PII beyond an email), so we opt OUT of the default input masking
// (`maskAllInputs: false`) to get fully legible replays — e.g. the login email
// field. Passwords are still always masked by PostHog regardless of this flag.
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: '/ingest',
  ui_host: 'https://us.posthog.com',
  defaults: '2026-01-30',
  capture_exceptions: true,
  debug: process.env.NODE_ENV === 'development',
  session_recording: {
    maskAllInputs: false,
  },
})
