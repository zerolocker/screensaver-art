import { describe, it, expect } from 'vitest'
import { parseOAuthCallbackUrl } from './oauth'

describe('parseOAuthCallbackUrl', () => {
  it('extracts session tokens from the implicit-flow hash fragment', () => {
    const result = parseOAuthCallbackUrl(
      'livingart://auth-callback#access_token=abc&refresh_token=def&token_type=bearer&expires_in=3600',
    )
    expect(result).toEqual({ tokens: { access_token: 'abc', refresh_token: 'def' } })
  })

  it('surfaces a provider error from the hash (e.g. user cancelled)', () => {
    const result = parseOAuthCallbackUrl(
      'livingart://auth-callback#error=access_denied&error_description=User%20cancelled',
    )
    expect(result).toEqual({ error: 'User cancelled' })
  })

  it('surfaces a provider error from the query string', () => {
    const result = parseOAuthCallbackUrl('livingart://auth-callback?error=server_error')
    expect(result).toEqual({ error: 'server_error' })
  })

  it('errors when the response has no tokens', () => {
    const result = parseOAuthCallbackUrl('livingart://auth-callback#token_type=bearer')
    expect('error' in result).toBe(true)
  })

  it('errors on a malformed url instead of throwing', () => {
    const result = parseOAuthCallbackUrl('not a url')
    expect('error' in result).toBe(true)
  })
})
