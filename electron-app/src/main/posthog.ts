// PostHog product analytics for the Electron main process.
//
// posthog-node runs in the long-running main process (it batches + flushes on
// its own timer; we flush once more on quit via `shutdownPosthog`). The renderer
// has no PostHog SDK of its own — UI events are forwarded here over the
// `analytics:capture` IPC and captured with the *same* identity, so the desktop
// app is one person in PostHog whether the event originated in main or renderer.

import { PostHog } from 'posthog-node'
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { log } from './logger'

// The PostHog *project* API key is a publishable client key (write-only
// ingestion) — safe to embed in a shipped binary, exactly like the Supabase
// anon key already hardcoded in src/renderer/src/lib/supabase.ts. An env
// override is honored for local dev or a future key rotation.
const POSTHOG_KEY = process.env.LART_POSTHOG_KEY || 'phc_sQvME5Z2zN2dXSiciUqhkAvDPkq9bu8VahCXPP5NnKKy'
const POSTHOG_HOST = process.env.LART_POSTHOG_HOST || 'https://us.i.posthog.com'

export const posthog = new PostHog(POSTHOG_KEY, {
  host: POSTHOG_HOST,
  // This is a desktop client, not a server, so PostHog should treat it as one
  // device/person and not strip device context.
  isServer: false,
  enableExceptionAutocapture: true,
})

// ── Identity ─────────────────────────────────────────────────────────────────
// Anonymous events (e.g. `app_launched` before sign-in) key off a stable device
// UUID stored in userData; once the user signs in we `identify()` to link it to
// their Supabase user id. `_currentUserId` remembers the signed-in id so events
// forwarded from the renderer use the same distinct id without re-decoding a JWT.
const DEVICE_ID_FILE = (): string => join(app.getPath('userData'), 'posthog-device-id.json')

let _deviceId: string | null = null
let _currentUserId: string | null = null

export function getDeviceId(): string {
  if (_deviceId) return _deviceId
  const file = DEVICE_ID_FILE()
  try {
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as { id?: unknown }
      if (typeof parsed.id === 'string') {
        _deviceId = parsed.id
        return _deviceId
      }
    }
  } catch {
    /* unreadable — fall through and mint a fresh id */
  }
  _deviceId = randomUUID()
  try {
    writeFileSync(file, JSON.stringify({ id: _deviceId }))
  } catch (err) {
    log.warn('posthog', 'could not persist device id', { error: String(err) })
  }
  return _deviceId
}

/** The distinct id to attach to events: the signed-in user if known, else the device. */
export function currentDistinctId(): string {
  return _currentUserId ?? getDeviceId()
}

/**
 * Link this device to a signed-in user. Idempotent — only emits an `identify`
 * (and aliases the device id) the first time we see a given user id this run.
 */
export function identifyUser(userId: string): void {
  if (!userId || _currentUserId === userId) {
    _currentUserId = userId || _currentUserId
    return
  }
  _currentUserId = userId
  posthog.identify({ distinctId: userId })
  // Merge the pre-login anonymous device id into the user so their first-launch
  // events aren't stranded on a separate anonymous person.
  try {
    posthog.alias({ distinctId: userId, alias: getDeviceId() })
  } catch (err) {
    log.warn('posthog', 'alias failed', { error: String(err) })
  }
}

// Decodes the Supabase access token's `sub` claim (no signature check — auth is
// verified server-side; we only need the user id for analytics attribution).
export function userIdFromToken(token: string | null | undefined): string | null {
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

/** Capture an event against the current identity (or an explicit distinct id). */
export function capture(event: string, properties?: Record<string, unknown>, distinctId?: string): void {
  posthog.capture({ distinctId: distinctId ?? currentDistinctId(), event, properties })
}

export function shutdownPosthog(): Promise<void> {
  return posthog.shutdown()
}
