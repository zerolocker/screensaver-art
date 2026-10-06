// Shared helpers for the real-art scripts: a polite HTTP client, a worker pool,
// the arg parser, and the provenance keys. No npm deps.

import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

// Wikimedia's User-Agent policy wants a contact address; the museums get the same.
export const UA =
  'LivingArtScreensaver-curation/1.1 (https://living-art-screensaver.com; livingartscreensaver@gmail.com; ' +
  `nightly public-domain art sourcing, ~4 works/night) node/${process.versions.node}`

/** Exactly these keys are copied into gallery.json. */
export const PROVENANCE_KEYS = [
  'source', 'artist', 'artist_dates', 'original_title', 'original_date',
  'museum', 'credit_line', 'source_url', 'license',
]

export const pickProvenance = (rec) =>
  Object.fromEntries(PROVENANCE_KEYS.map((k) => [k, rec[k] ?? null]))

export const log = (msg) => process.stderr.write(`${msg}\n`)

// ---- args ------------------------------------------------------------------

/** `--flag value` / `--bool` parser in publish-piece's style. */
export function parseArgs(argv, bools, usage, die) {
  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) die(`unexpected argument "${a}"\n\n${usage}`)
    const name = a.slice(2)
    if (name === 'help') { process.stdout.write(`${usage}\n`); process.exit(0) }
    if (bools.has(name)) { opts[name] = true; continue }
    const v = argv[++i]
    if (v === undefined || v.startsWith('--')) die(`--${name} needs a value\n\n${usage}`)
    opts[name] = v
  }
  return opts
}

// ---- http ------------------------------------------------------------------

// Per-host minimum gap between requests, plus a cookie jar. The Met's firewall
// blocks the whole IP for 10-15 minutes after ~80 requests in a minute (despite
// its documented 80 req/s), so it gets ~1 req/s.
const MIN_GAP_MS = {
  'collectionapi.metmuseum.org': 1100,
  'images.metmuseum.org': 1100,
  // AIC allows 60 req/min; calls are batched 100 ids at a time.
  'api.artic.edu': 1000,
  'www.artic.edu': 250,
  'openaccess-api.clevelandart.org': 120,
  'id.rijksmuseum.nl': 200,
  'data.rijksmuseum.nl': 250,
  'iiif.micr.io': 200,
  'data.getty.edu': 300,
  'media.getty.edu': 200,
  'api.smk.dk': 300,
  'iip.smk.dk': 300,
  'api.nga.gov': 300,
  'query.wikidata.org': 200, // and one query at a time (wikidata.mjs)
  'www.wikidata.org': 500,
  'commons.wikimedia.org': 500,
  'upload.wikimedia.org': 1000,
  'thumb.wikimedia.org': 1000,
}
const nextSlot = new Map()
const jars = new Map()

async function politeSlot(host) {
  const gap = MIN_GAP_MS[host] ?? 100
  const now = Date.now()
  const at = Math.max(now, nextSlot.get(host) ?? 0)
  nextSlot.set(host, at + gap)
  if (at > now) await new Promise((r) => setTimeout(r, at - now))
}

function cookieHeader(host) {
  const jar = jars.get(host)
  return jar && jar.size ? [...jar].map(([k, v]) => `${k}=${v}`).join('; ') : null
}

function storeCookies(host, res) {
  const set = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  if (!set.length) return
  const jar = jars.get(host) ?? new Map()
  for (const c of set) {
    const [pair] = c.split(';')
    const eq = pair.indexOf('=')
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
  jars.set(host, jar)
}

export class HttpError extends Error {
  constructor(msg, status) { super(msg); this.status = status }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Once a host has blocked us for a whole retry cycle, stop asking it this run.
const tripped = new Map()
export const trippedHosts = () => [...tripped.keys()]

/**
 * fetch with UA, cookies, per-host pacing, timeout and retry/backoff.
 * Retries network errors, 408/425/429/5xx, and bot-wall responses (a 403 or an
 * HTML page where JSON was expected — Imperva/Cloudflare challenge pages).
 * 404 and other 4xx fail fast. `as`: 'json' | 'text' | 'response' (caller reads).
 */
export async function http(url, { method = 'GET', headers = {}, body, as = 'json', retries = 4, timeoutMs = 45_000, redirect = 'follow' } = {}) {
  const host = new URL(url).host
  if (tripped.has(host)) throw new HttpError(`${host} is blocking this client (bot wall) — skipped`, 403)
  let lastErr
  let walls = 0
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) {
      const wait = Math.min(60_000, 1500 * 2 ** (attempt - 1)) + Math.random() * 500
      await sleep(lastErr?.retryAfterMs ?? wait)
    }
    await politeSlot(host)
    const h = { 'User-Agent': UA, ...headers }
    if (host.endsWith('artic.edu')) h['AIC-User-Agent'] = UA // AIC asks for this
    const ck = cookieHeader(host)
    if (ck) h.Cookie = ck
    let res
    try {
      res = await fetch(url, { method, headers: h, body, redirect, signal: AbortSignal.timeout(timeoutMs) })
    } catch (e) {
      lastErr = new HttpError(`${method} ${url}: ${e.cause?.code || e.name}: ${e.message}`, 0)
      continue
    }
    storeCookies(host, res)
    const ctype = res.headers.get('content-type') || ''
    const retryable = [408, 425, 429, 500, 502, 503, 504].includes(res.status)
    // A 403 *page* (HTML) is a WAF/bot wall; a 403 with a JSON body is a real API
    // refusal (e.g. AIC's "too many results") and fails fast below.
    const html = /text\/html/i.test(ctype)
    const botWall = html && (res.status === 403 || (as === 'json' && res.ok))
    if (retryable || botWall) {
      const ra = Number(res.headers.get('retry-after'))
      await res.body?.cancel().catch(() => {})
      if (botWall) walls++
      lastErr = new HttpError(
        `${method} ${url}: HTTP ${res.status}${botWall ? ' (bot wall — backing off)' : ''}`, res.status)
      if (ra > 0) lastErr.retryAfterMs = Math.min(ra, 120) * 1000
      continue
    }
    walls = 0
    if (as === 'response') return res
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new HttpError(`${method} ${url}: HTTP ${res.status} ${t.slice(0, 200).trim()}`, res.status)
    }
    if (as === 'text') return res.text()
    try {
      return await res.json()
    } catch (e) {
      lastErr = new HttpError(`${method} ${url}: bad JSON (${e.message})`, res.status)
    }
  }
  if (walls > retries) {
    tripped.set(host, Date.now())
    log(`!! ${host} walled off every retry — skipping it for the rest of this run`)
  }
  throw lastErr
}

/**
 * Stream a URL to disk. Returns the final response URL + byte count. Any failure,
 * including one mid-stream, is an HttpError so callers can fall back to another
 * size. The timeout covers the whole body: full-res masters run to tens of MB.
 */
export async function download(url, dest, opts = {}) {
  const res = await http(url, { timeoutMs: 600_000, ...opts, as: 'response' })
  if (!res.ok) {
    await res.body?.cancel().catch(() => {})
    throw new HttpError(`GET ${url}: HTTP ${res.status}`, res.status)
  }
  const ctype = res.headers.get('content-type') || ''
  if (!/^image\//i.test(ctype)) {
    await res.body?.cancel().catch(() => {})
    throw new HttpError(`GET ${url}: expected an image, got "${ctype}"`, res.status)
  }
  let bytes = 0
  const counted = Readable.fromWeb(res.body).on('data', (c) => { bytes += c.length })
  try {
    await pipeline(counted, createWriteStream(dest))
  } catch (e) {
    throw new HttpError(`GET ${url}: download failed after ${bytes} bytes (${e.cause?.code || e.name}: ${e.message})`, 0)
  }
  const expected = Number(res.headers.get('content-length'))
  if (expected > 0 && bytes !== expected) throw new HttpError(`GET ${url}: truncated (${bytes} of ${expected} bytes)`, 0)
  return { url: res.url, status: res.status, bytes, contentType: ctype }
}

/**
 * Read an image's pixel size from its header with a Range request (JPEG SOF /
 * PNG IHDR / TIFF IFD0), for sources whose API doesn't report dimensions.
 * Returns {width, height} or null if it can't tell.
 */
export async function probeImageSize(url) {
  for (const span of [131_071, 1_048_575]) {
    const res = await http(url, { as: 'response', headers: { Range: `bytes=0-${span}` } })
    if (!res.ok) { await res.body?.cancel().catch(() => {}); return null }
    // Read at most span+1 bytes even if the server ignored Range.
    const chunks = []
    let n = 0
    const reader = res.body.getReader()
    while (n <= span) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      n += value.length
    }
    await reader.cancel().catch(() => {})
    const dims = imageSizeFromHeader(Buffer.concat(chunks))
    if (dims) return dims
  }
  return null
}

export function imageSizeFromHeader(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue }
      const marker = b[i + 1]
      if (marker === 0xff) { i++; continue }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue }
      const len = b.readUInt16BE(i + 2)
      // SOF0..SOF15 except DHT(C4), JPG(C8), DAC(CC)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) }
      }
      i += 2 + len
    }
  }
  return null
}

// ---- concurrency -----------------------------------------------------------

/** Map with at most `n` in flight; preserves order. Errors become {error}. */
export async function mapPool(items, n, fn) {
  const out = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      try { out[i] = await fn(items[i], i) } catch (e) { out[i] = { error: e } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker))
  return out
}

export const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

// ---- text ------------------------------------------------------------------

// NFKD leaves some letters whole (Hammershøi, Bærentzen): spell them out.
const LETTERS = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', ł: 'l', đ: 'd', ð: 'd', þ: 'th' }
export const fold = (s) =>
  String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[øæœßłđðþ]/g, (c) => LETTERS[c])

export const slug = (s, maxWords = 6) =>
  fold(s).replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
    .filter(Boolean).slice(0, maxWords).join('_')
