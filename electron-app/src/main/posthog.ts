// PostHog analytics for the main process. Renderer events arrive over the
// `analytics:capture` IPC, so the whole app shares one identity.

import { PostHog } from 'posthog-node'
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { log } from './logger'

// A public write-only key, safe to ship. Override with LART_POSTHOG_KEY.
const POSTHOG_KEY = process.env.LART_POSTHOG_KEY || 'phc_sQvME5Z2zN2dXSiciUqhkAvDPkq9bu8VahCXPP5NnKKy'
const POSTHOG_HOST = process.env.LART_POSTHOG_HOST || 'https://us.i.posthog.com'

export const posthog = new PostHog(POSTHOG_KEY, {
  host: POSTHOG_HOST,
  // A desktop client, so keep device context.
  isServer: false,
  enableExceptionAutocapture: true,
})

// ── Identity ─────────────────────────────────────────────────────────────────
// Before sign-in, events use a device UUID stored in userData. After sign-in,
// `identify()` links it to the Supabase user id.
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
    /* unreadable: mint a new id */
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
 * Link this device to a signed-in user, once per user per run. `email` labels
 * the person in PostHog.
 */
export function identifyUser(userId: string, email?: string | null): void {
  if (!userId || _currentUserId === userId) {
    _currentUserId = userId || _currentUserId
    return
  }
  _currentUserId = userId
  posthog.identify({ distinctId: userId, properties: email ? { email } : undefined })
  // Merge pre-login events into the user. PostHog aliases are permanent, which
  // is why sign-out mints a new device id (see `resetIdentity`).
  try {
    posthog.alias({ distinctId: userId, alias: getDeviceId() })
  } catch (err) {
    log.warn('posthog', 'alias failed', { error: String(err) })
  }
}

/** On sign-out: forget the user and mint a new device id for the next account. */
export function resetIdentity(): void {
  _currentUserId = null
  _deviceId = randomUUID()
  try {
    writeFileSync(DEVICE_ID_FILE(), JSON.stringify({ id: _deviceId }))
  } catch (err) {
    log.warn('posthog', 'could not persist reset device id', { error: String(err) })
  }
}

// Read a claim from the access token without verifying it; this is only for analytics.
function tokenClaims(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

/** The Supabase user id (`sub`). */
export function userIdFromToken(token: string | null | undefined): string | null {
  const sub = tokenClaims(token)?.sub
  return typeof sub === 'string' ? sub : null
}

/** The user's email. */
export function emailFromToken(token: string | null | undefined): string | null {
  const email = tokenClaims(token)?.email
  return typeof email === 'string' ? email : null
}

/** Capture an event against the current identity (or an explicit distinct id). */
export function capture(event: string, properties?: Record<string, unknown>, distinctId?: string): void {
  posthog.capture({ distinctId: distinctId ?? currentDistinctId(), event, properties })
}

export function shutdownPosthog(): Promise<void> {
  return posthog.shutdown()
}
