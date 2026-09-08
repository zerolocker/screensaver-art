#!/usr/bin/env node
// Marketing asset engine — turn a gallery piece into ready-to-post social clips.
//
// The nightly curation agent produces landscape (16:9) art and appends it to
// gallery.json. Social feeds are vertical/square, so this script reframes a
// piece into 9:16 (Reels/TikTok/Shorts) and 1:1 (feed) with a tasteful
// blurred-fill background + a subtle wordmark, scores it with a music bed, loops
// it to a comfortable duration, and writes starter per-platform captions. Reuses
// art you already generate — the marginal cost of a day's social content is
// ~one ffmpeg run.
//
// It also writes a `meta.json` next to each piece's clips: the hand-off to
// `post-social.mjs`, which publishes them. That file is why the poster never has
// to re-derive a title, a style or (critically) a landing-page slug.
//
// Usage:
//   node marketing/make-social-assets.mjs --latest 4 --audio       # the nightly batch
//   node marketing/make-social-assets.mjs --title "Art Nouveau"
//   node marketing/make-social-assets.mjs --src ./clip.mp4 --title "My Piece" --style "Baroque"
//   node marketing/make-social-assets.mjs --title x --formats 9x16 --duration 15 --no-wordmark
//
// Flags:
//   --latest [N]     process the N newest gallery.json entries (default 4)
//   --title <substr> process the gallery entry whose title contains <substr> (case-insensitive)
//   --src <path|url> use this MP4 directly (skip gallery lookup); pair with --title/--style
//   --style <text>   override the derived art style (used in captions + hashtags)
//   --formats <list> comma list of 9x16,1x1 (default: both)
//   --duration <sec> loop/trim target length (default: 12)
//   --audio [bed]    score the clip with a music bed (default: one picked from marketing/beds.json)
//   --gain <dB>      bed level, negative = quieter (default: -9)
//   --no-wordmark    don't burn the living-art-screensaver.com URL pill
//   --out <dir>      output base dir (default: marketing/out)
//
// Requires: ffmpeg on PATH. No npm deps (Node ≥18 built-ins + fetch).

import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { captionsMarkdown } from './lib/captions.mjs'
import { assetSlug, deriveMeta, galleryVideos, REPO_ROOT, webSlugForSrc } from './lib/pieces.mjs'
import { DEFAULT_GAIN_DB, resolveBed } from './lib/beds.mjs'

const __dirname = path.join(REPO_ROOT, 'marketing')

// A pre-rendered "gentle" URL pill (frosted, mirrors the in-app title pill),
// burned bottom-center as a subtle CTA back to the site — replaces the old
// out-of-context "LIVING ART" wordmark. It's a committed PNG asset (rendered by
// scripts/PIL into marketing/assets/) so this script stays dependency-free.
// Skipped automatically if the asset is missing.
const URL_PILL = path.join(__dirname, 'assets', 'url-pill.png')
const HAS_PILL = existsSync(URL_PILL)

const FORMATS = {
  '9x16': { w: 1080, h: 1920, pillPad: 150 },
  '1x1': { w: 1080, h: 1080, pillPad: 70 },
}

// ── arg parsing ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = {
    formats: ['9x16', '1x1'], duration: 12, wordmark: true, audio: false,
    gain: DEFAULT_GAIN_DB, out: path.join(REPO_ROOT, 'marketing', 'out'),
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => argv[++i]
    if (arg === '--latest') {
      const n = /^\d+$/.test(argv[i + 1] || '') ? parseInt(next(), 10) : 4
      a.latest = n
    } else if (arg === '--title') a.title = next()
    else if (arg === '--src') a.src = next()
    else if (arg === '--style') a.style = next()
    else if (arg === '--formats') a.formats = next().split(',').map((s) => s.trim()).filter(Boolean)
    else if (arg === '--duration') a.duration = Math.max(3, parseInt(next(), 10) || 12)
    else if (arg === '--audio') {
      // Bare --audio picks a bed from the library; --audio <id|path|url> pins one.
      a.audio = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? next() : true
    } else if (arg === '--no-audio') a.audio = false
    else if (arg === '--gain') a.gain = parseFloat(next())
    else if (arg === '--no-wordmark') a.wordmark = false
    else if (arg === '--out') a.out = path.resolve(next())
    else if (arg === '--help' || arg === '-h') a.help = true
  }
  return a
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function resolveSource(src, tmp) {
  if (/^https?:\/\//i.test(src)) {
    process.stdout.write(`  ↓ downloading ${src}\n`)
    const res = await fetch(src)
    if (!res.ok) throw new Error(`download failed (${res.status}) for ${src}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const local = path.join(tmp, 'source.mp4')
    writeFileSync(local, buf)
    return local
  }
  const abs = path.resolve(src)
  if (!existsSync(abs)) throw new Error(`source not found: ${abs}`)
  return abs
}

function buildFilter({ w, h, pill, pillPad, pillWidth, audio, audioIndex, gain, duration }) {
  // Blurred, zoomed-in copy fills the frame; the art sits centered and whole on
  // top — the standard "no black bars, art never cropped" reframe.
  const chain = [
    `[0:v]split=2[bg][fg]`,
    `[bg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},gblur=sigma=26,eq=brightness=-0.12:saturation=1.08[bgb]`,
    `[fg]scale=${w}:${h}:force_original_aspect_ratio=decrease[fgs]`,
    `[bgb][fgs]overlay=(W-w)/2:(H-h)/2${pill ? '[base]' : ',format=yuv420p[outv]'}`,
  ]
  if (pill) {
    // Overlay the pre-rendered URL pill (input [1]), scaled to a share of the
    // frame width and sat bottom-center as a gentle, persistent CTA.
    chain.push(`[1:v]scale=${pillWidth}:-1[pill]`)
    chain.push(`[base][pill]overlay=(W-w)/2:H-h-${pillPad},format=yuv420p[outv]`)
  }
  if (audio) {
    // The bed is looped by -stream_loop and cut by -t, so it only needs levelling
    // and a fade at each end — a hard cut on a sustained pad is very audible.
    // It sits well under the art on purpose (§11.2: the picture leads).
    const out = Math.max(0, duration - 1.5)
    chain.push(`[${audioIndex}:a]volume=${gain}dB,afade=t=in:st=0:d=1,afade=t=out:st=${out}:d=1.5[outa]`)
  }
  return chain.join(';')
}

function renderFormat({ input, fmtKey, outFile, duration, wordmark, bed, gain }) {
  const fmt = FORMATS[fmtKey]
  if (!fmt) throw new Error(`unknown format ${fmtKey} (use 9x16 or 1x1)`)
  const usePill = wordmark && HAS_PILL
  const pillWidth = Math.round(fmt.w * 0.46)
  // Input order decides the filter's stream indices: art, [pill], [bed].
  const audioIndex = usePill ? 2 : 1
  const filter = buildFilter({ ...fmt, pill: usePill, pillWidth, audio: !!bed, audioIndex, gain, duration })
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-stream_loop', '-1', '-i', input,
    ...(usePill ? ['-loop', '1', '-i', URL_PILL] : []),
    ...(bed ? ['-stream_loop', '-1', '-i', bed] : []),
    '-filter_complex', filter,
    '-map', '[outv]',
    ...(bed ? ['-map', '[outa]', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2'] : ['-an']),
    '-t', String(duration),
    '-r', '30',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outFile,
  ]
  const r = spawnSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] })
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${fmtKey}`)
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const a = parseArgs(process.argv.slice(2))
  if (a.help || (!a.src && !a.title && !a.latest)) {
    process.stdout.write('Usage: node marketing/make-social-assets.mjs [--latest N | --title <substr> | --src <path|url>]\n' +
      '       [--style <text>] [--formats 9x16,1x1] [--duration 12] [--audio [bed]] [--gain -9]\n' +
      '       [--no-wordmark] [--out <dir>]\n')
    process.exit(a.help ? 0 : 1)
  }
  if (a.wordmark && !HAS_PILL) process.stderr.write('  ⚠ marketing/assets/url-pill.png not found — rendering without the URL pill.\n')

  // Build the work list of { entry-ish, src }.
  let jobs = []
  if (a.src) {
    jobs = [{ title: a.title || path.basename(a.src).replace(/\.[^.]+$/, ''), tags: [], src: a.src }]
  } else {
    const videos = galleryVideos()
    if (a.title) {
      const t = a.title.toLowerCase()
      jobs = videos.filter((e) => (e.title || '').toLowerCase().includes(t))
      if (jobs.length === 0) throw new Error(`no gallery entry title contains "${a.title}"`)
    } else {
      jobs = videos.slice(-a.latest) // newest are appended last
    }
  }

  // One bed for the whole batch, resolved (and downloaded) once up front so a
  // network hiccup fails before any ffmpeg work rather than halfway through it.
  let bed = null
  if (a.audio) {
    bed = await resolveBed(a.audio, jobs[0]?.src || 'batch')
    process.stdout.write(`Music bed: ${bed.id} (${path.relative(REPO_ROOT, bed.file)}) at ${a.gain} dB\n`)
  }

  process.stdout.write(`Rendering ${jobs.length} piece(s) → ${a.out}\n`)
  let ok = 0
  for (const entry of jobs) {
    const { title, style } = deriveMeta(entry, a.style)
    const slug = assetSlug(title) || 'piece'
    const webSlug = a.src && !entry.date ? null : webSlugForSrc(entry.src)
    const dir = path.join(a.out, slug)
    mkdirSync(dir, { recursive: true })
    const tmp = mkdtempSync(path.join(tmpdir(), 'lart-social-'))
    try {
      process.stdout.write(`• ${title}  [${style}]\n`)
      const input = await resolveSource(entry.src, tmp)
      const formats = {}
      for (const fmtKey of a.formats) {
        const name = `${slug}_${fmtKey}.mp4`
        const outFile = path.join(dir, name)
        renderFormat({ input, fmtKey, outFile, duration: a.duration, wordmark: a.wordmark, bed: bed?.file, gain: a.gain })
        formats[fmtKey] = name
        process.stdout.write(`  ✓ ${path.relative(REPO_ROOT, outFile)} (${(statSync(outFile).size / 1e6).toFixed(1)} MB)\n`)
      }
      writeFileSync(path.join(dir, 'captions.md'), captionsMarkdown({ title, style, webSlug }))
      // The hand-off to post-social.mjs. Everything it needs to publish this
      // piece — above all `webSlug`, the permanent landing page — is recorded
      // here at render time, so the poster never re-derives it.
      writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
        schema: 1,
        assetSlug: slug,
        webSlug,
        title,
        style,
        galleryTitle: entry.title ?? null,
        src: entry.src,
        date: entry.date ?? null,
        duration: a.duration,
        audioBed: bed?.id ?? null,
        formats,
        renderedAt: new Date().toISOString(),
      }, null, 2) + '\n')
      process.stdout.write(`  ✓ ${path.relative(REPO_ROOT, path.join(dir, 'captions.md'))} + meta.json\n`)
      ok++
    } catch (err) {
      process.stderr.write(`  ✗ ${title}: ${err.message}\n`)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  }
  process.stdout.write(`Done: ${ok}/${jobs.length} piece(s).\n`)
  if (ok === 0) process.exit(1)
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`)
  process.exit(1)
})
