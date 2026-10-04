import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// /api/gallery returns every piece plus `isSubscribed`; gating is client-side.
// verifyNativeAuth and the GitHub fetch are mocked. Covered:
//   - everyone gets the whole list
//   - isSubscribed reflects the auth result
//   - a missing Authorization header never 401s (returns the list as a guest)
//   - the playlist is read from the repo ref, token-authed (never a public URL)
//   - a missing GITHUB_RELEASE_TOKEN surfaces as 500, never a public fallback
//   - upstream fetch failure surfaces as 502
//   - the response shape is exactly { isSubscribed, items }

// Hoisted so the vi.mock factory can share it.
const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}))

vi.mock('@/lib/auth/verify-native-auth', () => ({
  verifyNativeAuth: authMock,
}))

import { GET } from '../route'
import { FREE_ITEM_COUNT } from '@screensaver-art/constants'

const FAKE_GALLERY = [
  { src: 'https://r2/a.mp4', title: 'A', type: 'video' },
  { src: 'https://r2/b.mp4', title: 'B', type: 'video' },
  { src: 'https://r2/c.mp4', title: 'C', type: 'video' },
  { src: 'https://r2/d.mp4', title: 'D', type: 'video' },
  { src: 'https://r2/e.mp4', title: 'E', type: 'video' },
]

// The route reads gallery.json as raw text off the Contents API, then parses it.
function makeFetchOk(body: unknown): Response {
  return { ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) } as unknown as Response
}
function makeFetchFail(status = 500): Response {
  return { ok: false, status, text: () => Promise.resolve('') } as unknown as Response
}

function makeReq(query = ''): NextRequest {
  const url = `https://example.com/api/gallery${query}`
  return new NextRequest(url)
}

describe('GET /api/gallery', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(makeFetchOk(FAKE_GALLERY))
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubEnv('GITHUB_RELEASE_TOKEN', 'test-token')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    authMock.mockReset()
  })

  describe('full gallery (no server-side gating)', () => {
    it('non-subscriber gets the whole gallery (gating is client-side now)', async () => {
      // More items than the free count: all come back anyway.
      const bigGallery = Array.from({ length: FREE_ITEM_COUNT + 50 }, (_, n) => ({
        src: `https://r2/big-${n}.mp4`,
        title: `Big ${n}`,
        type: 'video',
      }))
      fetchSpy.mockResolvedValue(makeFetchOk(bigGallery))
      authMock.mockResolvedValue({ user: null, isSubscribed: false, subscription: null })

      const res = await GET(makeReq())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.isSubscribed).toBe(false)
      expect(body.items).toHaveLength(FREE_ITEM_COUNT + 50)
    })

    it('subscriber also gets the whole gallery', async () => {
      authMock.mockResolvedValue({
        user: { id: 'u1' },
        isSubscribed: true,
        subscription: { status: 'active' },
      })

      const res = await GET(makeReq())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.isSubscribed).toBe(true)
      expect(body.items).toHaveLength(FAKE_GALLERY.length)
    })

    it('treats requests with no Authorization header as non-subscribers (never 401s)', async () => {
      // verifyNativeAuth returns the unauthenticated default.
      authMock.mockResolvedValue({ user: null, isSubscribed: false, subscription: null })

      const res = await GET(makeReq())

      // Never 401, or the app has nothing to play during onboarding.
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.isSubscribed).toBe(false)
      expect(body.items).toHaveLength(FAKE_GALLERY.length)
    })
  })

  describe('playlist source (private-repo safe)', () => {
    it('reads gallery.json off the repo ref through the token, not a public URL', async () => {
      authMock.mockResolvedValue({ user: null, isSubscribed: false, subscription: null })

      await GET(makeReq())

      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toBe(
        'https://api.github.com/repos/zerolocker/screensaver-art/contents/gallery.json?ref=master',
      )
      // Token-authed (works on a private repo), raw (no 1 MB limit).
      expect(init.headers.Authorization).toBe('Bearer test-token')
      expect(init.headers.Accept).toBe('application/vnd.github.raw')
      // Never the public GitHub Pages copy.
      expect(url).not.toContain('github.io')
    })

    it('returns 500 when GITHUB_RELEASE_TOKEN is missing (never a public fallback)', async () => {
      vi.stubEnv('GITHUB_RELEASE_TOKEN', '')
      authMock.mockResolvedValue({ user: null, isSubscribed: false, subscription: null })

      const res = await GET(makeReq())

      expect(res.status).toBe(500)
      // Fail loudly rather than serve a stale or public playlist.
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('upstream errors', () => {
    it('returns 502 when the gallery fetch fails', async () => {
      fetchSpy.mockResolvedValue(makeFetchFail(500))
      authMock.mockResolvedValue({ user: null, isSubscribed: false, subscription: null })
      const res = await GET(makeReq())
      expect(res.status).toBe(502)
      const body = await res.json()
      expect(body.error).toMatch(/Failed to load gallery/)
    })

    it('returns 502 when the gallery fetch throws (e.g. network down)', async () => {
      fetchSpy.mockRejectedValue(new Error('network'))
      authMock.mockResolvedValue({ user: null, isSubscribed: false, subscription: null })
      const res = await GET(makeReq())
      expect(res.status).toBe(502)
    })
  })

  describe('response shape', () => {
    it('always includes exactly items and isSubscribed', async () => {
      authMock.mockResolvedValue({ user: null, isSubscribed: false, subscription: null })
      const body = await (await GET(makeReq())).json()
      expect(Object.keys(body).sort()).toEqual(['isSubscribed', 'items'].sort())
    })
  })
})
