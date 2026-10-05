// Fetches the gallery from the website, downloads and obfuscates each MP4, and
// writes it to the cache dir that the screensaver reads.

import { existsSync, createWriteStream } from 'fs'
import { mkdir, writeFile, readdir, unlink, rename } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { Readable, Transform, type TransformCallback } from 'stream'
import { pipeline } from 'stream/promises'
import type { ReadableStream as NodeWebReadableStream } from 'stream/web'
import type { BrowserWindow } from 'electron'
import { obfuscateChunk, filenameForUrl, MAGIC } from './obfuscation'
import { log } from './logger'
import { isItemFree, type ArtItem, type GalleryApiResponse } from '@screensaver-art/constants'

export type ApiItem = ArtItem
export type ApiResponse = GalleryApiResponse

export type CachedItem = {
  filename: string
  title: string
  type: string
}

export type CachedManifest = {
  items: CachedItem[]
  isSubscribed: boolean
  syncedAt: string
}

const GALLERY_TIMEOUT_MS = 20_000
// Abort a download only if no bytes arrive for this long; slow downloads are fine.
const STALL_TIMEOUT_MS = 30_000
const DOWNLOAD_RETRIES = 2
const RETRY_BACKOFF_MS = 400

export function getCacheDir(): string {
  // Tests only. The screensaver hardcodes the real path.
  if (process.env.LART_CACHE_DIR) return process.env.LART_CACHE_DIR
  if (process.platform === 'darwin') {
    // The sandboxed screensaver can read /Users/Shared through an entitlement,
    // and writing here triggers no privacy prompt. MUST match `Cache.baseDir`
    // in screensaver-macos/ScreensaverArtExtension/Constants.swift.
    return '/Users/Shared/LivingArtScreensaver'
  }
  return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'ScreensaverArt')
}

const CACHE_DIR = getCacheDir()
const VIDEOS_DIR = join(CACHE_DIR, 'videos')
const MANIFEST_PATH = join(CACHE_DIR, 'gallery.json')

function emit(window: BrowserWindow | null, event: string, payload: unknown): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send(event, payload)
  }
}

// A sleep that rejects as soon as the sync is cancelled.
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('sync cancelled'))
      return
    }
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new Error('sync cancelled'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

// Stream the video to a temp file, obfuscating as it goes, then rename it into
// place. An interrupted download leaves a `.tmp` (swept next sync), never a
// truncated `.bin` that the existsSync() check would skip forever.
async function downloadAndObfuscate(
  item: ApiItem,
  dest: string,
  signal: AbortSignal,
): Promise<void> {
  const tmp = dest + '.tmp'
  // Stall guard, reset on every chunk, combined with the sync-wide cancel signal.
  const stall = new AbortController()
  const combined = AbortSignal.any([signal, stall.signal])
  let timer: NodeJS.Timeout | undefined
  const armStall = (): void => {
    clearTimeout(timer)
    timer = setTimeout(() => stall.abort(new Error('download stalled')), STALL_TIMEOUT_MS)
  }

  try {
    armStall()
    const res = await fetch(item.src, { signal: combined })
    if (!res.ok) throw new Error(`Failed to download ${item.src}: HTTP ${res.status}`)
    if (!res.body) throw new Error(`No response body for ${item.src}`)

    let offset = 0
    let wroteMagic = false
    const obfuscator = new Transform({
      transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
        armStall()
        const obf = obfuscateChunk(chunk, offset)
        offset += chunk.length
        if (wroteMagic) {
          cb(null, obf)
        } else {
          wroteMagic = true
          cb(null, Buffer.concat([MAGIC, obf]))
        }
      },
      flush(cb: TransformCallback): void {
        // Empty body: still write the header.
        if (!wroteMagic) cb(null, MAGIC)
        else cb()
      },
    })

    await pipeline(
      Readable.fromWeb(res.body as unknown as NodeWebReadableStream),
      obfuscator,
      createWriteStream(tmp),
      { signal: combined },
    )
    await rename(tmp, dest)
  } finally {
    clearTimeout(timer)
    if (existsSync(tmp)) await unlink(tmp).catch(() => {})
  }
}

// Retry transient failures, but not a cancel.
async function downloadWithRetry(item: ApiItem, dest: string, signal: AbortSignal): Promise<void> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= DOWNLOAD_RETRIES; attempt++) {
    if (signal.aborted) throw new Error('sync cancelled')
    try {
      await downloadAndObfuscate(item, dest, signal)
      return
    } catch (err) {
      if (signal.aborted) throw err
      lastErr = err
      if (attempt < DOWNLOAD_RETRIES) await delay(RETRY_BACKOFF_MS * (attempt + 1), signal)
    }
  }
  throw lastErr
}

// Remove any `<hash>.bin.tmp` left by a previously-interrupted sync.
async function sweepTempFiles(): Promise<void> {
  if (!existsSync(VIDEOS_DIR)) return
  const entries = await readdir(VIDEOS_DIR)
  await Promise.all(
    entries
      .filter((n) => n.endsWith('.tmp'))
      .map((n) => unlink(join(VIDEOS_DIR, n)).catch(() => {})),
  )
}

// ─── Public API ──────────────────────────────────────────────────────────────
// A second syncGallery() call while one is running joins it. cancelSync() is
// used on quit.

let inFlight: Promise<CachedManifest> | null = null
let inFlightAbort: AbortController | null = null

// `selectedSrcs` is the user's selection; null (never customized) means the free
// pieces. Locked pieces are never downloaded. Deselected unlocked pieces stay on
// disk so re-adding is instant, unless `pruneDeselected` (manual "Sync Now").
export function syncGallery(
  apiUrl: string,
  accessToken: string | null,
  window: BrowserWindow | null,
  selectedSrcs: string[] | null = null,
  pruneDeselected = false,
): Promise<CachedManifest> {
  if (inFlight) {
    log.info('cache-sync', 'sync already in progress — joining existing run')
    return inFlight
  }
  const abort = new AbortController()
  inFlightAbort = abort
  inFlight = runSync(apiUrl, accessToken, window, selectedSrcs, pruneDeselected, abort.signal).finally(
    () => {
      inFlight = null
      inFlightAbort = null
    },
  )
  return inFlight
}

export function cancelSync(): void {
  if (inFlightAbort) {
    log.info('cache-sync', 'sync cancelled (abort requested)')
    inFlightAbort.abort(new Error('sync cancelled'))
  }
}

export function isSyncing(): boolean {
  return inFlight !== null
}

async function runSync(
  apiUrl: string,
  accessToken: string | null,
  window: BrowserWindow | null,
  selectedSrcs: string[] | null,
  pruneDeselected: boolean,
  signal: AbortSignal,
): Promise<CachedManifest> {
  await mkdir(VIDEOS_DIR, { recursive: true })
  await sweepTempFiles()

  log.info('cache-sync', 'sync started', { apiUrl, authenticated: Boolean(accessToken) })
  emit(window, 'cache:progress', { phase: 'fetching-gallery' })
  const res = await fetch(apiUrl, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    signal: AbortSignal.any([signal, AbortSignal.timeout(GALLERY_TIMEOUT_MS)]),
  })
  if (!res.ok) {
    log.error('cache-sync', 'gallery API error', { status: res.status })
    throw new Error(`Gallery API returned HTTP ${res.status}`)
  }
  const api: ApiResponse = await res.json()
  const freeItems = api.items.filter(isItemFree)
  log.info('cache-sync', 'gallery fetched', {
    count: api.items.length,
    isSubscribed: api.isSubscribed,
    free: freeItems.length,
  })

  // Locked pieces are never downloaded and are evicted (e.g. when a subscription expires).
  const unlockedItems = api.isSubscribed ? api.items : freeItems
  const unlockedSrcs = new Set(unlockedItems.map((it) => it.src))

  // Selected ∩ unlocked, in gallery order.
  const selectedSet =
    selectedSrcs === null
      ? new Set(freeItems.map((it) => it.src))
      : new Set(selectedSrcs)
  const chosen = api.items.filter(
    (item) => selectedSet.has(item.src) && unlockedSrcs.has(item.src),
  )
  log.info('cache-sync', 'selection applied', {
    selected: chosen.length,
    unlocked: unlockedItems.length,
    of: api.items.length,
    customized: selectedSrcs !== null,
    pruneDeselected,
  })

  const cached: CachedItem[] = chosen.map((item) => ({
    filename: filenameForUrl(item.src),
    title: item.title,
    type: item.type,
  }))
  const wantedFilenames = new Set(cached.map((i) => i.filename))

  // Files to keep after this sync. Locked and removed pieces always go.
  const keepFilenames = pruneDeselected
    ? wantedFilenames
    : new Set(unlockedItems.map((it) => filenameForUrl(it.src)))

  // Write the manifest first so the screensaver sees the new list at once. It
  // skips items whose `.bin` hasn't downloaded yet.
  const manifest: CachedManifest = {
    items: cached,
    isSubscribed: api.isSubscribed,
    syncedAt: new Date().toISOString(),
  }
  await writeManifestAtomic(manifest)

  // Download one at a time; parallel downloads saturated a home network.
  let i = 0
  for (const item of chosen) {
    i++
    if (signal.aborted) break
    const dest = join(VIDEOS_DIR, filenameForUrl(item.src))
    if (existsSync(dest)) {
      emit(window, 'cache:progress', { phase: 'cached', index: i, total: chosen.length, title: item.title })
      continue
    }
    if (item.type !== 'video') continue
    emit(window, 'cache:progress', { phase: 'downloading', index: i, total: chosen.length, title: item.title })
    try {
      await downloadWithRetry(item, dest, signal)
    } catch (err) {
      if (signal.aborted) break
      log.error('cache-sync', 'item download failed', {
        title: item.title,
        src: item.src,
        error: err instanceof Error ? err.message : String(err),
      })
      emit(window, 'cache:progress', {
        phase: 'error',
        index: i,
        total: chosen.length,
        title: item.title,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Cancelled: don't prune or emit `done`. The next sync resumes.
  if (signal.aborted) {
    log.info('cache-sync', 'sync cancelled', { processed: i, total: chosen.length })
    return manifest
  }

  // Prune last, so an interrupted sync never leaves the cache half-pruned.
  const existing = existsSync(VIDEOS_DIR) ? await readdir(VIDEOS_DIR) : []
  for (const name of existing) {
    if (!keepFilenames.has(name)) {
      await unlink(join(VIDEOS_DIR, name)).catch(() => {})
    }
  }

  log.info('cache-sync', 'sync done', { total: chosen.length })
  emit(window, 'cache:progress', { phase: 'done', total: chosen.length })
  return manifest
}

// Temp file + rename, so the screensaver never reads a half-written manifest.
async function writeManifestAtomic(manifest: CachedManifest): Promise<void> {
  const tmp = MANIFEST_PATH + '.tmp'
  await writeFile(tmp, JSON.stringify(manifest, null, 2))
  await rename(tmp, MANIFEST_PATH)
}

export async function clearCache(): Promise<void> {
  if (existsSync(VIDEOS_DIR)) {
    const entries = await readdir(VIDEOS_DIR)
    await Promise.all(entries.map((e) => unlink(join(VIDEOS_DIR, e)).catch(() => {})))
  }
  if (existsSync(MANIFEST_PATH)) {
    await unlink(MANIFEST_PATH).catch(() => {})
  }
}

export const PATHS = { CACHE_DIR, VIDEOS_DIR, MANIFEST_PATH }
