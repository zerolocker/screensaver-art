import { PostHog } from 'posthog-node'

/**
 * Server-side PostHog client (posthog-node) for API routes, server actions and
 * the Stripe webhook — events that must be captured server-side because they
 * happen with no browser in the loop (webhooks) or because they're conversion-
 * critical and shouldn't be droppable by an ad blocker (checkout, downloads).
 *
 * Vercel functions can freeze the moment a response is returned, so a queued
 * event may never be sent. `flushAt: 1` / `flushInterval: 0` makes each capture
 * send immediately, and every caller must still `await flushPostHog()` (ideally
 * inside `after()` from `next/server`) before the function suspends.
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
