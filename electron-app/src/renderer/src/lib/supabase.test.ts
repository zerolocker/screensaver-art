import { describe, it, expect, beforeEach } from 'vitest'
import { getStoredSession } from './supabase'

// supabase-js persists the session under `sb-<project-ref>-auth-token`. This is
// the key derived from the SUPABASE_URL in supabase.ts; getStoredSession must
// read exactly this one (a wrong key would silently look "signed out").
const STORAGE_KEY = 'sb-fcrkikggdvgshuopshgm-auth-token'

const validSession = {
  access_token: 'access',
  refresh_token: 'refresh',
  expires_at: 9999999999,
  token_type: 'bearer',
  user: { id: 'u1', email: 'a@b.com' },
}

describe('getStoredSession', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns null when nothing is stored (signed out)', () => {
    expect(getStoredSession()).toBeNull()
  })

  it('reads the persisted session from the supabase storage key (no network)', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validSession))
    expect(getStoredSession()).toEqual(validSession)
  })

  it('returns null when a session is stored under a different key', () => {
    window.localStorage.setItem('sb-other-project-auth-token', JSON.stringify(validSession))
    expect(getStoredSession()).toBeNull()
  })

  it('returns null on malformed JSON instead of throwing', () => {
    window.localStorage.setItem(STORAGE_KEY, '{ not valid json')
    expect(getStoredSession()).toBeNull()
  })

  it('returns null when the stored object is missing session fields', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ access_token: 'only' }))
    expect(getStoredSession()).toBeNull()
  })
})
