// Cache sync — fetches the gallery from the website's API, downloads each
// MP4, obfuscates it, and writes it to the shared screensaver cache dir.
// The Swift screensaver only ever reads this dir.

import { existsSync } from 'fs'
import { mkdir, writeFile, readdir, unlink, rename } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { BrowserWindow } from 'electron'
import { obfuscate, filenameForUrl } from './obfuscation'

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

export function getCacheDir(): string {
  if (process.platform === 'darwin') {
    return macSandboxCacheDir()
  }
  return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'ScreensaverArt')
}

// The .saver runs inside legacyScreenSaver.appex's sandbox, so when its Swift
// asks for `.cachesDirectory` macOS hands back the container's Caches dir —
// NOT the user's real ~/Library/Caches/. We write where the screensaver reads.
// (App Groups would be cleaner but require code-signing + provisioning that
// isn't worth it for a $0.99 product.)
function macSandboxCacheDir(): string {
  const containers = join(homedir(), 'Library', 'Containers')
  const candidates = [
    'com.apple.ScreenSaver.Engine.legacyScreenSaver',
    'com.apple.ScreenSaver.Engine.legacyScreenSaver.x86-64', // Intel hosts
  ]
  const containerId =
    candidates.find((id) => existsSync(join(containers, id, 'Data', 'Library', 'Caches'))) ??
    candidates[0]
  return join(containers, containerId, 'Data', 'Library', 'Caches', 'ScreensaverArt')
}

const CACHE_DIR = getCacheDir()
const VIDEOS_DIR = join(CACHE_DIR, 'videos')
const MANIFEST_PATH = join(CACHE_DIR, 'gallery.json')

function emit(window: BrowserWindow | null, event: string, payload: unknown): void {
  if (window && !window.isDestroyed()) {
    window.webContents.send(event, payload)
  }
}

async function downloadAndObfuscate(item: ApiItem, dest: string): Promise<void> {
  const res = await fetch(item.src)
  if (!res.ok) throw new Error(`Failed to download ${item.src}: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const obf = obfuscate(buf)
  await writeFile(dest, obf)
}

export async function syncGallery(
  apiUrl: string,
  accessToken: string | null,
  window: BrowserWindow | null,
): Promise<CachedManifest> {
  await mkdir(VIDEOS_DIR, { recursive: true })

  emit(window, 'cache:progress', { phase: 'fetching-gallery' })
  const res = await fetch(apiUrl, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  })
  if (!res.ok) throw new Error(`Gallery API returned HTTP ${res.status}`)
  const api: ApiResponse = await res.json()

  const cached: CachedItem[] = api.items.map((item) => ({
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
  // parallel fetches were saturating my home network in testing.
  let i = 0
  for (const item of api.items) {
    i++
    const dest = join(VIDEOS_DIR, filenameForUrl(item.src))
    if (existsSync(dest)) {
      emit(window, 'cache:progress', { phase: 'cached', index: i, total: api.items.length, title: item.title })
      continue
    }
    if (item.type !== 'video') continue
    emit(window, 'cache:progress', { phase: 'downloading', index: i, total: api.items.length, title: item.title })
    try {
      await downloadAndObfuscate(item, dest)
    } catch (err) {
      emit(window, 'cache:progress', {
        phase: 'error',
        index: i,
        total: api.items.length,
        title: item.title,
        error: err instanceof Error ? err.message : String(err),
      })
    }
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

  emit(window, 'cache:progress', { phase: 'done', total: api.items.length })
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
