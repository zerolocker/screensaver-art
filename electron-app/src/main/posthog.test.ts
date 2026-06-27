import { describe, it, expect, beforeEach, vi } from 'vitest'

// posthog.ts persists the device id under app.getPath('userData'); point that at
// a throwaway temp dir so the test never touches real userData.
const USERDATA = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os') as typeof import('os')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path')
  return fs.mkdtempSync(path.join(os.tmpdir(), 'posthog-test-'))
})

vi.mock('electron', () => ({ app: { getPath: () => USERDATA } }))

// Capture the calls the posthog-node client would make. Hoisted so they exist
// before the (also-hoisted) vi.mock factory instantiates PostHog at import time.
const { identify, alias, capture } = vi.hoisted(() => ({
  identify: vi.fn(),
  alias: vi.fn(),
  capture: vi.fn(),
}))
vi.mock('posthog-node', () => ({
  PostHog: class {
    identify = identify
    alias = alias
    capture = capture
    shutdown = vi.fn(async () => {})
  },
}))

vi.mock('./logger', () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import {
  identifyUser,
  resetIdentity,
  currentDistinctId,
  getDeviceId,
  userIdFromToken,
  emailFromToken,
} from './posthog'

// Build a (signature-less) JWT whose payload carries the given claims.
function token(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`
}

beforeEach(() => {
  vi.clearAllMocks()
  resetIdentity() // start each test with no signed-in user + a fresh device id
})

describe('identifyUser', () => {
  it('labels the PostHog person with the email and aliases the device id', () => {
    identifyUser('user-1', 'a@example.com')
    expect(identify).toHaveBeenCalledWith({
      distinctId: 'user-1',
      properties: { email: 'a@example.com' },
    })
    expect(alias).toHaveBeenCalledTimes(1)
    expect(currentDistinctId()).toBe('user-1')
  })

  it('is idempotent within a run (no duplicate identify for the same user)', () => {
    identifyUser('user-1', 'a@example.com')
    identifyUser('user-1', 'a@example.com')
    expect(identify).toHaveBeenCalledTimes(1)
  })

  it('omits person properties when no email is available', () => {
    identifyUser('user-2')
    expect(identify).toHaveBeenCalledWith({ distinctId: 'user-2', properties: undefined })
  })
})

describe('resetIdentity', () => {
  it('drops the signed-in user and mints a fresh device id', () => {
    identifyUser('user-1', 'a@example.com')
    const dev1 = getDeviceId()
    resetIdentity()
    expect(currentDistinctId()).toBe(getDeviceId()) // back to anonymous device id
    expect(getDeviceId()).not.toBe(dev1)
  })

  it('lets a second account alias its own fresh device id (not the first user’s)', () => {
    identifyUser('user-1', 'a@example.com')
    resetIdentity()
    const dev2 = getDeviceId()
    alias.mockClear()
    identifyUser('user-2', 'c@example.com')
    expect(alias).toHaveBeenCalledWith({ distinctId: 'user-2', alias: dev2 })
  })
})

describe('token claim decoding', () => {
  it('extracts the user id and email', () => {
    const t = token({ sub: 'user-9', email: 'who@example.com' })
    expect(userIdFromToken(t)).toBe('user-9')
    expect(emailFromToken(t)).toBe('who@example.com')
  })

  it('returns null for missing/garbage tokens', () => {
    expect(userIdFromToken(null)).toBeNull()
    expect(emailFromToken(undefined)).toBeNull()
    expect(userIdFromToken('not-a-jwt')).toBeNull()
    expect(emailFromToken(token({ sub: 'only-id' }))).toBeNull()
  })
})
