import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// cache-sync.ts derives PATHS from os.homedir() at module-load time.
// On POSIX, homedir() reads $HOME, so we redirect HOME into a tmp dir BEFORE
// the import resolves. vi.hoisted runs ahead of all imports so this is safe.
// (vi.mock('os', ...) was tried first — it doesn't propagate into the
// imported cache-sync module under vitest 2.x with vite-node, so we override
// the env var that the un-mocked homedir() actually reads.)
const FAKE_HOME = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os') as typeof import('os')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-sync-test-'))
  process.env.HOME = dir
  process.env.LOCALAPPDATA = dir   // Windows code path uses this instead
  return dir
})

import { syncGallery, clearCache, PATHS, type ApiResponse } from './cache-sync'
import { MAGIC, KEY, filenameForUrl } from './obfuscation'

// ─── Helpers ────────────────────────────────────────────────────────────────

type MockedFetch = ReturnType<typeof vi.fn>

function makeJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

function makeBinaryResponse(bytes: Buffer, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    arrayBuffer: () =>
      Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  } as unknown as Response
}

function fakeApiResponse(
  items: { src: string; title: string; type: string }[],
  opts: Partial<Pick<ApiResponse, 'isSubscribed' | 'totalCount'>> = {},
): ApiResponse {
  return {
    items,
    isSubscribed: opts.isSubscribed ?? true,
    totalCount: opts.totalCount ?? items.length,
  }
}

function decryptCachedFile(path: string): Buffer {
  const blob = readFileSync(path)
  expect(blob.subarray(0, MAGIC.length)).toEqual(MAGIC)
  const body = blob.subarray(MAGIC.length)
  const out = Buffer.alloc(body.length)
  for (let i = 0; i < body.length; i++) out[i] = body[i] ^ KEY[i % KEY.length]
  return out
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('cache-sync', () => {
  let fetchMock: MockedFetch

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await clearCache()
  })

  describe('PATHS', () => {
    it('roots the cache under the (env-overridden) home dir, not the developer machine', () => {
      // Sanity check that HOME redirection actually worked — if this fails,
      // every other test in this file is silently writing to the real
      // ~/Library/Caches/ScreensaverArt and may delete a real user's cache.
      expect(PATHS.CACHE_DIR.startsWith(FAKE_HOME)).toBe(true)
      expect(PATHS.VIDEOS_DIR).toBe(join(PATHS.CACHE_DIR, 'videos'))
      expect(PATHS.MANIFEST_PATH).toBe(join(PATHS.CACHE_DIR, 'gallery.json'))
    })
  })

  describe('syncGallery', () => {
    it('downloads, obfuscates, and writes a manifest', async () => {
      const apiItems = [
        { src: 'https://r2.example/a.mp4', title: 'Aurora', type: 'video' },
        { src: 'https://r2.example/b.mp4', title: 'Bloom', type: 'video' },
      ]
      const videoBytesA = Buffer.from('FAKE_MP4_BYTES_A')
      const videoBytesB = Buffer.from(
        'FAKE_MP4_BYTES_B_LONGER_THAN_KEY_TO_TEST_CYCLING_'.repeat(3),
      )

      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse(fakeApiResponse(apiItems, { isSubscribed: true, totalCount: 2 })),
        )
        .mockResolvedValueOnce(makeBinaryResponse(videoBytesA))
        .mockResolvedValueOnce(makeBinaryResponse(videoBytesB))

      const manifest = await syncGallery('https://api/gallery', 'token-xyz', null)

      expect(manifest.items).toHaveLength(2)
      expect(manifest.items[0]).toEqual({
        filename: filenameForUrl(apiItems[0].src),
        title: 'Aurora',
        type: 'video',
      })
      expect(manifest.isSubscribed).toBe(true)
      expect(manifest.totalCount).toBe(2)
      expect(manifest.syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

      // Files written
      expect(existsSync(join(PATHS.VIDEOS_DIR, manifest.items[0].filename))).toBe(true)
      expect(existsSync(join(PATHS.VIDEOS_DIR, manifest.items[1].filename))).toBe(true)
      expect(existsSync(PATHS.MANIFEST_PATH)).toBe(true)

      // Round-trip: decrypted bytes match what was downloaded
      expect(decryptCachedFile(join(PATHS.VIDEOS_DIR, manifest.items[0].filename))).toEqual(
        videoBytesA,
      )
      expect(decryptCachedFile(join(PATHS.VIDEOS_DIR, manifest.items[1].filename))).toEqual(
        videoBytesB,
      )

      // Manifest on disk matches what was returned
      const onDisk = JSON.parse(readFileSync(PATHS.MANIFEST_PATH, 'utf8'))
      expect(onDisk).toEqual(manifest)
    })

    it('passes the bearer token on the gallery fetch and omits it on the asset downloads', async () => {
      const apiItems = [{ src: 'https://r2.example/a.mp4', title: 'A', type: 'video' }]
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(apiItems)))
        .mockResolvedValueOnce(makeBinaryResponse(Buffer.from('x')))

      await syncGallery('https://api/gallery?collection=classic', 'tok', null)

      const galleryCall = fetchMock.mock.calls[0]
      expect(galleryCall[0]).toBe('https://api/gallery?collection=classic')
      expect(galleryCall[1]).toEqual({ headers: { Authorization: 'Bearer tok' } })

      const assetCall = fetchMock.mock.calls[1]
      expect(assetCall[0]).toBe('https://r2.example/a.mp4')
      // No second arg = no auth on asset fetch (R2 is public; sending the
      // Supabase token there would just leak it)
      expect(assetCall[1]).toBeUndefined()
    })

    it('omits the Authorization header when no token is provided', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse(fakeApiResponse([])))
      await syncGallery('https://api/gallery', null, null)
      expect(fetchMock.mock.calls[0][1]).toEqual({ headers: {} })
    })

    it('throws when the gallery API returns non-OK', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}, false, 502))
      await expect(syncGallery('https://api/gallery', null, null)).rejects.toThrow(/HTTP 502/)
    })

    it('skips re-downloading items that are already cached', async () => {
      const items = [{ src: 'https://r2.example/a.mp4', title: 'A', type: 'video' }]

      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(items)))
        .mockResolvedValueOnce(makeBinaryResponse(Buffer.from('mp4-1')))
      await syncGallery('https://api/gallery', null, null)
      expect(fetchMock).toHaveBeenCalledTimes(2)

      // Second sync: should NOT re-download — only the gallery fetch fires
      fetchMock.mockReset()
      fetchMock.mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(items)))
      await syncGallery('https://api/gallery', null, null)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('removes cached files that are no longer in the gallery (e.g. subscription expired)', async () => {
      const all = [
        { src: 'https://r2.example/a.mp4', title: 'A', type: 'video' },
        { src: 'https://r2.example/b.mp4', title: 'B', type: 'video' },
        { src: 'https://r2.example/c.mp4', title: 'C', type: 'video' },
      ]

      // Sync 1: subscribed, cache all three
      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse(fakeApiResponse(all, { isSubscribed: true, totalCount: 3 })),
        )
        .mockResolvedValueOnce(makeBinaryResponse(Buffer.from('A')))
        .mockResolvedValueOnce(makeBinaryResponse(Buffer.from('B')))
        .mockResolvedValueOnce(makeBinaryResponse(Buffer.from('C')))
      await syncGallery('https://api/gallery', null, null)
      expect(readdirSync(PATHS.VIDEOS_DIR)).toHaveLength(3)

      // Sync 2: subscription expired, only first 2 returned. The third file
      // should be evicted; the first two stay (already cached).
      fetchMock.mockReset()
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(fakeApiResponse(all.slice(0, 2), { isSubscribed: false, totalCount: 3 })),
      )
      const m2 = await syncGallery('https://api/gallery', null, null)

      const remaining = readdirSync(PATHS.VIDEOS_DIR).sort()
      expect(remaining).toHaveLength(2)
      expect(remaining).toEqual([m2.items[0].filename, m2.items[1].filename].sort())
      expect(m2.isSubscribed).toBe(false)
      expect(m2.totalCount).toBe(3)
    })

    it('emits progress events on the BrowserWindow', async () => {
      const items = [
        { src: 'https://r2.example/a.mp4', title: 'A', type: 'video' },
        { src: 'https://r2.example/b.mp4', title: 'B', type: 'video' },
      ]
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(items)))
        .mockResolvedValueOnce(makeBinaryResponse(Buffer.from('a')))
        .mockResolvedValueOnce(makeBinaryResponse(Buffer.from('b')))

      const send = vi.fn()
      const fakeWindow = {
        isDestroyed: () => false,
        webContents: { send },
      } as unknown as Parameters<typeof syncGallery>[2]

      await syncGallery('https://api/gallery', null, fakeWindow)

      const phases = send.mock.calls.map((c) => (c[1] as { phase: string }).phase)
      expect(phases[0]).toBe('fetching-gallery')
      expect(phases.filter((p) => p === 'downloading')).toHaveLength(2)
      expect(phases[phases.length - 1]).toBe('done')
    })

    it('does not emit when the BrowserWindow is destroyed', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse(fakeApiResponse([])))
      const send = vi.fn()
      const destroyed = {
        isDestroyed: () => true,
        webContents: { send },
      } as unknown as Parameters<typeof syncGallery>[2]
      await syncGallery('https://api/gallery', null, destroyed)
      expect(send).not.toHaveBeenCalled()
    })

    it('continues past a single download failure and reports it via progress', async () => {
      const items = [
        { src: 'https://r2.example/a.mp4', title: 'A', type: 'video' },
        { src: 'https://r2.example/b.mp4', title: 'B', type: 'video' },
      ]
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(items)))
        .mockResolvedValueOnce(makeBinaryResponse(Buffer.from(''), false)) // A fails
        .mockResolvedValueOnce(makeBinaryResponse(Buffer.from('b-bytes'))) // B succeeds

      const send = vi.fn()
      const fakeWindow = {
        isDestroyed: () => false,
        webContents: { send },
      } as unknown as Parameters<typeof syncGallery>[2]

      const manifest = await syncGallery('https://api/gallery', null, fakeWindow)

      expect(existsSync(join(PATHS.VIDEOS_DIR, manifest.items[1].filename))).toBe(true)
      expect(existsSync(join(PATHS.VIDEOS_DIR, manifest.items[0].filename))).toBe(false)

      const errorPhase = send.mock.calls.find(
        (c) => (c[1] as { phase: string }).phase === 'error',
      )
      expect(errorPhase).toBeDefined()
    })

    it('skips non-video items (no download attempt)', async () => {
      const items = [
        { src: 'https://r2.example/img.jpg', title: 'Img', type: 'image' },
        { src: 'https://r2.example/v.mp4', title: 'V', type: 'video' },
      ]
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(items)))
        .mockResolvedValueOnce(makeBinaryResponse(Buffer.from('v-bytes')))

      const m = await syncGallery('https://api/gallery', null, null)

      // Both items in the manifest (the screensaver decides what to play)
      expect(m.items).toHaveLength(2)
      // ...but only the video was downloaded — gallery fetch + 1 video = 2 calls
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(existsSync(join(PATHS.VIDEOS_DIR, m.items[1].filename))).toBe(true)
      expect(existsSync(join(PATHS.VIDEOS_DIR, m.items[0].filename))).toBe(false)
    })
  })

  describe('clearCache', () => {
    it('removes all cached videos and the manifest', async () => {
      const items = [{ src: 'https://r2.example/a.mp4', title: 'A', type: 'video' }]
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(items)))
        .mockResolvedValueOnce(makeBinaryResponse(Buffer.from('a')))
      await syncGallery('https://api/gallery', null, null)
      expect(readdirSync(PATHS.VIDEOS_DIR)).not.toHaveLength(0)
      expect(existsSync(PATHS.MANIFEST_PATH)).toBe(true)

      await clearCache()

      expect(readdirSync(PATHS.VIDEOS_DIR)).toHaveLength(0)
      expect(existsSync(PATHS.MANIFEST_PATH)).toBe(false)
    })

    it('is a no-op when nothing is cached', async () => {
      await expect(clearCache()).resolves.toBeUndefined()
    })

    it('survives stale files written outside of syncGallery', async () => {
      writeFileSync(join(PATHS.VIDEOS_DIR, 'orphan.bin'), 'leftover')
      await clearCache()
      expect(readdirSync(PATHS.VIDEOS_DIR)).toHaveLength(0)
    })
  })
})
