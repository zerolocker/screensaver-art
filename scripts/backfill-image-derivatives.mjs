#!/usr/bin/env node
// One-off backfill (already run): make the website's image derivatives for
// every gallery piece from frame 0 of its clip, and upload them to R2. New
// pieces get them from curation/publish-piece.mjs.
//   og_img  1280x720 JPEG  social cards (JPEG: crawlers and satori handle WebP badly)
//   thumb   640w WebP      the /gallery grid; the right size at every breakpoint
//   img     native WebP    piece-page hero (`_hero.webp`), only where missing
// It only adds keys; existing objects are never touched.
//
// Run:
//   node scripts/backfill-image-derivatives.mjs --limit 3          # smoke test
//   node scripts/backfill-image-derivatives.mjs --dry-run
//   node scripts/backfill-image-derivatives.mjs                    # the real run
//   node scripts/backfill-image-derivatives.mjs --resume           # skip done work
//
// Requires: ffmpeg, and CLOUDFLARE_API_TOKEN via curation/with-secrets.sh.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const GALLERY = path.join(ROOT, 'gallery.json')
const BUCKET = 'screensaver-assets'
const BASE = 'https://screensaver-assets.living-art-asset.com/'
// Outside the repo: media must never land in git.
const WORK = path.join(process.env.TMPDIR || '/tmp', 'lart-backfill')

const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const DRY = flag('--dry-run')
const RESUME = flag('--resume')
const LIMIT = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : Infinity

const raw = JSON.parse(readFileSync(GALLERY, 'utf8'))
const items = Array.isArray(raw) ? raw : raw.items

/** The clip's full filename stem. Stripping _animated/_looping could collide. */
const stemOf = (src) => src.split('/').pop().replace(/\.[a-z0-9]+$/i, '')

function sh(cmd, argv) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8' })
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') }
}

/** Whether the key exists on R2. Keys are never overwritten. */
function existsOnR2(key) {
  const r = sh('bash', [
    path.join(ROOT, 'curation/with-secrets.sh'), 'CLOUDFLARE_API_TOKEN', '--',
    'npx', '--yes', 'wrangler', 'r2', 'object', 'get', `${BUCKET}/${key}`,
    '--file=/dev/null', '--remote',
  ])
  return r.ok
}

function uploadToR2(file, key, contentType) {
  if (DRY) return true
  const r = sh('bash', [
    path.join(ROOT, 'curation/with-secrets.sh'), 'CLOUDFLARE_API_TOKEN', '--',
    'npx', '--yes', 'wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`,
    `--file=${file}`, '--remote',
    '--cache-control', 'public, max-age=31536000, immutable',
    '--content-type', contentType,
  ])
  if (!r.ok) process.stderr.write(`    upload failed ${key}: ${r.out.slice(-300)}\n`)
  return r.ok
}

/** Frame 0, streamed from the URL. `-ss 0` before `-i` keeps it to a keyframe read. */
function frame0(url, out, filter, extra = []) {
  const r = sh('ffmpeg', ['-v', 'error', '-y', '-i', url, '-frames:v', '1', '-vf', filter, ...extra, out])
  return r.ok && existsSync(out) && statSync(out).size > 0
}

function probeSize(url) {
  const r = sh('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries',
    'stream=width,height', '-of', 'csv=p=0', url])
  const [w, h] = (r.out.trim().split('\n')[0] || '').split(',').map(Number)
  return Number.isFinite(w) && Number.isFinite(h) ? { w, h } : null
}

mkdirSync(WORK, { recursive: true })

const todo = items.slice(0, LIMIT === Infinity ? undefined : LIMIT)
let done = 0, skipped = 0, failed = 0, uploaded = 0, bytes = 0
const started = Date.now()
const fails = []

for (const [i, it] of todo.entries()) {
  const stem = stemOf(it.src)
  const need = {
    og_img: !it.og_img || !RESUME,
    thumb: !it.thumb || !RESUME,
    img: !it.img,
  }
  if (RESUME && it.og_img && it.thumb && it.img) { skipped++; continue }

  const size = probeSize(it.src)
  if (!size) { failed++; fails.push(`${stem}: probe failed`); continue }

  const jobs = []
  // Crop to exactly 16:9 here rather than leave it to each platform.
  if (need.og_img) jobs.push({
    field: 'og_img', key: `gallery/${stem}_720p.jpeg`, file: path.join(WORK, `${stem}_720p.jpeg`),
    filter: 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720',
    extra: ['-q:v', '4'], ct: 'image/jpeg',
  })
  // Grid tile.
  if (need.thumb) jobs.push({
    field: 'thumb', key: `gallery/${stem}_640w.webp`, file: path.join(WORK, `${stem}_640w.webp`),
    filter: 'scale=640:-2', extra: ['-quality', '82'], ct: 'image/webp',
  })
  // Only where missing. Native width, capped at 1920 (never upscales).
  if (need.img) jobs.push({
    field: 'img', key: `gallery/${stem}_hero.webp`, file: path.join(WORK, `${stem}_hero.webp`),
    filter: `scale=${Math.min(size.w, 1920)}:-2`, extra: ['-quality', '86'], ct: 'image/webp',
  })

  for (const j of jobs) {
    if (!frame0(it.src, j.file, j.filter, j.extra)) { failed++; fails.push(`${stem}/${j.field}: ffmpeg`); continue }
    bytes += statSync(j.file).size
    if (!DRY && existsOnR2(j.key)) { failed++; fails.push(`${stem}/${j.field}: key exists`); rmSync(j.file, { force: true }); continue }
    if (!uploadToR2(j.file, j.key, j.ct)) { failed++; fails.push(`${stem}/${j.field}: upload`); rmSync(j.file, { force: true }); continue }
    it[j.field] = BASE + j.key
    uploaded++
    rmSync(j.file, { force: true }) // never leave generated media lying around
  }
  done++
  if (done % 10 === 0 || i === todo.length - 1) {
    const el = ((Date.now() - started) / 1000).toFixed(0)
    process.stdout.write(`  ${done}/${todo.length} pieces · ${uploaded} uploaded · ${failed} failed · ${el}s\n`)
  }
}

if (!DRY) writeFileSync(GALLERY, JSON.stringify(raw, null, 2) + '\n')

process.stdout.write(
  `\n${DRY ? 'DRY RUN — ' : ''}pieces ${done}, skipped ${skipped}, uploads ${uploaded}, failed ${failed}\n` +
  `derivative bytes generated: ${(bytes / 1e6).toFixed(1)} MB\n`)
if (fails.length) process.stdout.write(`failures:\n  ${fails.slice(0, 20).join('\n  ')}\n`)
