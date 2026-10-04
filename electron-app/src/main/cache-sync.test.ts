import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// cache-sync.ts computes its paths at import time, so point them at a tmp dir
// before the import (vi.hoisted runs first). vi.mock('os') doesn't reach the
// module under vitest, so set the env vars instead.
const FAKE_HOME = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os') as typeof import('os')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-sync-test-'))
  process.env.HOME = dir
  process.env.LOCALAPPDATA = dir   // Windows code path
  // Never touch the real /Users/Shared cache.
  process.env.LART_CACHE_DIR = path.join(dir, 'LivingArtScreensaver')
  return dir
})

// Importing the real electron module outside Electron throws. logger.ts skips
// file logging without app.getPath, and BrowserWindow is only a type here.
vi.mock('electron', () => ({
  app: {},
  BrowserWindow: class {},
}))

import {
  syncGallery,
  cancelSync,
  isSyncing,
  clearCache,
  PATHS,
  type ApiResponse,
} from './cache-sync'
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

function streamFromBytes(bytes: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes))
      controller.close()
    },
  })
}

// Downloads stream `res.body`, so asset responses expose a web ReadableStream.
function makeStreamResponse(bytes: Buffer, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    body: ok ? streamFromBytes(bytes) : null,
  } as unknown as Response
}

// A body that yields a chunk and then errors, like a dropped connection.
function makeErroringResponse(): Response {
  return {
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3, 4]))
        controller.error(new Error('connection reset'))
      },
    }),
  } as unknown as Response
}

// A body that never produces bytes or closes: a hung download for cancelSync().
function makeHangingResponse(): Response {
  return {
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({ start() {} }),
  } as unknown as Response
}

function fakeApiResponse(
  items: { src: string; title: string; type: string; free?: boolean }[],
  opts: Partial<Pick<ApiResponse, 'isSubscribed'>> = {},
): ApiResponse {
  return {
    // Every item is free unless a test sets `free: false` to test locking.
    items: items.map((it) => ({ ...it, free: it.free ?? true })),
    isSubscribed: opts.isSubscribed ?? true,
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

function fakeWindow(send: ReturnType<typeof vi.fn>): Parameters<typeof syncGallery>[2] {
  return {
    isDestroyed: () => false,
    webContents: { send },
  } as unknown as Parameters<typeof syncGallery>[2]
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('cache-sync', () => {
  let fetchMock: MockedFetch

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    // Don't let an in-flight sync leak into the next test.
    if (isSyncing()) cancelSync()
    vi.unstubAllGlobals()
    await clearCache()
  })

  describe('PATHS', () => {
    it('roots the cache under the (env-overridden) home dir, not the developer machine', () => {
      // If this fails, the other tests are touching a real cache.
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
          makeJsonResponse(fakeApiResponse(apiItems, { isSubscribed: true })),
        )
        .mockResolvedValueOnce(makeStreamResponse(videoBytesA))
        .mockResolvedValueOnce(makeStreamResponse(videoBytesB))

      const manifest = await syncGallery('https://api/gallery', 'token-xyz', null)

      expect(manifest.items).toHaveLength(2)
      expect(manifest.items[0]).toEqual({
        filename: filenameForUrl(apiItems[0].src),
        title: 'Aurora',
        type: 'video',
      })
      expect(manifest.isSubscribed).toBe(true)
      expect(manifest.syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

      // Files written
      expect(existsSync(join(PATHS.VIDEOS_DIR, manifest.items[0].filename))).toBe(true)
      expect(existsSync(join(PATHS.VIDEOS_DIR, manifest.items[1].filename))).toBe(true)
      expect(existsSync(PATHS.MANIFEST_PATH)).toBe(true)

      // Decrypted bytes match the download (chunked XOR == whole-buffer XOR).
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
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('x')))

      await syncGallery('https://api/gallery', 'tok', null)

      const galleryCall = fetchMock.mock.calls[0]
      expect(galleryCall[0]).toBe('https://api/gallery')
      expect(galleryCall[1]).toMatchObject({ headers: { Authorization: 'Bearer tok' } })
      expect(galleryCall[1].signal).toBeInstanceOf(AbortSignal)

      const assetCall = fetchMock.mock.calls[1]
      expect(assetCall[0]).toBe('https://r2.example/a.mp4')
      // No auth header on the R2 fetch; sending the token there would leak it.
      expect(assetCall[1].headers).toBeUndefined()
      expect(assetCall[1].signal).toBeInstanceOf(AbortSignal)
    })

    it('omits the Authorization header when no token is provided', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse(fakeApiResponse([])))
      await syncGallery('https://api/gallery', null, null)
      expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: {} })
    })

    it('throws when the gallery API returns non-OK', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}, false, 502))
      await expect(syncGallery('https://api/gallery', null, null)).rejects.toThrow(/HTTP 502/)
    })

    it('skips re-downloading items that are already cached', async () => {
      const items = [{ src: 'https://r2.example/a.mp4', title: 'A', type: 'video' }]

      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(items)))
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('mp4-1')))
      await syncGallery('https://api/gallery', null, null)
      expect(fetchMock).toHaveBeenCalledTimes(2)

      // Second sync: should NOT re-download — only the gallery fetch fires
      fetchMock.mockReset()
      fetchMock.mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(items)))
      await syncGallery('https://api/gallery', null, null)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('writes the manifest BEFORE downloading any videos so the screensaver can pick up the new list mid-sync', async () => {
      // The manifest must be on disk before the first download starts.
      const items = [
        { src: 'https://r2.example/a.mp4', title: 'A', type: 'video' },
        { src: 'https://r2.example/b.mp4', title: 'B', type: 'video' },
      ]
      let manifestAtFirstDownload: { items: { filename: string }[] } | null = null

      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(items)))
        .mockImplementationOnce(async () => {
          manifestAtFirstDownload = JSON.parse(readFileSync(PATHS.MANIFEST_PATH, 'utf8'))
          return makeStreamResponse(Buffer.from('a'))
        })
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('b')))

      await syncGallery('https://api/gallery', null, null)

      expect(manifestAtFirstDownload).not.toBeNull()
      expect(manifestAtFirstDownload!.items).toHaveLength(2)
      expect(manifestAtFirstDownload!.items.map((i) => i.filename).sort()).toEqual(
        items.map((i) => filenameForUrl(i.src)).sort(),
      )
    })

    it('writes the manifest atomically (no partial JSON readable mid-write)', async () => {
      // Temp file + rename: the screensaver never sees a half-written manifest.
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse([])))
      await syncGallery('https://api/gallery', null, null)

      // Atomic write should leave no .tmp sibling behind on success
      const dirContents = readdirSync(PATHS.CACHE_DIR)
      expect(dirContents).toContain('gallery.json')
      expect(dirContents).not.toContain('gallery.json.tmp')
    })

    it('writes each video via a temp file and leaves no .tmp behind on success', async () => {
      // Downloads go to <hash>.bin.tmp and are renamed into place, leaving no temp file.
      const items = [{ src: 'https://r2.example/a.mp4', title: 'A', type: 'video' }]
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(items)))
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('mp4-bytes')))

      await syncGallery('https://api/gallery', null, null)

      const names = readdirSync(PATHS.VIDEOS_DIR)
      expect(names).toContain(filenameForUrl(items[0].src))
      expect(names.some((n) => n.endsWith('.tmp'))).toBe(false)
    })

    it('leaves neither a .bin nor a .tmp when a download dies mid-stream', async () => {
      // An interrupted download leaves neither a truncated .bin nor a .tmp.
      const items = [{ src: 'https://r2.example/a.mp4', title: 'A', type: 'video' }]
      fetchMock.mockImplementation((url: string) => {
        if (url === 'https://api/gallery')
          return Promise.resolve(makeJsonResponse(fakeApiResponse(items)))
        return Promise.resolve(makeErroringResponse()) // errors on every attempt
      })

      await syncGallery('https://api/gallery', null, null)

      const dest = join(PATHS.VIDEOS_DIR, filenameForUrl(items[0].src))
      expect(existsSync(dest)).toBe(false)
      expect(existsSync(dest + '.tmp')).toBe(false)
      expect(readdirSync(PATHS.VIDEOS_DIR).some((n) => n.endsWith('.tmp'))).toBe(false)
    })

    it('sweeps a stale .tmp left by a previously-interrupted sync', async () => {
      // A leftover temp file from a killed run is removed by the next sync.
      fetchMock.mockResolvedValueOnce(makeJsonResponse(fakeApiResponse([])))
      await syncGallery('https://api/gallery', null, null)

      const stale = join(PATHS.VIDEOS_DIR, 'deadbeefdeadbeef.bin.tmp')
      writeFileSync(stale, 'partial leftover')
      expect(existsSync(stale)).toBe(true)

      fetchMock.mockReset()
      fetchMock.mockResolvedValueOnce(makeJsonResponse(fakeApiResponse([])))
      await syncGallery('https://api/gallery', null, null)

      expect(existsSync(stale)).toBe(false)
    })

    it('retries a transient download failure and then succeeds', async () => {
      const items = [{ src: 'https://r2.example/a.mp4', title: 'A', type: 'video' }]
      let attempts = 0
      fetchMock.mockImplementation((url: string) => {
        if (url === 'https://api/gallery')
          return Promise.resolve(makeJsonResponse(fakeApiResponse(items)))
        attempts++
        if (attempts === 1) return Promise.resolve(makeStreamResponse(Buffer.alloc(0), false))
        return Promise.resolve(makeStreamResponse(Buffer.from('a-bytes')))
      })

      const manifest = await syncGallery('https://api/gallery', null, null)

      expect(attempts).toBeGreaterThanOrEqual(2)
      expect(existsSync(join(PATHS.VIDEOS_DIR, manifest.items[0].filename))).toBe(true)
      expect(decryptCachedFile(join(PATHS.VIDEOS_DIR, manifest.items[0].filename))).toEqual(
        Buffer.from('a-bytes'),
      )
    })

    it('dedupes concurrent syncs — a second call joins the in-flight run', async () => {
      const items = [{ src: 'https://r2.example/a.mp4', title: 'A', type: 'video' }]
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(items)))
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('a')))

      const p1 = syncGallery('https://api/gallery', null, null)
      const p2 = syncGallery('https://api/gallery', null, null)
      const [m1, m2] = await Promise.all([p1, p2])

      // The second caller joined the first run, so only one gallery fetch fired.
      const galleryCalls = fetchMock.mock.calls.filter((c) => c[0] === 'https://api/gallery')
      expect(galleryCalls).toHaveLength(1)
      expect(m1).toBe(m2)
    })

    it('cancelSync stops a hanging download and leaves the existing cache intact', async () => {
      // First, cache one item so there's an existing playlist to protect.
      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse(
            fakeApiResponse([{ src: 'https://r2.example/old.mp4', title: 'Old', type: 'video' }]),
          ),
        )
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('old')))
      await syncGallery('https://api/gallery', null, null)
      const oldFile = join(PATHS.VIDEOS_DIR, filenameForUrl('https://r2.example/old.mp4'))
      expect(existsSync(oldFile)).toBe(true)

      // New sync whose only item hangs forever; cancel mid-download.
      fetchMock.mockReset()
      const newItems = [{ src: 'https://r2.example/new.mp4', title: 'New', type: 'video' }]
      fetchMock.mockImplementation((url: string) => {
        if (url === 'https://api/gallery')
          return Promise.resolve(makeJsonResponse(fakeApiResponse(newItems)))
        return Promise.resolve(makeHangingResponse())
      })

      const p = syncGallery('https://api/gallery', null, null)
      expect(isSyncing()).toBe(true)
      await new Promise((r) => setTimeout(r, 50)) // let it reach the hanging download
      cancelSync()
      await p

      expect(isSyncing()).toBe(false)
      // The new item never finished — no .bin, no .tmp.
      expect(existsSync(join(PATHS.VIDEOS_DIR, filenameForUrl(newItems[0].src)))).toBe(false)
      expect(readdirSync(PATHS.VIDEOS_DIR).some((n) => n.endsWith('.tmp'))).toBe(false)
      // Orphan cleanup is skipped on a cancelled run, so the old file survives.
      expect(existsSync(oldFile)).toBe(true)
    })

    it('only deletes orphans AFTER downloads complete (cache only grows mid-sync)', async () => {
      // An orphaned file must survive until the new downloads finish, so the
      // screensaver still has something to play.
      const orphanPath = join(PATHS.VIDEOS_DIR, 'orphan-from-previous-sync.bin')
      writeFileSync(orphanPath, 'old leftover')
      expect(existsSync(orphanPath)).toBe(true)

      const newItems = [{ src: 'https://r2.example/new.mp4', title: 'New', type: 'video' }]
      let orphanExistedDuringDownload = false

      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(newItems)))
        .mockImplementationOnce(async () => {
          orphanExistedDuringDownload = existsSync(orphanPath)
          return makeStreamResponse(Buffer.from('new bytes'))
        })

      await syncGallery('https://api/gallery', null, null)

      expect(orphanExistedDuringDownload).toBe(true) // cache only grows mid-sync
      expect(existsSync(orphanPath)).toBe(false) // orphan cleaned up at end
      expect(existsSync(join(PATHS.VIDEOS_DIR, filenameForUrl(newItems[0].src)))).toBe(true)
    })

    it('evicts locked pieces when a subscription lapses (non-free pieces)', async () => {
      // A and B are free; C is subscriber-only (free: false).
      const all = [
        { src: 'https://r2.example/a.mp4', title: 'A', type: 'video', free: true },
        { src: 'https://r2.example/b.mp4', title: 'B', type: 'video', free: true },
        { src: 'https://r2.example/c.mp4', title: 'C', type: 'video', free: false },
      ]

      // Sync 1: subscribed → all three cached (a subscriber unlocks non-free too).
      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse(fakeApiResponse(all, { isSubscribed: true })),
        )
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('A')))
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('B')))
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('C')))
      await syncGallery('https://api/gallery', null, null, [all[0].src, all[1].src, all[2].src])
      expect(readdirSync(PATHS.VIDEOS_DIR)).toHaveLength(3)

      // Sync 2: subscription lapsed. C is now locked and must be evicted even
      // though it's selected; the free pieces stay.
      fetchMock.mockReset()
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse(fakeApiResponse(all, { isSubscribed: false })),
      )
      const m2 = await syncGallery('https://api/gallery', null, null, [
        all[0].src,
        all[1].src,
        all[2].src,
      ])

      const remaining = readdirSync(PATHS.VIDEOS_DIR).sort()
      expect(remaining).toEqual([filenameForUrl(all[0].src), filenameForUrl(all[1].src)].sort())
      expect(m2.items.map((i) => i.title)).toEqual(['A', 'B'])
      expect(m2.isSubscribed).toBe(false)
    })

    it('never downloads a locked piece, even if it is in the selection', async () => {
      // A is free, B is subscriber-only.
      const all = [
        { src: 'https://r2.example/a.mp4', title: 'A', type: 'video', free: true },
        { src: 'https://r2.example/b.mp4', title: 'B', type: 'video', free: false },
      ]

      // Non-subscriber: B is selected but locked, so it's never fetched.
      fetchMock
        .mockResolvedValueOnce(
          makeJsonResponse(fakeApiResponse(all, { isSubscribed: false })),
        )
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('A')))
      const m = await syncGallery('https://api/gallery', null, null, [all[0].src, all[1].src])

      expect(m.items.map((i) => i.title)).toEqual(['A']) // B excluded from the play set
      expect(existsSync(join(PATHS.VIDEOS_DIR, filenameForUrl(all[0].src)))).toBe(true)
      expect(existsSync(join(PATHS.VIDEOS_DIR, filenameForUrl(all[1].src)))).toBe(false)
      expect(fetchMock).toHaveBeenCalledTimes(2) // gallery + A only (never B)
    })

    it('downloads only the selected items (unselected ones are not fetched)', async () => {
      const all = [
        { src: 'https://r2.example/a.mp4', title: 'A', type: 'video' },
        { src: 'https://r2.example/b.mp4', title: 'B', type: 'video' },
        { src: 'https://r2.example/c.mp4', title: 'C', type: 'video' },
      ]

      // Select A and C only — B is never downloaded.
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(all)))
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('A')))
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('C')))
      const m1 = await syncGallery('https://api/gallery', null, null, [all[0].src, all[2].src])

      expect(m1.items.map((i) => i.title).sort()).toEqual(['A', 'C'])
      expect(existsSync(join(PATHS.VIDEOS_DIR, filenameForUrl(all[0].src)))).toBe(true)
      expect(existsSync(join(PATHS.VIDEOS_DIR, filenameForUrl(all[1].src)))).toBe(false)
      expect(existsSync(join(PATHS.VIDEOS_DIR, filenameForUrl(all[2].src)))).toBe(true)
      // Only the two selected videos were fetched (1 gallery + 2 assets).
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('an auto sync KEEPS a deselected (still-unlocked) file; a manual sync prunes it', async () => {
      const all = [
        { src: 'https://r2.example/a.mp4', title: 'A', type: 'video' },
        { src: 'https://r2.example/b.mp4', title: 'B', type: 'video' },
        { src: 'https://r2.example/c.mp4', title: 'C', type: 'video' },
      ]

      // Seed: select all three.
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(all)))
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('A')))
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('B')))
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('C')))
      await syncGallery('https://api/gallery', null, null, [all[0].src, all[1].src, all[2].src])
      expect(readdirSync(PATHS.VIDEOS_DIR)).toHaveLength(3)

      // Auto sync with C deselected: its .bin stays, but it leaves the manifest.
      fetchMock.mockReset()
      fetchMock.mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(all)))
      const mAuto = await syncGallery('https://api/gallery', null, null, [all[0].src, all[1].src])
      expect(mAuto.items.map((i) => i.title).sort()).toEqual(['A', 'B'])
      expect(existsSync(join(PATHS.VIDEOS_DIR, filenameForUrl(all[2].src)))).toBe(true) // kept
      expect(readdirSync(PATHS.VIDEOS_DIR)).toHaveLength(3)

      // Manual sync (pruneDeselected) removes C's file.
      fetchMock.mockReset()
      fetchMock.mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(all)))
      const mManual = await syncGallery(
        'https://api/gallery',
        null,
        null,
        [all[0].src, all[1].src],
        true,
      )
      expect(mManual.items.map((i) => i.title).sort()).toEqual(['A', 'B'])
      expect(existsSync(join(PATHS.VIDEOS_DIR, filenameForUrl(all[2].src)))).toBe(false) // pruned
      expect(readdirSync(PATHS.VIDEOS_DIR).sort()).toEqual(
        [filenameForUrl(all[0].src), filenameForUrl(all[1].src)].sort(),
      )
    })

    it('defaults a null selection to the free pieces', async () => {
      // A null selection means "the free pieces".
      const items = [
        { src: 'https://r2.example/a.mp4', title: 'A', type: 'video' },
        { src: 'https://r2.example/b.mp4', title: 'B', type: 'video' },
      ]
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(items)))
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('a')))
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('b')))

      const m = await syncGallery('https://api/gallery', null, null, null)
      expect(m.items).toHaveLength(2)
    })

    it('caches nothing when the selection is empty', async () => {
      const items = [{ src: 'https://r2.example/a.mp4', title: 'A', type: 'video' }]
      fetchMock.mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(items)))

      const m = await syncGallery('https://api/gallery', null, null, [])

      expect(m.items).toHaveLength(0)
      expect(readdirSync(PATHS.VIDEOS_DIR)).toHaveLength(0)
      // Gallery fetched, but no asset downloads attempted.
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('emits progress events on the BrowserWindow', async () => {
      const items = [
        { src: 'https://r2.example/a.mp4', title: 'A', type: 'video' },
        { src: 'https://r2.example/b.mp4', title: 'B', type: 'video' },
      ]
      fetchMock
        .mockResolvedValueOnce(makeJsonResponse(fakeApiResponse(items)))
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('a')))
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('b')))

      const send = vi.fn()

      await syncGallery('https://api/gallery', null, fakeWindow(send))

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
      // A fails on every attempt (so retries are exhausted); B succeeds.
      fetchMock.mockImplementation((url: string) => {
        if (url === 'https://api/gallery')
          return Promise.resolve(makeJsonResponse(fakeApiResponse(items)))
        if (url === items[0].src) return Promise.resolve(makeStreamResponse(Buffer.alloc(0), false))
        return Promise.resolve(makeStreamResponse(Buffer.from('b-bytes')))
      })

      const send = vi.fn()

      const manifest = await syncGallery('https://api/gallery', null, fakeWindow(send))

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
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('v-bytes')))

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
        .mockResolvedValueOnce(makeStreamResponse(Buffer.from('a')))
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
