#!/usr/bin/env node
// Step 4 of the real-paintings nightly curation: hang one cleared artwork on a
// 3840x2160 near-black "dark wall" — the still Veo animates and publish-piece
// derives the web images from. The artwork is scaled to *contain* (never cropped),
// centred, and never upscaled or extended: the only resampling is a lanczos
// downscale, so no detail is invented. A source smaller than the fit box hangs at
// its native size with more wall around it.
//
//   node curation/real-art/frame-painting.mjs --candidates /tmp/cands.json --id aic:20684
//   node curation/real-art/frame-painting.mjs --record piece.json --stem monet_haystacks --margin 0.04
//
// Writes gallery/<stem>_4k.webp + gallery/<stem>.provenance.json (the gallery
// provenance keys only) and deletes the raw download. gallery/ is gitignored.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MIN_LONG_EDGE } from './clearance.mjs'
import { download, fold, http, HttpError, log, parseArgs, pickProvenance, slug } from './lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const W = 3840
const H = 2160
const WALL = '0x0b0b0d'

const USAGE = `usage: node curation/real-art/frame-painting.mjs \\
  (--candidates <file.json> --id <src:id> | --record <file.json>) \\
  [--stem <name>] [--margin <fraction>] [--out-dir <dir>]

  --candidates/--id  pick one record (by object_id) from find-paintings output.
  --record           a JSON file holding one record (or a one-element array).
  --stem             output name; default <artist surname>_<short title slug>.
  --margin           wall showing on every side, as a fraction of the canvas
                     height (default 0 = the artwork touches the nearer edges).
  --out-dir          default gallery/ (gitignored).`

function die(msg) {
  process.stderr.write(`frame-painting: ${msg}\n`)
  process.exit(1)
}

const opts = parseArgs(process.argv.slice(2), new Set(), USAGE, die)

// ---- record ----------------------------------------------------------------

function loadJson(f) {
  try { return JSON.parse(readFileSync(path.resolve(f), 'utf8')) } catch (e) { die(`can't read ${f}: ${e.message}`) }
}
let rec
if (opts.record) {
  const r = loadJson(opts.record)
  rec = Array.isArray(r) ? (r.length === 1 ? r[0] : die('--record file holds an array — use --candidates + --id')) : r
} else if (opts.candidates && opts.id) {
  const all = loadJson(opts.candidates)
  if (!Array.isArray(all)) die(`${opts.candidates} is not a JSON array`)
  rec = all.find((r) => r.object_id === opts.id) || die(`${opts.id} not found in ${opts.candidates}`)
} else {
  die(`give --candidates <file> --id <src:id>, or --record <file>\n\n${USAGE}`)
}
// The frame step is downstream of the legal gate: never frame an uncleared work.
if (rec.clearance?.pass !== true) {
  die(`${rec.object_id} has not passed clearance:\n  ${(rec.clearance?.reasons || ['no clearance on record']).join('\n  ')}`)
}
if (!rec.image_url) die(`${rec.object_id} has no image_url`)

const margin = Number(opts.margin ?? 0)
if (!(margin >= 0 && margin < 0.45)) die('--margin must be a fraction in [0, 0.45)')

/** caillebotte_paris_street_rainy_day */
function defaultStem(r) {
  const artist = String(r.artist || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^(attributed to|workshop of|studio of|circle of|follower of|school of|manner of|after|copy after)\s+/i, '')
    .replace(/\b(the (elder|younger)|and (workshop|studio|assistants?)|jr\.?|sr\.?|[ivx]+)\s*$/i, '')
  const tokens = slug(artist, 20).split('_').filter(Boolean)
  const surname = /unknown|unidentified|anonymous/i.test(artist) || !tokens.length ? 'anon' : tokens[tokens.length - 1]
  const title = fold(r.original_title)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/,?\s+(from|also known as)\b.*$/, '')
    .replace(/^(the|a|an)\s+/, '')
  return `${surname}_${slug(title, 5)}`.replace(/_+$/, '')
}
const stem = opts.stem || defaultStem(rec)
if (!/^[a-z0-9_]+$/i.test(stem)) die(`stem "${stem}" must be alphanumeric + underscores (pass --stem)`)

const outDir = path.resolve(opts['out-dir'] || path.join(ROOT, 'gallery'))
mkdirSync(outDir, { recursive: true })
const outStill = path.join(outDir, `${stem}_4k.webp`)
const outProv = path.join(outDir, `${stem}.provenance.json`)

// ---- which URL(s) to try ---------------------------------------------------

/**
 * AIC IIIF: the largest size served for a public-domain work is its native width,
 * requested explicitly (`full/full` and `max` are WAF-blocked with an HTML 403;
 * native+1 px is a 403 — checked 2026-10-03), bounded by the server's advertised
 * maxArea. Non-PD works redirect to an 843px cap, so redirects are refused and we
 * step down the advertised `sizes` instead. Never a width above native (that
 * would be the server upscaling).
 */
async function aicAttempts(url) {
  const m = url.match(/^(https:\/\/www\.artic\.edu\/iiif\/2\/[^/]+)\//)
  if (!m) return [{ url }]
  const info = await http(`${m[1]}/info.json`)
  const long = Math.max(info.width, info.height)
  const maxArea = (info.profile || []).find((p) => p && typeof p === 'object' && p.maxArea)?.maxArea
  const top = maxArea ? Math.min(info.width, Math.floor(Math.sqrt((maxArea * info.width) / info.height))) : info.width
  const widths = [top, ...(info.sizes || []).map((s) => s.width).filter((w) => w < top).sort((a, b) => b - a)]
  return [...new Set(widths)]
    .filter((w) => Math.round((w * long) / info.width) >= MIN_LONG_EDGE)
    .map((w) => ({ url: `${m[1]}/full/${w},/0/default.jpg`, redirect: 'manual' }))
}

function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file], { encoding: 'utf8' })
  if (r.status !== 0) return null
  const s = JSON.parse(r.stdout || '{}').streams?.[0]
  return s?.width && s?.height ? { width: s.width, height: s.height } : null
}

// ---- run -------------------------------------------------------------------

log(`framing ${rec.object_id} "${rec.original_title}" — ${rec.artist} -> ${path.relative(ROOT, outStill)}`)
const attempts = rec.object_id.startsWith('aic:') ? await aicAttempts(rec.image_url) : [{ url: rec.image_url }]
if (!attempts.length) die(`no served size of ${rec.object_id} reaches ${MIN_LONG_EDGE}px`)

let src = null
let failure = null
let encoding = false
const tmp = path.join(outDir, `${stem}_src.download`)
// process.exit() would skip the finally-cleanup below, so failures throw and the
// script exits only after the raw download is gone.
const fail = (msg) => { throw new Error(msg) }
try {
  for (const a of attempts) {
    try {
      const got = await download(a.url, tmp, { redirect: a.redirect || 'follow' })
      const ext = /png/i.test(got.contentType) ? 'png' : /tiff?/i.test(got.contentType) ? 'tif' : 'jpg'
      src = path.join(outDir, `${stem}_src.${ext}`)
      renameSync(tmp, src)
      break
    } catch (e) {
      rmSync(tmp, { force: true })
      if (!(e instanceof HttpError)) throw e
      log(`  ${a.url} -> ${e.message.replace(/^GET \S+: /, '')}; trying the next size down`)
    }
  }
  if (!src) fail(`couldn't download any size of ${rec.object_id}`)
  const dims = probe(src) || fail(`ffprobe can't read ${path.basename(src)} — not an image?`)
  const long = Math.max(dims.width, dims.height)
  log(`  downloaded ${dims.width}×${dims.height} (${(statSync(src).size / 1e6).toFixed(1)} MB)`)
  if (long < MIN_LONG_EDGE) fail(`long edge ${long}px < ${MIN_LONG_EDGE}px — too small for a 4K wall; pick another work (never upscale a real artwork)`)

  // Contain-fit inside the margin box, capped at 1:1 (never upscale); even
  // dimensions keep the 4:2:0 chroma grid aligned with the wall so the painting's
  // edge stays crisp.
  const inset = Math.round(margin * H)
  const scale = Math.min(1, (W - 2 * inset) / dims.width, (H - 2 * inset) / dims.height)
  const sw = Math.min(W - 2 * inset, 2 * Math.floor((dims.width * scale) / 2))
  const sh = Math.min(H - 2 * inset, 2 * Math.floor((dims.height * scale) / 2))
  const x = (W - sw) / 2
  const y = (H - sh) / 2
  const vf = `scale=${sw}:${sh}:flags=lanczos+accurate_rnd+full_chroma_int,format=rgb24,` +
    `pad=${W}:${H}:${x}:${y}:color=${WALL}`
  encoding = true
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', vf, '-frames:v', '1',
    '-c:v', 'libwebp', '-quality', '95', '-compression_level', '6', '-preset', 'picture', outStill], { encoding: 'utf8' })
  if (r.status !== 0 || !existsSync(outStill) || statSync(outStill).size === 0) {
    fail(`ffmpeg failed:\n${r.stderr || r.stdout || ''}`)
  }
  const out = probe(outStill)
  if (out?.width !== W || out?.height !== H) fail(`unexpected output size ${out?.width}×${out?.height}`)

  writeFileSync(outProv, `${JSON.stringify(pickProvenance(rec), null, 2)}\n`)
  const kind = scale < 1 ? `lanczos downscale ×${scale.toFixed(3)}` : 'native size (smaller than the fit box; never upscaled)'
  const fit = scale === 1 ? 'hung at native size' : sw === W - 2 * inset ? (sh < H - 2 * inset ? 'letterboxed' : 'full-bleed') : 'pillarboxed'
  log(`  placed ${sw}×${sh} at (${x},${y}) — ${fit}, ${kind}`)
  log(`  wrote ${path.relative(ROOT, outStill)} (${(statSync(outStill).size / 1e6).toFixed(1)} MB) + ${path.relative(ROOT, outProv)}`)
  process.stdout.write(`${JSON.stringify({ still: outStill, provenance: outProv, stem, source: dims, placed: { width: sw, height: sh, x, y }, scale: Number(scale.toFixed(4)) })}\n`)
} catch (e) {
  if (encoding) rmSync(outStill, { force: true }) // a half-written still; never an older good one
  failure = e
} finally {
  // Never leave the raw museum download lying around (CLAUDE.md: no media in the
  // repo, and gallery/ is the nightly scratch space).
  if (src) rmSync(src, { force: true })
  rmSync(tmp, { force: true })
}
if (failure) die(failure.message)
