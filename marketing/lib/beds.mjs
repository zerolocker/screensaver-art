// The music-bed library — resolving a bed for `make-social-assets.mjs --audio`.
//
// WHY A SMALL SHARED LIBRARY, NOT A TRACK PER CLIP: nobody watching a nightly
// feed notices that tonight's bed is the same one as last Tuesday's, so
// generating a fresh Lyria track per piece would be a recurring API bill for an
// improvement no viewer can perceive. A handful of beds, picked deterministically
// per piece, gives the same variety-in-practice for a one-off cost.
//
// WHERE THE MP3s LIVE: on R2, never in git (CLAUDE.md → Repo rules — a committed
// blob is permanent, and deleting it later doesn't shrink the repo). `beds.json`
// commits only the *metadata* — id, the prompt it was generated from, and its
// public URL — and the audio is cached under marketing/beds/ (gitignored) on
// first use. `make-beds.mjs` is what fills that manifest.

import { existsSync, mkdirSync, statSync, writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from './pieces.mjs'

export const BEDS_MANIFEST = path.join(REPO_ROOT, 'marketing', 'beds.json')
export const BEDS_CACHE = path.join(REPO_ROOT, 'marketing', 'beds')
/** R2 prefix on the existing `screensaver-assets` bucket. */
export const BEDS_R2_PREFIX = 'marketing/beds'
export const BEDS_BASE_URL = 'https://screensaver-assets.living-art-asset.com/'
/**
 * Bed level in dB. Negative = quieter than the source. −9 dB puts the music
 * clearly under the art rather than over it (strategy §11.2: the picture leads;
 * a bed that competes with the picture is worse than silence).
 */
export const DEFAULT_GAIN_DB = -9

/** djb2, matching the other deterministic picks in these scripts. */
function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h
}

export function loadBeds() {
  if (!existsSync(BEDS_MANIFEST)) return []
  const parsed = JSON.parse(readFileSync(BEDS_MANIFEST, 'utf8'))
  return Array.isArray(parsed.beds) ? parsed.beds : []
}

export function writeBeds(beds) {
  writeFileSync(BEDS_MANIFEST, JSON.stringify({ schema: 1, beds }, null, 2) + '\n')
}

export const bedUrl = (id) => `${BEDS_BASE_URL}${BEDS_R2_PREFIX}/${id}.mp3`
export const bedCachePath = (id) => path.join(BEDS_CACHE, `${id}.mp3`)

async function download(url, dest) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`bed download failed (${res.status}) for ${url}`)
  mkdirSync(path.dirname(dest), { recursive: true })
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  if (statSync(dest).size === 0) throw new Error(`bed download produced an empty file: ${dest}`)
  return dest
}

/**
 * Resolve `--audio`'s value to a local MP3.
 *
 * `spec` is either `true` (pick one from the library, keyed by `key` so the same
 * piece always gets the same bed), a bed id, a local path, or a URL.
 * Throws rather than silently rendering silent: a batch that quietly lost its
 * audio would go unnoticed until it was already published.
 */
export async function resolveBed(spec, key = '') {
  if (typeof spec === 'string' && (spec.startsWith('http://') || spec.startsWith('https://'))) {
    const id = path.basename(new URL(spec).pathname).replace(/\.mp3$/i, '') || 'remote'
    const dest = bedCachePath(id)
    if (!existsSync(dest)) await download(spec, dest)
    return { id, file: dest, url: spec }
  }
  if (typeof spec === 'string' && (spec.includes('/') || spec.endsWith('.mp3'))) {
    const abs = path.resolve(spec)
    if (existsSync(abs)) return { id: path.basename(abs, '.mp3'), file: abs, url: null }
  }

  const beds = loadBeds()
  if (beds.length === 0) {
    throw new Error(
      `no music beds available — marketing/beds.json is empty.\n` +
      `  Generate the library once with:  node marketing/make-beds.mjs\n` +
      `  or render without music by dropping --audio.`,
    )
  }
  const bed = typeof spec === 'string'
    ? beds.find((b) => b.id === spec)
    : beds[hash(String(key)) % beds.length]
  if (!bed) throw new Error(`no bed with id "${spec}" in marketing/beds.json (have: ${beds.map((b) => b.id).join(', ')})`)

  const dest = bedCachePath(bed.id)
  if (!existsSync(dest) || statSync(dest).size === 0) {
    if (!bed.url) throw new Error(`bed "${bed.id}" has no url and is not cached at ${dest}`)
    await download(bed.url, dest)
  }
  return { id: bed.id, file: dest, url: bed.url ?? null }
}
