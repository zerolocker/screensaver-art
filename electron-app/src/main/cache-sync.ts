// Cache sync — fetches the gallery from the website's API, downloads each
// MP4, obfuscates it, and writes it to the shared screensaver cache dir.
// The Swift screensaver only ever reads this dir.

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

export type ApiItem = {
  src: string
  title: string
  type: string
  collection?: string
}

export type ApiResponse = {
  items: ApiItem[]
  isSubscribed: boolean
  totalCount: number
}

export type CachedItem = {
  filename: string
  title: string
  type: string
}

export type CachedManifest = {
  items: CachedItem[]
  isSubscribed: boolean
  totalCount: number
  syncedAt: string
}

// How long to wait for the gallery JSON before giving up. The list is tiny, so
// this is really just a guard against a hung connection.
const GALLERY_TIMEOUT_MS = 20_000
// A *stall* timeout, not a total timeout: we abort a download only if NO bytes
// arrive for this long. A slow-but-progressing download (small pipe, big video)
// is never killed — the timer resets on every chunk.
const STALL_TIMEOUT_MS = 30_000
// Transient failures (a stalled connection, an R2 hiccup) get a couple of
// retries before we give up on an item and move on.
const DOWNLOAD_RETRIES = 2
const RETRY_BACKOFF_MS = 400

// Default number of pieces to cache when the user has never customized their
// selection (a null selection). Matches the website's free-tier slice, so a
// fresh install plays a sensible set before the user ever opens the gallery.
export const FREE_COUNT = 100

export function getCacheDir(): string {
  // Test-only override (the test suite points this at a tmp dir so it never
  // touches the real /Users/Shared). NOT a user-facing setting: the Swift
  // screensaver hardcodes /Users/Shared/LivingArtScreensaver, so overriding
  // this in production would desync the writer from the reader.
  if (process.env.LART_CACHE_DIR) return process.env.LART_CACHE_DIR
  if (process.platform === 'darwin') {
    // Shared, un-sandboxed location that both the Electron app (writer) and the
    // .appex screensaver (reader, via a temporary-exception.files.absolute-path
    // entitlement) can reach. /Users/Shared/ is nobody's app container, so
    // writing here triggers no "access data from other apps" TCC prompt — which
    // is exactly why the old legacyScreenSaver-container path is gone.
    // MUST match `Cache.baseDir` in
    // screensaver-macos/ScreensaverArtExtension/Constants.swift.
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

// A cancellable sleep — resolves after `ms`, or rejects immediately if the sync
// is cancelled while we're backing off between retries.
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

// Stream the video to a temp file, obfuscating on the fly, then atomically
// rename it into place. The final `<hash>.bin` therefore only ever appears
// fully written — a download killed mid-flight (app quit, stall, network drop)
// leaves at most a `<hash>.bin.tmp`, which is swept on the next sync, NOT a
// truncated `.bin` that would be skipped forever by the existsSync() check.
async function downloadAndObfuscate(
  item: ApiItem,
  dest: string,
  signal: AbortSignal,
): Promise<void> {
  const tmp = dest + '.tmp'
  // Per-download stall guard. Reset on every chunk; if it fires, abort the
  // fetch + pipeline. Combined with the sync-wide signal so a quit/cancel also
  // tears the download down.
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
        armStall() // bytes are flowing — reset the stall timer
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
        // Zero-byte body: still emit the magic header so the file is a valid
        // (empty) obfuscated payload rather than a 0-byte file.
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
    // Best-effort: any partial temp file from a failed/aborted run must not
    // linger as a half-written sibling.
    if (existsSync(tmp)) await unlink(tmp).catch(() => {})
  }
}

// Download with a few retries for transient failures. A real cancel (app quit
// or a superseding manual sync) is NOT retried — we bail out immediately.
async function downloadWithRetry(item: ApiItem, dest: string, signal: AbortSignal): Promise<void> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= DOWNLOAD_RETRIES; attempt++) {
    if (signal.aborted) throw new Error('sync cancelled')
    try {
      await downloadAndObfuscate(item, dest, signal)
      return
    } catch (err) {
      if (signal.aborted) throw err // cancelled — don't burn retries
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
// syncGallery is re-entrancy-guarded: a second caller (e.g. a manual "Sync Now"
// click while the on-open auto-sync is running) joins the in-flight run instead
// of kicking off a duplicate. cancelSync() aborts the current run (used on app
// quit); isSyncing() lets the renderer reflect a sync already underway.

let inFlight: Promise<CachedManifest> | null = null
let inFlightAbort: AbortController | null = null

// `selectedSrcs` is the user's chosen subset (a list of item `src` URLs). A null
// selection (the user has never customized it) defaults to the first FREE_COUNT
// items. Only selected items are cached; deselected ones are pruned as orphans.
export function syncGallery(
  apiUrl: string,
  accessToken: string | null,
  window: BrowserWindow | null,
  selectedSrcs: string[] | null = null,
): Promise<CachedManifest> {
  if (inFlight) {
    log.info('cache-sync', 'sync already in progress — joining existing run')
    return inFlight
  }
  const abort = new AbortController()
  inFlightAbort = abort
  inFlight = runSync(apiUrl, accessToken, window, selectedSrcs, abort.signal).finally(() => {
    inFlight = null
    inFlightAbort = null
  })
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
  log.info('cache-sync', 'gallery fetched', { count: api.items.length, isSubscribed: api.isSubscribed, totalCount: api.totalCount })

  // Narrow to the user's selection. A null selection (never customized) defaults
  // to the first FREE_COUNT items. We preserve the API order so the manifest and
  // the download loop iterate in the same order the gallery is presented in.
  const selectedSet =
    selectedSrcs === null
      ? new Set(api.items.slice(0, FREE_COUNT).map((it) => it.src))
      : new Set(selectedSrcs)
  const chosen = api.items.filter((item) => selectedSet.has(item.src))
  log.info('cache-sync', 'selection applied', {
    selected: chosen.length,
    of: api.items.length,
    customized: selectedSrcs !== null,
  })

  const cached: CachedItem[] = chosen.map((item) => ({
    filename: filenameForUrl(item.src),
    title: item.title,
    type: item.type,
  }))
  const wantedFilenames = new Set(cached.map((i) => i.filename))

  // Write the manifest BEFORE doing any file I/O so the screensaver sees the
  // new list immediately. As `.bin` files appear during the download loop, the
  // screensaver picks them up live; items whose `.bin` isn't there yet are
  // skipped at play time (CachedGallery.playableURL returns nil and
  // ScreensaverArtView.show calls advance()).
  const manifest: CachedManifest = {
    items: cached,
    isSubscribed: api.isSubscribed,
    totalCount: api.totalCount,
    syncedAt: new Date().toISOString(),
  }
  await writeManifestAtomic(manifest)

  // Download anything missing. Serial — we're talking dozens of items, and
  // parallel fetches were saturating my home network in testing. Only the
  // selected items are downloaded; the rest are pruned as orphans below.
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
      if (signal.aborted) break // cancelled — stop quietly, leave the cache as-is
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

  // If we were cancelled mid-run, leave the existing playlist intact — don't
  // prune orphans (we may not have finished downloading the new set) and don't
  // emit `done`. The manifest is already on disk; the next sync resumes.
  if (signal.aborted) {
    log.info('cache-sync', 'sync cancelled', { processed: i, total: chosen.length })
    return manifest
  }

  // Delete orphans (files no longer in the new gallery — e.g. subscription
  // expired and the API returned a shorter list). We do this LAST, after
  // downloads succeed, so the cache size only grows mid-sync. An interrupted
  // sync leaves the existing playlist intact rather than half-pruned.
  const existing = existsSync(VIDEOS_DIR) ? await readdir(VIDEOS_DIR) : []
  for (const name of existing) {
    if (!wantedFilenames.has(name)) {
      await unlink(join(VIDEOS_DIR, name)).catch(() => {})
    }
  }

  log.info('cache-sync', 'sync done', { total: chosen.length })
  emit(window, 'cache:progress', { phase: 'done', total: chosen.length })
  return manifest
}

// Atomic manifest write — temp + rename, so the screensaver never reads a
// half-written JSON file.
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
