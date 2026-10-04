#!/usr/bin/env node
// Posts a clip rendered by make-social-assets.mjs to Instagram, YouTube, TikTok
// and Pinterest through Zernio. It runs unattended every night, so it favours
// safe over clever. See marketing/README.md.
//
// Usage:
//   bash curation/with-secrets.sh ZERNIO_API_KEY -- \
//     node marketing/post-social.mjs --check          # preflight, posts nothing
//
//   bash curation/with-secrets.sh ZERNIO_API_KEY -- \
//     node marketing/post-social.mjs --latest 4       # the nightly call
//
// Flags:
//   --check           verify the key, accounts and the Pinterest board, then exit
//   --dry-run         do everything except publish
//   --latest [N]      consider the N most recently rendered pieces (default 4)
//   --count <K>       how many of them to post (default 1)
//   --slug <s>        post this specific rendered piece (its marketing/out/<slug> dir)
//   --channels <list> comma list of instagram,youtube,tiktok,pinterest (default: all)
//   --format <fmt>    post this shape everywhere (default: 9x16, and 2x3 for Pinterest)
//   --force           post again even if the ledger says it already went out
//   --out <dir>       where the rendered clips live (default: marketing/out)
//
// No npm deps (Node ≥18).

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildCaptions } from './lib/captions.mjs'
import { REPO_ROOT, artworkOf, loadGallery } from './lib/pieces.mjs'

const ZERNIO_BASE = 'https://zernio.com/api/v1'

const ALL_CHANNELS = ['instagram', 'youtube', 'tiktok', 'pinterest']

/** Clip shape per channel. The 9:16 players letterbox anything else; 2:3 is Pinterest's pin shape. */
const FORMAT_FOR = { instagram: '9x16', youtube: '9x16', tiktok: '9x16', pinterest: '2x3' }

/**
 * The Pinterest board, by name: a recreated board keeps its name but not its id.
 * A missing board falls back to the account default. Override with PINTEREST_BOARD.
 */
const DEFAULT_PINTEREST_BOARD = 'Daily Curation'

/**
 * Limit of Zernio's presigned upload. Its /media/upload-direct claims 25 MB but
 * rejects anything over ~4.5 MB, and a clip is ~8 MB.
 */
const ZERNIO_MAX_UPLOAD = 5 * 1024 * 1024 * 1024

// ── args ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const a = { latest: 4, count: 1, channels: ALL_CHANNELS, out: path.join(REPO_ROOT, 'marketing', 'out') }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => argv[++i]
    if (arg === '--check') a.check = true
    else if (arg === '--dry-run') a.dryRun = true
    else if (arg === '--force') a.force = true
    else if (arg === '--latest') a.latest = /^\d+$/.test(argv[i + 1] || '') ? parseInt(next(), 10) : 4
    else if (arg === '--count') a.count = Math.max(1, parseInt(next(), 10) || 1)
    else if (arg === '--slug') a.slug = next()
    else if (arg === '--format') a.format = next()
    else if (arg === '--channels') {
      a.channels = next().split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      const bad = a.channels.filter((c) => !ALL_CHANNELS.includes(c))
      if (bad.length) die(`unknown channel(s): ${bad.join(', ')} (valid: ${ALL_CHANNELS.join(', ')})`)
    } else if (arg === '--out') a.out = path.resolve(next())
    else if (arg === '--help' || arg === '-h') a.help = true
    else die(`unexpected argument "${arg}"`)
  }
  return a
}

function die(msg) {
  process.stderr.write(`post-social: ${msg}\n`)
  process.exit(1)
}

const log = (s) => process.stdout.write(`${s}\n`)
const warn = (s) => process.stderr.write(`${s}\n`)

// ── http ────────────────────────────────────────────────────────────────────

/**
 * Fetch with retries on 429 and 5xx only; a 4xx won't fix itself. Never log
 * headers, which carry the API key.
 */
async function request(url, init = {}, { retries = 2, label = 'request' } = {}) {
  let last
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(300_000) })
    } catch (err) {
      last = new Error(`${label}: ${err.message}`)
      if (attempt === retries) throw last
      await sleep(2000 * (attempt + 1))
      continue
    }
    const text = await res.text()
    let body
    try { body = text ? JSON.parse(text) : {} } catch { body = { raw: text.slice(0, 400) } }
    if (res.status === 429 || res.status >= 500) {
      last = new Error(`${label}: HTTP ${res.status} — ${text.slice(0, 200)}`)
      if (attempt === retries) throw last
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000 - Date.now()
      await sleep(Math.min(Math.max(reset || 0, 3000 * (attempt + 1)), 60_000))
      continue
    }
    return { status: res.status, ok: res.ok, body }
  }
  throw last
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── the rendered pieces ─────────────────────────────────────────────────────

/** Everything `make-social-assets.mjs` left behind, newest first, with the clips that exist. */
function discover(outDir) {
  if (!existsSync(outDir)) die(`no rendered clips at ${outDir} — run make-social-assets.mjs first`)
  const pieces = []
  for (const name of readdirSync(outDir)) {
    const metaPath = path.join(outDir, name, 'meta.json')
    if (!existsSync(metaPath)) continue // hero/, launch-images/ and other hand-made dirs
    let meta
    try { meta = JSON.parse(readFileSync(metaPath, 'utf8')) } catch { warn(`  ⚠ unreadable ${metaPath}`); continue }
    const clips = {}
    for (const [format, file] of Object.entries(meta.formats ?? {})) {
      const full = path.join(outDir, name, file)
      if (existsSync(full)) clips[format] = full
    }
    if (Object.keys(clips).length === 0) continue
    pieces.push({ ...meta, dir: path.join(outDir, name), clips })
  }
  // Gallery date first; render time breaks ties within a night.
  return pieces.sort((a, b) =>
    (b.date ?? '').localeCompare(a.date ?? '') || (b.renderedAt ?? '').localeCompare(a.renderedAt ?? ''))
}

/** The clip a channel gets. Falls back to 9:16 when a piece has no 2:3 render. */
function clipFor(piece, platform, override) {
  const wanted = override || FORMAT_FOR[platform]
  if (piece.clips[wanted]) return { format: wanted, file: piece.clips[wanted] }
  if (!override && piece.clips['9x16']) return { format: '9x16', file: piece.clips['9x16'] }
  return null
}

/** The piece's gallery tag, from meta.json or else gallery.json. */
function eraOf(piece) {
  if (piece.era !== undefined) return piece.era
  return loadGallery().find((e) => e.src === piece.src)?.tags?.[0] ?? null
}

/** A real artwork's provenance, from meta.json or else gallery.json. */
function artworkFor(piece) {
  if (piece.artwork !== undefined) return piece.artwork
  return artworkOf(loadGallery().find((e) => e.src === piece.src))
}

/**
 * Wait for the piece's page to go live. It appears only after Vercel rebuilds
 * from the new gallery.json, and a pin's link can't be edited later.
 */
async function landingIsLive(url, { attempts = 6, waitMs = 30_000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) })
      if (res.ok) return true
      // Probably the deploy still building; any error is worth waiting on.
      if (i === 0) log(`  … landing page not live yet (HTTP ${res.status}) — waiting for the deploy`)
    } catch (err) {
      if (i === 0) log(`  … landing page unreachable (${err.message}) — retrying`)
    }
    if (i < attempts - 1) await sleep(waitMs)
  }
  return false
}

// ── the ledger ──────────────────────────────────────────────────────────────
//
// Stops a re-run from posting the same clip twice. Zernio's own duplicate check
// lasts 24h and its idempotency key ~5 minutes; this covers the next night too.

const ledgerPath = (outDir) => path.join(outDir, '.posted.json')

function loadLedger(outDir) {
  const p = ledgerPath(outDir)
  if (!existsSync(p)) return {}
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { warn(`  ⚠ ledger unreadable, starting fresh: ${p}`); return {} }
}

function recordPost(outDir, ledger, slug, platform, entry) {
  ledger[slug] ??= {}
  ledger[slug][platform] = { postedAt: new Date().toISOString(), ...entry }
  mkdirSync(outDir, { recursive: true })
  writeFileSync(ledgerPath(outDir), JSON.stringify(ledger, null, 2) + '\n')
}

const alreadyPosted = (ledger, slug, platform) => Boolean(ledger[slug]?.[platform]?.ok)

// ── Zernio ──────────────────────────────────────────────────────────────────

function zernioKey() {
  const key = process.env.ZERNIO_API_KEY
  if (!key) die('ZERNIO_API_KEY is not set — run this through curation/with-secrets.sh')
  return key
}

const zernioAuth = () => ({ Authorization: `Bearer ${zernioKey()}` })

async function zernioAccounts() {
  const { ok, body } = await request(`${ZERNIO_BASE}/accounts`, { headers: zernioAuth() }, { label: 'zernio accounts' })
  if (!ok) throw new Error(`Zernio rejected the API key (${body.error || 'unknown error'})`)
  const byPlatform = {}
  for (const a of body.accounts || []) {
    if (a.isActive === false || a.enabled === false || a.needsReconnection) continue
    byPlatform[a.platform] ??= a
  }
  return byPlatform
}

/** Resolve PINTEREST_BOARD (a name or an id) against the account's real boards. */
async function pinterestBoardId(accountId) {
  const wanted = process.env.PINTEREST_BOARD || DEFAULT_PINTEREST_BOARD
  const { ok, body } = await request(`${ZERNIO_BASE}/accounts/${accountId}/pinterest-boards`,
    { headers: zernioAuth() }, { label: 'zernio pinterest-boards' })
  if (!ok) { warn(`  ⚠ could not list Pinterest boards — falling back to the account default`); return null }
  const boards = body.boards || []
  const match = boards.find((b) => b.id === wanted) || boards.find((b) => b.name.toLowerCase() === wanted.toLowerCase())
  if (match) return match.id
  warn(`  ⚠ Pinterest board "${wanted}" not found (have: ${boards.map((b) => b.name).join(', ')}) — using the account default`)
  return body.defaultBoardId || null
}

async function zernioUpload(file) {
  const size = statSync(file).size
  if (size > ZERNIO_MAX_UPLOAD) throw new Error(`clip is ${(size / 1e9).toFixed(1)} GB, over Zernio's 5 GB limit`)

  const { ok, body } = await request(`${ZERNIO_BASE}/media/presign`, {
    method: 'POST',
    headers: { ...zernioAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: path.basename(file), contentType: 'video/mp4', size }),
  }, { label: 'zernio presign' })
  if (!ok || !body.uploadUrl || !body.publicUrl) {
    throw new Error(`Zernio presign failed: ${body.error || JSON.stringify(body).slice(0, 200)}`)
  }

  // Straight to their object store — no Authorization header (the signature is
  // in the URL, and sending one makes S3-compatible stores reject the PUT).
  const put = await fetch(body.uploadUrl, {
    method: 'PUT',
    body: readFileSync(file),
    headers: { 'Content-Type': 'video/mp4' },
    signal: AbortSignal.timeout(300_000),
  })
  if (!put.ok) throw new Error(`Zernio media PUT failed: HTTP ${put.status} ${(await put.text()).slice(0, 200)}`)
  return body.publicUrl
}

/**
 * One platform's entry in a post. `customContent` is the caption (Instagram,
 * TikTok), description (YouTube) or pin description. Every platform with an
 * AI-disclosure flag gets it set.
 */
function zernioPlatformEntry(platform, accountId, captions, boardId) {
  if (platform === 'instagram') {
    return {
      platform, accountId,
      customContent: captions.instagram.text,
      platformSpecificData: {
        // Also show the Reel on the profile grid.
        shareToFeed: true,
        thumbOffset: 1000,
        isAiGenerated: true,
      },
    }
  }
  if (platform === 'youtube') {
    return {
      platform, accountId,
      customContent: captions.youtube.description,
      platformSpecificData: {
        // Otherwise Zernio uses the description's first line. (YouTube makes
        // a vertical clip under 3 minutes a Short by itself.)
        title: captions.youtube.title,
        visibility: 'public',
        // Film & Animation. Zernio's default is "22", People & Blogs.
        categoryId: '1',
        madeForKids: false,
        containsSyntheticMedia: true,
      },
    }
  }
  if (platform === 'tiktok') {
    return {
      platform, accountId,
      customContent: captions.tiktok.text,
      platformSpecificData: {
        privacyLevel: 'PUBLIC_TO_EVERYONE',
        allowComment: true,
        allowDuet: true,
        allowStitch: true,
        // TikTok requires both of these to be true on an API post.
        contentPreviewConfirmed: true,
        expressConsentGiven: true,
        draft: false,
        videoMadeWithAi: true,
        videoCoverTimestampMs: 1000,
      },
    }
  }
  return {
    platform, accountId,
    customContent: captions.pinterest.description,
    platformSpecificData: {
      title: captions.pinterest.title,
      ...(boardId ? { boardId } : {}),
      link: captions.pinterest.link,
      coverImageKeyFrameTime: 1,
    },
  }
}

const megabytes = (file) => `${(statSync(file).size / 1e6).toFixed(1)} MB`

async function postViaZernio({ piece, captions, platforms, dryRun, format }) {
  const accounts = await zernioAccounts()
  const out = {}
  const clips = {}
  for (const p of platforms) {
    const clip = accounts[p] && clipFor(piece, p, format)
    if (!accounts[p]) {
      warn(`  ⚠ ${p}: no active Zernio account — skipped`)
      out[p] = { ok: false, error: 'not connected' }
    } else if (!clip) {
      warn(`  ⚠ ${p}: no ${format || FORMAT_FOR[p]} clip rendered for this piece — skipped`)
      out[p] = { ok: false, error: `no ${format || FORMAT_FOR[p]} clip` }
    } else {
      clips[p] = clip
    }
  }
  const targets = platforms.filter((p) => clips[p])
  if (targets.length === 0) return out

  const boardId = targets.includes('pinterest') ? await pinterestBoardId(accounts.pinterest._id) : null

  if (dryRun) {
    log(`  [dry-run] zernio → ${targets.map((p) => `${p} (${clips[p].format}, ${megabytes(clips[p].file)})`).join(', ')}`)
    if (targets.includes('tiktok')) {
      // Ask TikTok whether this account can post now. Only TikTok supports a dry run.
      const { body } = await request(`${ZERNIO_BASE}/posts`, {
        method: 'POST',
        headers: { ...zernioAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: captions.tiktok.text, dryRun: true,
          platforms: [zernioPlatformEntry('tiktok', accounts.tiktok._id, captions, null)],
        }),
      }, { label: 'zernio tiktok dry-run' })
      log(`            tiktok can publish: ${body.canPublish} — ${body.tiktok?.[0]?.reason ?? 'no reason given'}`)
      log(`            tiktok pinned comment: ${captions.tiktok.linkComment}`)
    }
    if (targets.includes('youtube')) log(`            youtube title: ${captions.youtube.title}`)
    if (targets.includes('pinterest')) log(`            pin link: ${captions.pinterest.link}${boardId ? ` (board ${boardId})` : ''}`)
    for (const p of targets) out[p] = { ok: true, dryRun: true, format: clips[p].format }
    return out
  }

  // Upload each clip once, then post per channel: one platform rejecting a
  // combined post would fail it for all of them.
  const uploads = new Map()
  const upload = (file) => {
    if (!uploads.has(file)) uploads.set(file, zernioUpload(file))
    return uploads.get(file)
  }
  const posted = await Promise.all(targets.map(async (p) => {
    const { file, format: clipFormat } = clips[p]
    try {
      const mediaUrl = await upload(file)
      const result = await publishOne({ piece, file, captions, platform: p, account: accounts[p], boardId, mediaUrl })
      return [p, { ...result, format: clipFormat }]
    } catch (err) {
      return [p, { ok: false, error: err.message, format: clipFormat }]
    }
  }))
  return Object.assign(out, Object.fromEntries(posted))
}

async function publishOne({ piece, file, captions, platform, account, boardId, mediaUrl }) {
  const payload = {
    mediaItems: [{ type: 'video', url: mediaUrl, filename: path.basename(file), mimeType: 'video/mp4' }],
    platforms: [zernioPlatformEntry(platform, account._id, captions, boardId)],
    // Only YouTube reads this top-level field.
    ...(platform === 'youtube' ? { tags: captions.youtube.tags } : {}),
    publishNow: true,
    metadata: { source: 'post-social.mjs', assetSlug: piece.assetSlug, webSlug: piece.webSlug },
  }
  const { status, body } = await request(`${ZERNIO_BASE}/posts`, {
    method: 'POST',
    headers: {
      ...zernioAuth(),
      'Content-Type': 'application/json',
      // Same clip, channel and night give the same key, so a retry returns the original post.
      'x-request-id': `lart-${piece.assetSlug}-${platform}-${new Date().toISOString().slice(0, 10)}`,
    },
    body: JSON.stringify(payload),
  }, { label: `zernio ${platform} post` })

  if (status === 409) {
    // Zernio already has this exact content on this account in the last 24h.
    return { ok: false, error: `duplicate: ${body.error || 'already posted in the last 24h'}` }
  }
  if (status >= 400) return { ok: false, error: body.error || `HTTP ${status}` }

  // A 207 means the publish failed or is still running, so read the platform's
  // state instead. An idempotent retry returns 200 with `existingPost`.
  const post = body.post || body.existingPost
  const postId = post?._id || null
  const e = await settleZernio(postId, post?.platforms?.[0] || {})
  const inFlight = IN_FLIGHT.has(e.status)
  if (inFlight) warn(`  … ${platform}: still ${e.status} on Zernio (it retries on its own)` +
    (e.errorMessage ? ` — last error: ${e.errorMessage}` : ''))
  const result = {
    // In-flight counts as sent: Zernio retries it, and marking it failed would repost it.
    ok: e.status === 'published' || inFlight,
    pending: inFlight || undefined,
    // TikTok's URL arrives minutes later, so null is normal. Look it up with GET /v1/posts/<postId>.
    url: e.platformPostUrl || null,
    id: e.platformPostId || null,
    error: inFlight ? null : (e.errorMessage || (e.status !== 'published' ? `status: ${e.status ?? 'unknown'}` : null)),
    postId,
  }
  if (platform === 'tiktok' && (e.status === 'published' || inFlight)) {
    // A comment failure must not fail the post, or it would be reposted next night.
    result.linkComment = inFlight
      ? { ok: false, error: 'the video was still publishing, so nothing was commented under it' }
      : await pinLinkComment({ accountId: account._id, postId, videoId: e.platformPostId, message: captions.tiktok.linkComment })
        .catch((err) => ({ ok: false, error: err.message }))
  }
  return result
}

/**
 * Zernio is still working while a platform is in these states, including when
 * it retries after a transient error. Treating them as failures would repost.
 */
const IN_FLIGHT = new Set(['pending', 'processing', 'uploading'])

async function settleZernio(postId, entry) {
  for (let i = 0; i < 8 && postId && IN_FLIGHT.has(entry.status); i++) {
    await sleep(15_000)
    try {
      const { body } = await request(`${ZERNIO_BASE}/posts/${postId}`, { headers: zernioAuth() },
        { label: 'zernio post status', retries: 1 })
      entry = (body.post || body).platforms?.[0] || entry
    } catch {
      break // the post exists; a failed read shouldn't fail the run
    }
  }
  return entry
}

// ── TikTok's link comment ───────────────────────────────────────────────────
//
// The TikTok account can't have a bio link, so each video gets a pinned comment
// with the site's address. This needs Zernio's TikTok Business app connection;
// an older connection gets 400 PLATFORM_LIMITATION until it's reconnected.

/** A real TikTok video id, as opposed to Zernio's interim `v_pub_url~…` publish id. */
const TIKTOK_VIDEO_ID = /^\d+$/

/** The video id lands on Zernio's record minutes after the post publishes, so wait for it. */
async function tiktokVideoId(postId, known, { attempts = 20, waitMs = 30_000 } = {}) {
  if (TIKTOK_VIDEO_ID.test(known ?? '')) return known
  for (let i = 0; i < attempts && postId; i++) {
    await sleep(waitMs)
    try {
      const { body } = await request(`${ZERNIO_BASE}/posts/${postId}`, { headers: zernioAuth() },
        { label: 'zernio post status', retries: 1 })
      const id = (body.post || body).platforms?.[0]?.platformPostId
      if (TIKTOK_VIDEO_ID.test(id ?? '')) return id
    } catch {
      // keep waiting
    }
  }
  return null
}

async function pinLinkComment({ accountId, postId, videoId, message }) {
  const id = await tiktokVideoId(postId, videoId)
  if (!id) return { ok: false, error: 'TikTok never reported the video id, so nothing was commented' }

  const comments = `${ZERNIO_BASE}/inbox/comments/${id}`
  const { ok, status, body } = await request(comments, {
    method: 'POST',
    headers: {
      ...zernioAuth(),
      'Content-Type': 'application/json',
      // One comment per video, even if retried.
      'Idempotency-Key': `lart-link-comment-${id}`,
    },
    body: JSON.stringify({ accountId, message }),
  }, { label: 'zernio tiktok comment' })
  const commentId = body.data?.commentId
  if (!ok || !commentId) return { ok: false, videoId: id, error: body.error || `HTTP ${status}` }

  // Pinning right away fails because TikTok hasn't registered the comment yet; retry.
  let error
  for (let i = 0; i < 6; i++) {
    await sleep(15_000)
    const pin = await request(`${comments}/${commentId}/pin`, {
      method: 'POST',
      headers: { ...zernioAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId }),
    }, { label: 'zernio tiktok pin', retries: 1 })
    if (pin.ok && pin.body.pinned) return { ok: true, videoId: id, commentId }
    error = pin.body.error || `HTTP ${pin.status}`
  }
  return { ok: false, videoId: id, commentId, error: `commented but not pinned: ${error}` }
}

// ── preflight ───────────────────────────────────────────────────────────────

async function preflight(channels) {
  try {
    const accounts = await zernioAccounts()
    log(`zernio ✓ accounts: ${Object.entries(accounts).map(([p, a]) => `${p} (${a.username})`).join(', ') || 'none'}`)
    let ok = true
    for (const c of channels) {
      if (!accounts[c]) { warn(`  ✗ ${c} has no active account`); ok = false }
    }
    if (channels.includes('pinterest') && accounts.pinterest) {
      const board = await pinterestBoardId(accounts.pinterest._id)
      log(`  pinterest board: ${board || '(account default)'}`)
    }
    return ok
  } catch (err) {
    warn(`zernio ✗ ${err.message}`)
    return false
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const a = parseArgs(process.argv.slice(2))
  if (a.help) {
    log('usage: node marketing/post-social.mjs [--check|--dry-run] [--latest N] [--count K]\n' +
        '       [--slug <s>] [--channels instagram,youtube,tiktok,pinterest] [--format 9x16|2x3]\n' +
        '       [--force] [--out <dir>]')
    return
  }

  if (a.check) {
    const ok = await preflight(a.channels)
    log(ok ? '\nPreflight OK — every requested channel is ready.' : '\nPreflight FAILED — see above.')
    process.exit(ok ? 0 : 1)
  }

  const ledger = loadLedger(a.out)
  const all = discover(a.out)
  if (all.length === 0) die(`no rendered clips with a meta.json under ${a.out}`)

  let candidates = a.slug ? all.filter((p) => p.assetSlug === a.slug) : all.slice(0, a.latest)
  if (a.slug && candidates.length === 0) die(`no rendered piece with assetSlug "${a.slug}" under ${a.out}`)
  if (!a.slug) {
    // Newest unposted pieces first, `--count` of them (one a night).
    const pending = candidates.filter((p) => a.force || a.channels.some((c) => !alreadyPosted(ledger, p.assetSlug, c)))
    candidates = pending.slice(0, a.count)
  }
  if (candidates.length === 0) { log('Nothing new to post — every recent piece is already published.'); return }

  let failures = 0
  for (const piece of candidates) {
    const todo = a.channels.filter((c) => a.force || !alreadyPosted(ledger, piece.assetSlug, c))
    const skipped = a.channels.filter((c) => !todo.includes(c))
    log(`\n▸ ${piece.title} [${piece.style}] → ${todo.join(', ') || '(nothing)'}` +
        (skipped.length ? `  (already posted: ${skipped.join(', ')})` : ''))
    if (todo.length === 0) continue
    if (!piece.webSlug && todo.includes('pinterest')) warn('  ⚠ no gallery slug for this piece — the pin will link to the home page')

    const captions = buildCaptions({
      title: piece.title, style: piece.style, era: eraOf(piece), webSlug: piece.webSlug, artwork: artworkFor(piece),
    })
    const results = {}

    // Only the pin carries a link, so only the pin waits on the landing page.
    if (todo.includes('pinterest') && piece.webSlug && !a.dryRun && !(await landingIsLive(captions.pinterest.link))) {
      results.pinterest = { ok: false, error: `${captions.pinterest.link} is not live — not pinning a link that 404s ` +
        `(a pin's destination can't be edited afterwards)` }
    }

    const platforms = todo.filter((p) => !results[p])
    if (platforms.length) {
      try {
        Object.assign(results, await postViaZernio({ piece, captions, platforms, dryRun: a.dryRun, format: a.format }))
      } catch (err) {
        // Zernio is down or rejected the key: nothing went out.
        for (const p of platforms) results[p] = { ok: false, error: err.message }
      }
    }

    for (const [platform, r] of Object.entries(results)) {
      if (r.ok) log(`  ${r.pending ? '…' : '✓'} ${platform}${r.url ? ` → ${r.url}` : ''}` +
        `${r.dryRun ? ' (dry run)' : ''}${r.pending ? ' (queued at Zernio, publishing)' : ''}`)
      else { warn(`  ✗ ${platform}: ${r.error || 'failed'}`); failures++ }
      if (r.linkComment?.ok) log('    ✓ link comment pinned')
      else if (r.linkComment) warn(`    ⚠ tiktok link comment: ${r.linkComment.error}`)
      if (!a.dryRun) recordPost(a.out, ledger, piece.assetSlug, platform, r)
    }
  }

  if (failures) { warn(`\n${failures} channel post(s) failed.`); process.exit(1) }
  log('\nAll requested channels posted.')
}

main().catch((err) => {
  process.stderr.write(`post-social: ${err.message}\n`)
  process.exit(1)
})
