import { PostHog } from 'posthog-node'

/**
 * Server-side PostHog, for webhooks and for events ad blockers mustn't drop.
 * Vercel can freeze a function once it responds, so events send immediately and
 * callers must still flush, ideally with `after(flushPostHog)`.
 */
let posthogClient: PostHog | null = null

export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return posthogClient
}

/** Flush queued events. Call via `after(flushPostHog)` so it runs post-response. */
export async function flushPostHog(): Promise<void> {
  if (posthogClient) await posthogClient.flush()
}
