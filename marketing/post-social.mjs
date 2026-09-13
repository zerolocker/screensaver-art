#!/usr/bin/env node
// Daily social posting — publish the rendered clips to all four channels.
//
// This is the last mile of the content flywheel (growth backlog #1): the nightly
// curation makes the art, `make-social-assets.mjs` reframes + scores it, and this
// publishes it while nobody is awake. Founder time budget is ~0 h/week, so every
// decision here favours "survives an unattended run" over "clever".
//
// One vendor, four channels (strategy §11.1 — all four are equal priority):
//   Zernio  →  Instagram, YouTube, TikTok, Pinterest
// The clip is uploaded once, then published as one Zernio post per channel. We buy
// this rather than building it because TikTok restricts *unaudited* API clients to
// private posting, and Zernio holds an audited client (§11). Until 2026-09-12
// Instagram + YouTube went through upload-post; consolidating onto Zernio is
// cheaper at four accounts and leaves one API to keep working.
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
//   --dry-run         do everything except publish (incl. TikTok's own dry-run check)
//   --latest [N]      consider the N most recently rendered pieces (default 4)
//   --count <K>       how many of them to actually post (default 1 — one piece a night)
//   --slug <s>        post this specific rendered piece (its marketing/out/<slug> dir)
//   --channels <list> comma list of instagram,youtube,tiktok,pinterest (default: all)
//   --format <fmt>    which rendered clip to post (default: 9x16)
//   --force           post again even if the ledger says it already went out
//   --out <dir>       where the rendered clips live (default: marketing/out)
//
// No npm deps (Node ≥18 built-ins + fetch).

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildCaptions } from './lib/captions.mjs'
import { REPO_ROOT } from './lib/pieces.mjs'

const ZERNIO_BASE = 'https://zernio.com/api/v1'

const ALL_CHANNELS = ['instagram', 'youtube', 'tiktok', 'pinterest']

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
 * One fetch with retries. Only 429 and 5xx are retried — a 4xx is our bug or a
 * disconnected account, and hammering it just burns quota. Never logs a header:
 * the API key must not reach stdout, a log file or a debug dump.
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
// idempotency key — but that key only holds for ~5 minutes, so this file is the
// defence that covers a re-run the next night.)

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
 * One platform's entry in a post. `customContent` replaces the post's `content`
 * for that platform — the caption on Instagram and TikTok, the video description
 * on YouTube, the pin description on Pinterest.
 *
 * The art *is* AI-generated, so every platform that has a disclosure flag gets it
 * set, rather than waiting to be caught by the platform's own detection.
 */
function zernioPlatformEntry(platform, accountId, captions, boardId) {
  if (platform === 'instagram') {
    return {
      platform, accountId,
      customContent: captions.instagram.text,
      platformSpecificData: {
        // A single video publishes as a Reel; this keeps it on the profile grid too.
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
        // Without this Zernio titles the video with the description's first line.
        // (There is no Shorts flag: YouTube classifies a vertical clip ≤3 min itself.)
        title: captions.youtube.title,
        visibility: 'public',
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
  const out = {}
  for (const p of platforms.filter((p) => !accounts[p])) {
    warn(`  ⚠ ${p}: no active Zernio account — skipped`)
    out[p] = { ok: false, error: 'not connected' }
  }
  if (targets.length === 0) return out

  const boardId = targets.includes('pinterest') ? await pinterestBoardId(accounts.pinterest._id) : null

  if (dryRun) {
    log(`  [dry-run] zernio → ${targets.join(', ')} (${(statSync(piece.file).size / 1e6).toFixed(1)} MB)`)
    if (targets.includes('tiktok')) {
      // TikTok's own preflight: can this account Direct Post right now? (Zernio's
      // dryRun is TikTok-only — the other three have nothing to ask in advance.)
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
    if (targets.includes('youtube')) log(`            youtube title: ${captions.youtube.title}`)
    if (targets.includes('pinterest')) log(`            pin link: ${captions.pinterest.link}${boardId ? ` (board ${boardId})` : ''}`)
    for (const p of targets) out[p] = { ok: true, dryRun: true }
    return out
  }

  // One upload, then one post per platform rather than a single multi-platform
  // post: a payload one platform rejects fails the whole request with a 400, and
  // that must not take the other three channels down with it.
  const mediaUrl = await zernioUpload(piece.file)
  const posted = await Promise.all(targets.map(async (p) => {
    try {
      return [p, await publishOne({ piece, captions, platform: p, account: accounts[p], boardId, mediaUrl })]
    } catch (err) {
      return [p, { ok: false, error: err.message }]
    }
  }))
  return Object.assign(out, Object.fromEntries(posted))
}

async function publishOne({ piece, captions, platform, account, boardId, mediaUrl }) {
  const payload = {
    mediaItems: [{ type: 'video', url: mediaUrl, filename: path.basename(piece.file), mimeType: 'video/mp4' }],
    platforms: [zernioPlatformEntry(platform, account._id, captions, boardId)],
    // A top-level field that only YouTube reads — and this post only targets YouTube.
    ...(platform === 'youtube' ? { tags: captions.youtube.tags } : {}),
    publishNow: true,
    metadata: { source: 'post-social.mjs', assetSlug: piece.assetSlug, webSlug: piece.webSlug },
  }
  const { status, body } = await request(`${ZERNIO_BASE}/posts`, {
    method: 'POST',
    headers: {
      ...zernioAuth(),
      'Content-Type': 'application/json',
      // Same clip + same channel + same night = same key, so a retried call gets
      // the original post back instead of creating a second one.
      'x-request-id': `lart-${piece.assetSlug}-${platform}-${new Date().toISOString().slice(0, 10)}`,
    },
    body: JSON.stringify(payload),
  }, { label: `zernio ${platform} post` })

  if (status === 409) {
    // Zernio already has this exact content on this account in the last 24h.
    return { ok: false, error: `duplicate: ${body.error || 'already posted in the last 24h'}` }
  }
  if (status >= 400) return { ok: false, error: body.error || `HTTP ${status}` }

  // 207 is a 2xx but means the publish attempt failed or is still going — read
  // the platform's own state rather than trusting the status code. A retry that
  // matched the idempotency key comes back as 200 with `existingPost`.
  const post = body.post || body.existingPost
  const postId = post?._id || null
  const e = await settleZernio(postId, post?.platforms?.[0] || {})
  const inFlight = IN_FLIGHT.has(e.status)
  if (inFlight) warn(`  … ${platform}: still ${e.status} on Zernio (it retries on its own)` +
    (e.errorMessage ? ` — last error: ${e.errorMessage}` : ''))
  return {
    // An in-flight platform counts as sent: Zernio owns the retry from here, and
    // calling it a failure would make the next run publish a duplicate.
    ok: e.status === 'published' || inFlight,
    pending: inFlight || undefined,
    // TikTok's permalink lands on Zernio's record minutes after the post is
    // already published, so a null url here is normal, not a problem. `postId`
    // is the handle for looking it up later: GET /v1/posts/<postId>.
    url: e.platformPostUrl || null,
    id: e.platformPostId || null,
    error: inFlight ? null : (e.errorMessage || (e.status !== 'published' ? `status: ${e.status ?? 'unknown'}` : null)),
    postId,
  }
}

/**
 * Wait for the platform to reach a terminal state.
 *
 * Zernio's per-platform status is NOT settled when the create call returns:
 * `pending` / `processing` / `uploading` mean it is still working, and a
 * platform that transiently 400s is reset to `pending` and retried — a real pin
 * did exactly that and published a minute later. Treating those as failures
 * would print a false alarm *and* leave the ledger thinking the channel is
 * unposted, so the next night would publish the same clip again.
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
      break // the post exists; a failed status read shouldn't fail the run
    }
  }
  return entry
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
    // would be four times the cadence anyone wants in a feed.
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

    let results
    try {
      results = await postViaZernio({ piece, captions, platforms: todo, dryRun: a.dryRun })
    } catch (err) {
      // Zernio down, the key rejected, the upload failed: nothing went out.
      results = Object.fromEntries(todo.map((p) => [p, { ok: false, error: err.message }]))
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
