#!/usr/bin/env node
// Daily social posting — publish the rendered clips to all four channels.
//
// This is the last mile of the content flywheel (growth backlog #1): the nightly
// curation makes the art, `make-social-assets.mjs` reframes + scores it, and this
// publishes it while nobody is awake. Founder time budget is ~0 h/week, so every
// decision here favours "survives an unattended run" over "clever".
//
// Two vendors, four channels (strategy §11.1 — all four are equal priority):
//   upload-post  →  Instagram, YouTube      (multipart POST, one call, both platforms)
//   Zernio       →  TikTok, Pinterest       (upload the clip, then one JSON post)
// We buy this rather than building it because TikTok restricts *unaudited* API
// clients to private posting, and each vendor holds its own audited client (§11).
//
// Usage:
//   bash curation/with-secrets.sh UPLOADPOST_API_KEY ZERNIO_API_KEY -- \
//     node marketing/post-social.mjs --check          # preflight, posts nothing
//
//   bash curation/with-secrets.sh UPLOADPOST_API_KEY ZERNIO_API_KEY -- \
//     node marketing/post-social.mjs --latest 4       # the nightly call
//
// Flags:
//   --check           verify keys, accounts and the Pinterest board, then exit
//   --dry-run         do everything except publish (incl. TikTok's own dry-run check)
//   --latest [N]      consider the N most recently rendered pieces (default 4)
//   --count <K>       how many of them to actually post (default 1 — one piece a night)
//   --slug <s>        post this specific rendered piece (its marketing/out/<slug> dir)
//   --channels <list> comma list of instagram,youtube,tiktok,pinterest (default: all)
//   --format <fmt>    which rendered clip to post (default: 9x16)
//   --force           post again even if the ledger says it already went out
//   --out <dir>       where the rendered clips live (default: marketing/out)
//
// No npm deps (Node ≥18 built-ins + fetch + FormData).

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildCaptions } from './lib/captions.mjs'
import { REPO_ROOT } from './lib/pieces.mjs'

const UPLOADPOST_BASE = 'https://api.upload-post.com/api'
const ZERNIO_BASE = 'https://zernio.com/api/v1'

/** Which vendor owns which channel. The split is §11.1's, not an accident. */
const VENDOR = { instagram: 'upload-post', youtube: 'upload-post', tiktok: 'zernio', pinterest: 'zernio' }
const ALL_CHANNELS = Object.keys(VENDOR)

/**
 * The board pins land on. A *name*, not an id, on purpose: a board that gets
 * recreated keeps its name but not its id, and a missing board should degrade to
 * the account default rather than fail the night. Override with PINTEREST_BOARD
 * (a name or a raw id).
 */
const DEFAULT_PINTEREST_BOARD = 'Daily Curation'

/**
 * Zernio takes media as a URL, so the clip has to be hosted before it can be
 * posted. We use the presigned-upload path (5 GB) rather than the simpler
 * /media/upload-direct: that one is documented at 25 MB but is served by a
 * serverless function that rejects anything over ~4.5 MB
 * (FUNCTION_PAYLOAD_TOO_LARGE), and an 8s 1080x1920 clip is ~8 MB.
 */
const ZERNIO_MAX_UPLOAD = 5 * 1024 * 1024 * 1024

// ── args ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const a = { latest: 4, count: 1, channels: ALL_CHANNELS, format: '9x16', out: path.join(REPO_ROOT, 'marketing', 'out') }
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
      const bad = a.channels.filter((c) => !VENDOR[c])
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
 * One fetch with retries. Only 429 and 5xx are retried — a 4xx is our bug or a
 * disconnected account, and hammering it just burns quota. Never logs a header:
 * the API keys must not reach stdout, a log file or a debug dump.
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

/** Everything `make-social-assets.mjs` left behind, newest first. */
function discover(outDir, format) {
  if (!existsSync(outDir)) die(`no rendered clips at ${outDir} — run make-social-assets.mjs first`)
  const pieces = []
  for (const name of readdirSync(outDir)) {
    const metaPath = path.join(outDir, name, 'meta.json')
    if (!existsSync(metaPath)) continue // hero/, launch-images/ and other hand-made dirs
    let meta
    try { meta = JSON.parse(readFileSync(metaPath, 'utf8')) } catch { warn(`  ⚠ unreadable ${metaPath}`); continue }
    const file = meta.formats?.[format] && path.join(outDir, name, meta.formats[format])
    if (!file || !existsSync(file)) continue
    pieces.push({ ...meta, dir: path.join(outDir, name), file })
  }
  // Gallery date first (that's the piece's identity), render time as the
  // tie-break for a night's four pieces, which all share a date.
  return pieces.sort((a, b) =>
    (b.date ?? '').localeCompare(a.date ?? '') || (b.renderedAt ?? '').localeCompare(a.renderedAt ?? ''))
}

/**
 * Refuse to publish a link that isn't live yet.
 *
 * The nightly order is: curation pushes gallery.json → Vercel rebuilds → the new
 * `/art/<slug>` page exists. Posting inside that build window would put a 404 in
 * a post whose destination URL can never be edited. So check first, and give the
 * deploy a couple of minutes to finish before giving up on the piece.
 */
async function landingIsLive(url, { attempts = 6, waitMs = 30_000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) })
      if (res.ok) return true
      // A 404 right after a push is the deploy still building; anything else
      // (500, 403) is worth waiting on too, and costs us only the retry.
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
// An unattended job gets re-run: by a retry, by a cron that overlapped, by a
// human debugging at 1am. The ledger is what stops the same clip going out
// twice. (Zernio also rejects duplicate content within 24h, and we send an
// idempotency key — but upload-post has no such guard, so this file is the one
// defence that covers all four channels.)

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

// ── upload-post (Instagram + YouTube) ───────────────────────────────────────

function uploadPostKey() {
  const key = process.env.UPLOADPOST_API_KEY
  if (!key) die('UPLOADPOST_API_KEY is not set — run this through curation/with-secrets.sh')
  return key
}

const uploadPostAuth = () => ({ Authorization: `Apikey ${uploadPostKey()}` })

async function uploadPostProfile() {
  const { ok, body } = await request(`${UPLOADPOST_BASE}/uploadposts/users`, { headers: uploadPostAuth() },
    { label: 'upload-post users' })
  if (!ok || !body.success) throw new Error(`upload-post rejected the API key (${body.message || 'unknown error'})`)
  const profiles = body.profiles || []
  const wanted = process.env.UPLOADPOST_USER
  const profile = wanted ? profiles.find((p) => p.username === wanted) : profiles[0]
  if (!profile) {
    throw new Error(wanted
      ? `no upload-post profile named "${wanted}" (have: ${profiles.map((p) => p.username).join(', ') || 'none'})`
      : 'upload-post has no profiles — create one and connect Instagram + YouTube')
  }
  // social_accounts holds "" for a platform that was never connected.
  const connected = Object.entries(profile.social_accounts || {})
    .filter(([, v]) => v && (typeof v === 'object' || String(v).length > 0))
    .map(([k]) => k)
  return { username: profile.username, connected, profile }
}

async function postViaUploadPost({ piece, captions, platforms, dryRun }) {
  const { username, connected } = await uploadPostProfile()
  const targets = platforms.filter((p) => connected.includes(p))
  const missing = platforms.filter((p) => !connected.includes(p))
  for (const p of missing) warn(`  ⚠ ${p}: not connected on upload-post profile "${username}" — skipped`)
  if (targets.length === 0) return Object.fromEntries(missing.map((p) => [p, { ok: false, error: 'not connected' }]))

  const form = new FormData()
  form.append('user', username)
  for (const p of targets) form.append('platform[]', p)
  form.append('video', new Blob([readFileSync(piece.file)], { type: 'video/mp4' }), path.basename(piece.file))
  // `title` is the cross-platform fallback and is required for YouTube.
  form.append('title', captions.youtube.title)
  if (targets.includes('instagram')) form.append('instagram_title', captions.instagram.text)
  if (targets.includes('youtube')) {
    form.append('youtube_title', captions.youtube.title)
    form.append('youtube_description', captions.youtube.description)
    form.append('privacyStatus', 'public')
    form.append('selfDeclaredMadeForKids', 'false')
    // The art *is* AI-generated. Disclose it on both platforms rather than
    // waiting to be caught by their own detection.
    form.append('containsSyntheticMedia', 'true')
  }
  form.append('is_ai_generated', 'true')
  form.append('async_upload', 'false')

  if (dryRun) {
    log(`  [dry-run] upload-post → ${targets.join(', ')} as "${username}" (${(statSync(piece.file).size / 1e6).toFixed(1)} MB)`)
    log(`            youtube_title: ${captions.youtube.title}`)
    return Object.fromEntries(targets.map((p) => [p, { ok: true, dryRun: true }]))
  }

  const { status, body } = await request(`${UPLOADPOST_BASE}/upload`,
    { method: 'POST', headers: uploadPostAuth(), body: form }, { label: 'upload-post upload' })

  // An upload that runs long flips itself to async and hands back a request_id.
  const results = body.request_id ? await pollUploadPost(body.request_id) : body.results
  if (!results) {
    const msg = body.message || body.error || `HTTP ${status}`
    return Object.fromEntries(targets.map((p) => [p, { ok: false, error: msg }]))
  }
  // Sync returns an object keyed by platform; the status poll returns an array.
  const byPlatform = Array.isArray(results)
    ? Object.fromEntries(results.map((r) => [r.platform, r]))
    : results
  // The async status poll reports success but no permalink; history has it, keyed
  // by the same request_id. Worth the extra call — a post nobody can find again
  // is barely a post.
  const links = body.request_id ? await uploadPostLinks(body.request_id) : {}
  const out = {}
  for (const p of targets) {
    const r = byPlatform[p] || {}
    const h = links[p] || {}
    out[p] = {
      ok: Boolean(r.success ?? h.success),
      url: r.url || h.post_url || null,
      id: r.post_id || r.publish_id || h.platform_post_id || null,
      error: r.error || h.error_message || (r.success === false ? r.message : null) || null,
    }
  }
  for (const p of missing) out[p] = { ok: false, error: 'not connected' }
  if (body.usage) log(`  upload-post usage: ${body.usage.count}/${body.usage.limit} this cycle`)
  return out
}

/** Permalinks for one upload, keyed by platform. Best-effort — never fatal. */
async function uploadPostLinks(requestId) {
  try {
    const { body } = await request(`${UPLOADPOST_BASE}/uploadposts/history?request_id=${encodeURIComponent(requestId)}`,
      { headers: uploadPostAuth() }, { label: 'upload-post history', retries: 1 })
    return Object.fromEntries((body.history || []).map((h) => [h.platform, h]))
  } catch {
    return {}
  }
}

async function pollUploadPost(requestId) {
  log(`  upload-post switched to async (request ${requestId}) — polling…`)
  for (let i = 0; i < 40; i++) {
    await sleep(15_000)
    const { body } = await request(`${UPLOADPOST_BASE}/uploadposts/status?request_id=${encodeURIComponent(requestId)}`,
      { headers: uploadPostAuth() }, { label: 'upload-post status' })
    if (body.status === 'completed') return body.results
  }
  throw new Error(`upload-post request ${requestId} did not complete within 10 minutes`)
}

// ── Zernio (TikTok + Pinterest) ─────────────────────────────────────────────

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

function zernioPlatformEntry(platform, accountId, captions, boardId) {
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
      // The whole reason the /art/<slug> pages exist (§4.3): a pin needs a
      // destination, and a pin's link cannot be edited after publishing.
      link: captions.pinterest.link,
      coverImageKeyFrameTime: 1,
    },
  }
}

async function postViaZernio({ piece, captions, platforms, dryRun }) {
  const accounts = await zernioAccounts()
  const targets = platforms.filter((p) => accounts[p])
  const missing = platforms.filter((p) => !accounts[p])
  for (const p of missing) warn(`  ⚠ ${p}: no active Zernio account — skipped`)
  if (targets.length === 0) return Object.fromEntries(missing.map((p) => [p, { ok: false, error: 'not connected' }]))

  const boardId = targets.includes('pinterest') ? await pinterestBoardId(accounts.pinterest._id) : null

  if (dryRun) {
    log(`  [dry-run] zernio → ${targets.join(', ')}${boardId ? ` (board ${boardId})` : ''}`)
    if (targets.includes('tiktok')) {
      // TikTok's own preflight: can this account Direct Post right now?
      const { body } = await request(`${ZERNIO_BASE}/posts`, {
        method: 'POST',
        headers: { ...zernioAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: captions.tiktok.text, dryRun: true,
          platforms: [zernioPlatformEntry('tiktok', accounts.tiktok._id, captions, null)],
        }),
      }, { label: 'zernio tiktok dry-run' })
      log(`            tiktok can publish: ${body.canPublish} — ${body.tiktok?.[0]?.reason ?? 'no reason given'}`)
    }
    log(`            pin link: ${captions.pinterest.link}`)
    return Object.fromEntries(targets.map((p) => [p, { ok: true, dryRun: true }]))
  }

  const mediaUrl = await zernioUpload(piece.file)
  const payload = {
    content: captions.tiktok.text, // the fallback; each platform overrides it
    mediaItems: [{ type: 'video', url: mediaUrl, filename: path.basename(piece.file), mimeType: 'video/mp4' }],
    platforms: targets.map((p) => zernioPlatformEntry(p, accounts[p]._id, captions, boardId)),
    publishNow: true,
    metadata: { source: 'post-social.mjs', assetSlug: piece.assetSlug, webSlug: piece.webSlug },
  }
  const { status, body } = await request(`${ZERNIO_BASE}/posts`, {
    method: 'POST',
    headers: {
      ...zernioAuth(),
      'Content-Type': 'application/json',
      // Same clip + same night = same key, so a retried run resumes the original
      // call instead of creating a second post.
      'x-request-id': `lart-${piece.assetSlug}-${targets.join('-')}-${new Date().toISOString().slice(0, 10)}`,
    },
    body: JSON.stringify(payload),
  }, { label: 'zernio posts' })

  const out = Object.fromEntries(missing.map((p) => [p, { ok: false, error: 'not connected' }]))
  if (status === 409) {
    // Zernio already has this exact content on this account in the last 24h.
    for (const p of targets) out[p] = { ok: false, error: `duplicate: ${body.error || 'already posted in the last 24h'}` }
    return out
  }
  if (status >= 400) {
    for (const p of targets) out[p] = { ok: false, error: body.error || `HTTP ${status}` }
    return out
  }
  // 207 is a 2xx but means "some platform failed" — read the per-platform state
  // rather than trusting the status code.
  const postId = body.post?._id || null
  const entries = await settleZernio(postId, body.post?.platforms || [], targets)
  for (const p of targets) {
    const e = entries.find((x) => x.platform === p) || {}
    const inFlight = IN_FLIGHT.has(e.status)
    out[p] = {
      // An in-flight platform counts as sent: Zernio owns the retry from here,
      // and calling it a failure would make the next run publish a duplicate.
      ok: e.status === 'published' || inFlight,
      pending: inFlight || undefined,
      // TikTok's permalink lands on Zernio's record minutes after the post is
      // already published, so a null url here is normal, not a problem. `postId`
      // is the handle for looking it up later: GET /v1/posts/<postId>.
      url: e.platformPostUrl || null,
      id: e.platformPostId || null,
      error: inFlight ? null : (e.errorMessage || (e.status && e.status !== 'published' ? `status: ${e.status}` : null)),
      postId,
    }
    if (inFlight) warn(`  … ${p}: still ${e.status} on Zernio (it retries on its own)` +
      (e.errorMessage ? ` — last error: ${e.errorMessage}` : ''))
  }
  return out
}

/**
 * Wait for each platform to reach a terminal state.
 *
 * Zernio's per-platform status is NOT settled when the create call returns:
 * `pending` / `processing` / `uploading` mean it is still working, and a
 * platform that transiently 400s is reset to `pending` and retried — a real pin
 * did exactly that and published a minute later. Treating those as failures
 * would print a false alarm *and* leave the ledger thinking the channel is
 * unposted, so the next night would publish the same clip again.
 */
const IN_FLIGHT = new Set(['pending', 'processing', 'uploading'])

async function settleZernio(postId, initial, targets) {
  let entries = initial
  if (!postId) return entries
  for (let i = 0; i < 8; i++) {
    const unsettled = targets.filter((p) => IN_FLIGHT.has(entries.find((e) => e.platform === p)?.status))
    if (unsettled.length === 0) return entries
    await sleep(15_000)
    try {
      const { body } = await request(`${ZERNIO_BASE}/posts/${postId}`, { headers: zernioAuth() },
        { label: 'zernio post status', retries: 1 })
      entries = (body.post || body).platforms || entries
    } catch {
      return entries // the post exists; a failed status read shouldn't fail the run
    }
  }
  return entries
}

// ── preflight ───────────────────────────────────────────────────────────────

async function preflight(channels) {
  let ok = true
  if (channels.some((c) => VENDOR[c] === 'upload-post')) {
    try {
      const { username, connected } = await uploadPostProfile()
      log(`upload-post ✓ profile "${username}" — connected: ${connected.join(', ') || 'nothing'}`)
      for (const c of channels.filter((c) => VENDOR[c] === 'upload-post')) {
        if (!connected.includes(c)) { warn(`  ✗ ${c} is not connected`); ok = false }
      }
    } catch (err) { warn(`upload-post ✗ ${err.message}`); ok = false }
  }
  if (channels.some((c) => VENDOR[c] === 'zernio')) {
    try {
      const accounts = await zernioAccounts()
      log(`zernio ✓ accounts: ${Object.entries(accounts).map(([p, a]) => `${p} (${a.username})`).join(', ') || 'none'}`)
      for (const c of channels.filter((c) => VENDOR[c] === 'zernio')) {
        if (!accounts[c]) { warn(`  ✗ ${c} has no active account`); ok = false }
      }
      if (accounts.pinterest) {
        const board = await pinterestBoardId(accounts.pinterest._id)
        log(`  pinterest board: ${board || '(account default)'}`)
      }
    } catch (err) { warn(`zernio ✗ ${err.message}`); ok = false }
  }
  return ok
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const a = parseArgs(process.argv.slice(2))
  if (a.help) {
    log('usage: node marketing/post-social.mjs [--check|--dry-run] [--latest N] [--count K]\n' +
        '       [--slug <s>] [--channels instagram,youtube,tiktok,pinterest] [--format 9x16]\n' +
        '       [--force] [--out <dir>]')
    return
  }

  if (a.check) {
    const ok = await preflight(a.channels)
    log(ok ? '\nPreflight OK — every requested channel is ready.' : '\nPreflight FAILED — see above.')
    process.exit(ok ? 0 : 1)
  }

  const ledger = loadLedger(a.out)
  const all = discover(a.out, a.format)
  if (all.length === 0) die(`no rendered "${a.format}" clips with a meta.json under ${a.out}`)

  let candidates = a.slug ? all.filter((p) => p.assetSlug === a.slug) : all.slice(0, a.latest)
  if (a.slug && candidates.length === 0) die(`no rendered piece with assetSlug "${a.slug}" under ${a.out}`)
  if (!a.slug) {
    // One piece a night, newest first: a nightly batch of four posted in full
    // would be four times the cadence anyone wants in a feed, and would burn
    // upload-post's free monthly uploads in under a week.
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
    if (!piece.webSlug) warn('  ⚠ no gallery slug for this piece — links will point at the home page')

    const captions = buildCaptions({ title: piece.title, style: piece.style, webSlug: piece.webSlug })

    if (piece.webSlug && !a.dryRun && !(await landingIsLive(captions.pinterest.link))) {
      warn(`  ✗ ${captions.pinterest.link} is not live — skipping this piece rather than ` +
           `publishing a link that 404s (a post's destination can't be edited afterwards)`)
      failures++
      continue
    }

    const results = {}

    for (const vendor of ['upload-post', 'zernio']) {
      const platforms = todo.filter((c) => VENDOR[c] === vendor)
      if (platforms.length === 0) continue
      try {
        const post = vendor === 'upload-post' ? postViaUploadPost : postViaZernio
        Object.assign(results, await post({ piece, captions, platforms, dryRun: a.dryRun }))
      } catch (err) {
        // One vendor being down must not stop the other two channels.
        for (const p of platforms) results[p] = { ok: false, error: err.message }
      }
    }

    for (const [platform, r] of Object.entries(results)) {
      if (r.ok) log(`  ${r.pending ? '…' : '✓'} ${platform}${r.url ? ` → ${r.url}` : ''}` +
        `${r.dryRun ? ' (dry run)' : ''}${r.pending ? ' (queued at Zernio, publishing)' : ''}`)
      else { warn(`  ✗ ${platform}: ${r.error || 'failed'}`); failures++ }
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
