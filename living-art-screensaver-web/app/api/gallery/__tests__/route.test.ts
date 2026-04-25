import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// /api/gallery is the load-bearing security boundary: it's where the
// "subscriber → full gallery / non-subscriber → first 2 items" gating happens.
// These tests mock both verifyNativeAuth (the auth check) and the upstream
// GitHub Pages fetch (the playlist source). They cover:
//   - non-subscribers get exactly FREE_ITEM_COUNT items
//   - subscribers get the full collection-filtered list
//   - collection filtering with `?collection=` query param
//   - items without a `collection` field default to "classic"
//   - upstream fetch failure surfaces as 502
//   - the totalCount field reflects the unsliced collection size

// Hoisted state lets the vi.mock factory share refs with the test scope.
const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}))

vi.mock('@/lib/auth/verify-native-auth', () => ({
  verifyNativeAuth: authMock,
}))

import { GET } from '../route'

// Sample fixture — mixes collections so we can verify filtering
const FAKE_GALLERY = [
  { src: 'https://r2/a.mp4', title: 'A', type: 'video', collection: 'classic' },
  { src: 'https://r2/b.mp4', title: 'B', type: 'video', collection: 'classic' },
  { src: 'https://r2/c.mp4', title: 'C', type: 'video', collection: 'classic' },
  { src: 'https://r2/d.mp4', title: 'D', type: 'video', collection: 'classic' },
  { src: 'https://r2/e.mp4', title: 'E', type: 'video', collection: 'modern' },
  // No collection field — should fall through to "classic"
  { src: 'https://r2/legacy.mp4', title: 'Legacy', type: 'video' },
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

  describe('subscription gating', () => {
    it('non-subscriber gets exactly the first 2 items of the collection', async () => {
      authMock.mockResolvedValue({ user: null, isSubscribed: false, subscription: null })
      const res = await GET(makeReq('?collection=classic'))
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.isSubscribed).toBe(false)
      expect(body.items).toHaveLength(2)
      expect(body.items.map((i: { title: string }) => i.title)).toEqual(['A', 'B'])
      // totalCount reflects the FULL collection so the client can show "X of Y" upsell copy
      expect(body.totalCount).toBe(5) // 4 explicit "classic" + 1 unlabeled (defaults to classic)
    })

    it('subscriber gets the full collection-filtered list', async () => {
      authMock.mockResolvedValue({
        user: { id: 'u1' },
        isSubscribed: true,
        subscription: { status: 'active' },
      })
      const res = await GET(makeReq('?collection=classic'))
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.isSubscribed).toBe(true)
      expect(body.items).toHaveLength(5)
      expect(body.totalCount).toBe(5)
    })

    it('treats requests with no Authorization header as non-subscribers (never 401s)', async () => {
      // verifyNativeAuth returns the unauthenticated default
      authMock.mockResolvedValue({ user: null, isSubscribed: false, subscription: null })
      const res = await GET(makeReq())
      // Critical: must NOT return 401, otherwise the screensaver/Electron
      // app would have nothing to play during onboarding
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.items).toHaveLength(2)
    })
  })

  describe('collection filtering', () => {
    it('filters by collection when ?collection is present', async () => {
      authMock.mockResolvedValue({ user: { id: 'u' }, isSubscribed: true, subscription: null })
      const res = await GET(makeReq('?collection=modern'))
      const body = await res.json()
      expect(body.items.map((i: { title: string }) => i.title)).toEqual(['E'])
      expect(body.totalCount).toBe(1)
    })

    it('items without a `collection` field default to "classic"', async () => {
      authMock.mockResolvedValue({ user: { id: 'u' }, isSubscribed: true, subscription: null })
      const res = await GET(makeReq('?collection=classic'))
      const body = await res.json()
      const titles = body.items.map((i: { title: string }) => i.title)
      expect(titles).toContain('Legacy')
    })

    it('returns ALL items when no ?collection is provided', async () => {
      authMock.mockResolvedValue({ user: { id: 'u' }, isSubscribed: true, subscription: null })
      const res = await GET(makeReq())
      const body = await res.json()
      expect(body.items).toHaveLength(FAKE_GALLERY.length)
    })

    it('returns an empty list for an unknown collection', async () => {
      authMock.mockResolvedValue({ user: { id: 'u' }, isSubscribed: true, subscription: null })
      const res = await GET(makeReq('?collection=does-not-exist'))
      const body = await res.json()
      expect(body.items).toHaveLength(0)
      expect(body.totalCount).toBe(0)
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
    it('always includes items, isSubscribed, and totalCount', async () => {
      authMock.mockResolvedValue({ user: null, isSubscribed: false, subscription: null })
      const body = await (await GET(makeReq('?collection=classic'))).json()
      expect(Object.keys(body).sort()).toEqual(['isSubscribed', 'items', 'totalCount'].sort())
    })
  })
})
