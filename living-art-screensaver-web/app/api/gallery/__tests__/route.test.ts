import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// /api/gallery returns the FULL gallery to everyone now — gating moved to the
// client (it locks pieces beyond `freeCount` for non-subscribers and never
// caches them). So this route's job is narrow: fetch the playlist, resolve the
// subscription, and hand back { items, isSubscribed, freeCount }. These tests
// mock both verifyNativeAuth (the auth check) and the upstream GitHub Pages
// fetch (the playlist source). They cover:
//   - subscribers and non-subscribers both get the whole list (no slice)
//   - isSubscribed reflects the auth result
//   - freeCount is always the server's FREE_ITEM_COUNT
//   - a missing Authorization header never 401s (returns the list as a guest)
//   - upstream fetch failure surfaces as 502
//   - the response shape is exactly { freeCount, isSubscribed, items }

// Hoisted state lets the vi.mock factory share refs with the test scope.
const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}))

vi.mock('@/lib/auth/verify-native-auth', () => ({
  verifyNativeAuth: authMock,
}))

import { GET, FREE_ITEM_COUNT } from '../route'

const FAKE_GALLERY = [
  { src: 'https://r2/a.mp4', title: 'A', type: 'video' },
  { src: 'https://r2/b.mp4', title: 'B', type: 'video' },
  { src: 'https://r2/c.mp4', title: 'C', type: 'video' },
  { src: 'https://r2/d.mp4', title: 'D', type: 'video' },
  { src: 'https://r2/e.mp4', title: 'E', type: 'video' },
]

function makeFetchOk(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response
}
function makeFetchFail(status = 500): Response {
  return { ok: false, status, json: () => Promise.resolve({}) } as unknown as Response
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
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    authMock.mockReset()
  })

  describe('full gallery (no server-side gating)', () => {
    it('non-subscriber gets the whole gallery (gating is client-side now)', async () => {
      // Build a collection larger than the free count to prove there is NO slice:
      // every item comes back regardless of subscription.
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
      expect(body.freeCount).toBe(FREE_ITEM_COUNT)
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
      expect(body.freeCount).toBe(FREE_ITEM_COUNT)
    })

    it('treats requests with no Authorization header as non-subscribers (never 401s)', async () => {
      // verifyNativeAuth returns the unauthenticated default.
      authMock.mockResolvedValue({ user: null, isSubscribed: false, subscription: null })

      const res = await GET(makeReq())

      // Critical: must NOT return 401, otherwise the screensaver/Electron app
      // would have nothing to play during onboarding.
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.isSubscribed).toBe(false)
      expect(body.items).toHaveLength(FAKE_GALLERY.length)
    })
  })

  describe('upstream errors', () => {
    it('returns 502 when the GitHub Pages gallery fetch fails', async () => {
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
    it('always includes items, isSubscribed, and freeCount', async () => {
      authMock.mockResolvedValue({ user: null, isSubscribed: false, subscription: null })
      const body = await (await GET(makeReq())).json()
      expect(Object.keys(body).sort()).toEqual(['freeCount', 'isSubscribed', 'items'].sort())
    })
  })
})
