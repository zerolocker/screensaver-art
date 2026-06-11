import { describe, it, expect, vi } from 'vitest'

// deeplink.ts imports `app`/`BrowserWindow` from electron and the main logger;
// we don't run inside Electron, so stub both.
vi.mock('electron', () => ({
  app: { setAsDefaultProtocolClient: vi.fn() },
  BrowserWindow: class {},
}))
vi.mock('./logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { extractDeepLinkFromArgv } from './deeplink'

describe('extractDeepLinkFromArgv', () => {
  it('finds a livingart:// url among process argv (Windows/Linux delivery)', () => {
    const argv = ['electron', '.', 'livingart://auth-callback?code=abc123']
    expect(extractDeepLinkFromArgv(argv)).toBe('livingart://auth-callback?code=abc123')
  })

  it('returns null when no deep link is present', () => {
    expect(extractDeepLinkFromArgv(['electron', '.', '--some-flag'])).toBeNull()
  })

  it('ignores other custom schemes', () => {
    expect(extractDeepLinkFromArgv(['electron', 'other://foo'])).toBeNull()
  })
})
