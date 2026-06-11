import { describe, it, expect } from 'vitest'
import { parseOAuthCallbackUrl } from './oauth'

describe('parseOAuthCallbackUrl', () => {
  it('extracts the PKCE code from the callback query string', () => {
    const result = parseOAuthCallbackUrl('livingart://auth-callback?code=abc123')
    expect(result).toEqual({ code: 'abc123' })
  })

  it('surfaces a provider error description (e.g. user cancelled)', () => {
    const result = parseOAuthCallbackUrl(
      'livingart://auth-callback?error=access_denied&error_description=User%20cancelled',
    )
    expect(result).toEqual({ error: 'User cancelled' })
  })

  it('surfaces a bare provider error code', () => {
    const result = parseOAuthCallbackUrl('livingart://auth-callback?error=server_error')
    expect(result).toEqual({ error: 'server_error' })
  })

  it('errors when the response has no code', () => {
    const result = parseOAuthCallbackUrl('livingart://auth-callback?state=xyz')
    expect('error' in result).toBe(true)
  })

  it('errors on a malformed url instead of throwing', () => {
    const result = parseOAuthCallbackUrl('not a url')
    expect('error' in result).toBe(true)
  })
})
