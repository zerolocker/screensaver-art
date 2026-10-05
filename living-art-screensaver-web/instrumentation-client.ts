import posthog from 'posthog-js'

// The website's only posthog-js init; don't initialise it anywhere else.
// Events go through our own origin (`/ingest`, see next.config.mjs) so ad
// blockers don't drop them. Inputs aren't masked in session replays (only an
// email is entered); PostHog always masks passwords.
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
