#!/usr/bin/env node
// Publish one finished piece: make the three web images from the 4K still,
// upload them and the video to R2 under keys that are never overwritten, and
// append the `gallery.json` entry.
//
//   node curation/publish-piece.mjs \
//     --still gallery/<name>_4k.webp --video gallery/<name>_animated.mp4 \
//     --title "Autumn Portage - Group of Seven (AI Animated)" --tag Modern \
//     --image-prompt "$IMG_PROMPT" --video-prompt "$VID_PROMPT"
//
// A real public-domain painting passes --provenance (a JSON file of the
// provenance keys) instead of --image-prompt.
//
//   node curation/publish-piece.mjs \
//     --still gallery/<name>_4k.webp --video gallery/<name>_animated.mp4 \
//     --title "Paris Street; Rainy Day - Gustave Caillebotte (AI Animated)" \
//     --tag "19th Century" --provenance gallery/<name>.provenance.json \
//     --video-prompt "$VID_PROMPT"
//
// Uploaded to R2 (the 4K master is not):
//   <stem>_2k.webp    -> img     archival high-res copy
//   <stem>_720p.jpeg  -> og_img  social cards (JPEG: crawlers and satori handle WebP badly)
//   <stem>_640w.webp  -> thumb   the /gallery grid
//   <stem>_{animated,looping}.mp4 -> src
//
// Requires: ffmpeg, and CLOUDFLARE_API_TOKEN via curation/with-secrets.sh.

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const GALLERY = path.join(ROOT, 'gallery.json')
const BUCKET = 'screensaver-assets'
const BASE = 'https://screensaver-assets.living-art-asset.com/'

// Read from @screensaver-art/constants so they can't drift from the website and app.
const CONSTANTS_SRC = readFileSync(path.join(ROOT, 'packages/constants/src/gallery.ts'), 'utf8')
function constList(name) {
  const block = CONSTANTS_SRC.match(new RegExp(`export const ${name}\\b[^=]*=\\s*\\[([\\s\\S]*?)\\]`))
  if (!block) die(`could not parse ${name} from packages/constants/src/gallery.ts`)
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}
const PROVENANCE = constList('PROVENANCE_FIELDS')
const REQUIRED = constList('REQUIRED_PROVENANCE_FIELDS')
const LICENSES = constList('ART_LICENSES')

const USAGE = `usage: node curation/publish-piece.mjs \\
  --still <4k.webp> --video <mp4> --title <title> --tag <wing> \\
  (--image-prompt <text> | --provenance <file.json>) --video-prompt <text> \\
  [--date YYYY-MM-DD] [--looping|--no-looping] [--stem <name>] \\
  [--dry-run] [--keep] [--resume]

  --image-prompt  the prompt the still was generated from (AI pieces).
  --provenance    a REAL public-domain painting instead: a JSON file holding
                  ${PROVENANCE.join(', ')}.
                  Required: ${REQUIRED.join(', ')};
                  source must be "real_artwork", license one of ${LICENSES.map((l) => `"${l}"`).join(' / ')}.
                  Title as "<painting> - <artist> (AI Animated)". No image prompt is written.
  --looping    defaults to the video filename (_looping.mp4 -> true,
               _animated.mp4 -> false); pass explicitly for any other name.
  --stem       R2 key stem, defaults to the still's basename minus _4k.
  --dry-run    derive + validate only: no upload, no gallery.json write, keeps files.
  --keep       don't delete the local still/video/derivatives on success.
  --resume     retrying this same piece — skip keys already on R2 instead of failing.`

function die(msg) {
  process.stderr.write(`publish-piece: ${msg}\n`)
  process.exit(1)
}

// ---- args ------------------------------------------------------------------

const argv = process.argv.slice(2)
const opts = {}
const bools = new Set(['dry-run', 'keep', 'resume', 'looping', 'no-looping'])
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (!a.startsWith('--')) die(`unexpected argument "${a}"\n\n${USAGE}`)
  const name = a.slice(2)
  if (bools.has(name)) { opts[name] = true; continue }
  const v = argv[++i]
  if (v === undefined) die(`--${name} needs a value\n\n${USAGE}`)
  opts[name] = v
}

const DRY = !!opts['dry-run']
const KEEP = !!opts.keep
const RESUME = !!opts.resume

// Exactly one of --image-prompt (AI piece) and --provenance (real painting).
const REAL = !!opts.provenance
if (REAL && opts['image-prompt']) {
  die('--provenance is for a real painting, which has no image prompt — drop --image-prompt')
}
for (const req of ['still', 'video', 'title', 'tag', REAL ? null : 'image-prompt', 'video-prompt']) {
  if (req && !opts[req]) die(`missing --${req}${req === 'image-prompt' ? ' (or --provenance for a real painting)' : ''}\n\n${USAGE}`)
}
if (opts.looping && opts['no-looping']) die('--looping and --no-looping are mutually exclusive')

const still = path.resolve(opts.still)
const video = path.resolve(opts.video)
for (const [label, f] of [['still', still], ['video', video]]) {
  if (!existsSync(f)) die(`${label} not found: ${f}`)
  if (statSync(f).size === 0) die(`${label} is empty: ${f}`)
}
if (!/\.mp4$/i.test(video)) die(`--video must be an .mp4, got "${path.basename(video)}"`)

// The tag list is closed: each tag is a filter pill.
const TAGS = constList('TAG_ORDER')
if (!TAGS.includes(opts.tag)) {
  die(`unknown tag "${opts.tag}" — never invent a wing. Valid:\n  ${TAGS.join('\n  ')}`)
}

// Validate provenance before any ffmpeg or R2 work, and keep the keys in order.
const provenance = REAL ? readProvenance(path.resolve(opts.provenance)) : null

function readProvenance(file) {
  if (!existsSync(file)) die(`provenance file not found: ${file}`)
  let raw
  try { raw = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { die(`provenance file is not valid JSON (${file}): ${e.message}`) }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) die(`provenance file must hold a JSON object: ${file}`)

  const ignored = Object.keys(raw).filter((k) => !PROVENANCE.includes(k))
  if (ignored.length) {
    process.stderr.write(`publish-piece: WARNING — ignoring unknown provenance key(s): ${ignored.join(', ')} ` +
      `(only ${PROVENANCE.join(', ')} are copied)\n`)
  }
  const out = {}
  for (const key of PROVENANCE) {
    const v = raw[key]
    if (v === undefined || v === null || v === '') continue
    if (typeof v !== 'string') die(`provenance "${key}" must be a string, got ${JSON.stringify(v)}`)
    if (v.trim()) out[key] = v.trim()
  }
  const missing = REQUIRED.filter((k) => !out[k])
  if (missing.length) die(`provenance is missing required key(s): ${missing.join(', ')}`)
  if (out.source !== 'real_artwork') die(`provenance "source" must be "real_artwork", got "${out.source}"`)
  if (!LICENSES.includes(out.license)) {
    die(`provenance "license" must be one of ${LICENSES.map((l) => `"${l}"`).join(' / ')} — got "${out.license}". ` +
      'Anything weaker (CC-BY, "No Known Copyright", unknown…) is not eligible; see "The legal gate" in REAL_PAINTINGS_CURATION.md.')
  }
  if (!/^https?:\/\/\S+$/i.test(out.source_url)) die(`provenance "source_url" must be an http(s) URL, got "${out.source_url}"`)

  // The website and captions split the title on the artist's name.
  const esc = out.artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!new RegExp(`^.+ - ${esc} \\(AI Animated\\)$`).test(opts.title)) {
    die(`a real painting's title must read "<painting> - ${out.artist} (AI Animated)", got "${opts.title}"`)
  }
  return out
}

const stem = opts.stem || path.basename(still).replace(/\.[a-z0-9]+$/i, '').replace(/_4k$/i, '')
if (!/^[a-z0-9_]+$/i.test(stem)) die(`stem "${stem}" must be alphanumeric + underscores`)

const looping = opts.looping ? true
  : opts['no-looping'] ? false
  : /_looping\.mp4$/i.test(video) ? true
  : /_animated\.mp4$/i.test(video) ? false
  : die(`can't infer looping from "${path.basename(video)}" — pass --looping or --no-looping`)

const date = opts.date || (() => {
  // Local date: a late-evening run must still stamp today.
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
})()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) die(`--date must be YYYY-MM-DD, got "${date}"`)

// ---- plan ------------------------------------------------------------------

const dir = path.dirname(still)
// The key's suffix comes from `looping`, not the local filename.
const videoKey = `gallery/${stem}${looping ? '_looping' : '_animated'}.mp4`

/** field -> the derivative that fills it. */
const derivatives = [
  {
    field: 'img', file: path.join(dir, `${stem}_2k.webp`), key: `gallery/${stem}_2k.webp`,
    ct: 'image/webp', filter: 'scale=2048:-2', extra: ['-quality', '86'],
  },
  {
    field: 'og_img', file: path.join(dir, `${stem}_720p.jpeg`), key: `gallery/${stem}_720p.jpeg`,
    ct: 'image/jpeg', extra: ['-q:v', '4'],
    filter: 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720',
  },
  {
    field: 'thumb', file: path.join(dir, `${stem}_640w.webp`), key: `gallery/${stem}_640w.webp`,
    ct: 'image/webp', filter: 'scale=640:-2', extra: ['-quality', '82'],
  },
]

const uploads = [
  ...derivatives.map((d) => ({ ...d, src: d.file })),
  { field: 'src', src: video, key: videoKey, ct: 'video/mp4' },
]

// ---- r2 --------------------------------------------------------------------

function wrangler(args) {
  const r = spawnSync('bash', [
    path.join(ROOT, 'curation/with-secrets.sh'), 'CLOUDFLARE_API_TOKEN', '--',
    'npx', '--yes', 'wrangler', 'r2', 'object', ...args,
  ], { encoding: 'utf8' })
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') }
}

const existsOnR2 = (key) =>
  wrangler(['get', `${BUCKET}/${key}`, '--file=/dev/null', '--remote']).ok

const putOnR2 = (file, key, ct) => wrangler([
  'put', `${BUCKET}/${key}`, `--file=${file}`, '--remote',
  // Keys are never overwritten, so cache them for a year.
  '--cache-control', 'public, max-age=31536000, immutable',
  '--content-type', ct,
])

// ---- run -------------------------------------------------------------------

process.stdout.write(`publishing "${opts.title}"\n  stem ${stem} · ${looping ? 'looping' : 'non-looping'} · ${date} · ${opts.tag}` +
  `${provenance ? ` · real painting (${provenance.museum}, ${provenance.license})` : ''}\n`)

// 1. Derive (local, before touching the network).
for (const d of derivatives) {
  const r = spawnSync('ffmpeg',
    ['-v', 'error', '-y', '-i', still, '-vf', d.filter, ...d.extra, d.file],
    { encoding: 'utf8' })
  if (r.status !== 0 || !existsSync(d.file) || statSync(d.file).size === 0) {
    die(`ffmpeg failed for ${d.field} (${path.basename(d.file)}):\n${r.stderr || r.stdout || ''}`)
  }
  process.stdout.write(`  derived ${path.basename(d.file)} (${(statSync(d.file).size / 1e3).toFixed(0)} kB)\n`)
}

// 2. Check every key first, so a name collision can't leave a half-published piece.
const skip = new Set()
if (!DRY) {
  const taken = uploads.filter((u) => existsOnR2(u.key))
  if (taken.length && !RESUME) {
    die(`these R2 keys already exist — pick a different name and retry with ` +
        `--stem <name> (or --resume if this is a retry of this same piece):\n  ` +
        taken.map((t) => t.key).join('\n  '))
  }
  for (const t of taken) {
    skip.add(t.key)
    process.stdout.write(`  skipping ${t.key} (already on R2, --resume)\n`)
  }
}

// 3. Upload.
if (DRY) {
  process.stdout.write(`  DRY RUN — would upload:\n${uploads.map((u) => `    ${u.key}`).join('\n')}\n`)
} else {
  for (const u of uploads) {
    if (skip.has(u.key)) continue
    const r = putOnR2(u.src, u.key, u.ct)
    if (!r.ok) {
      die(`upload failed for ${u.key}:\n${r.out.slice(-500)}\n\n` +
          `Nothing was written to gallery.json. Re-run with --resume to finish ` +
          `the remaining keys (already-uploaded ones will be skipped).`)
    }
    process.stdout.write(`  uploaded ${u.key}\n`)
  }
}

// 4. Append the entry.
const entry = {
  src: BASE + videoKey,
  img: BASE + `gallery/${stem}_2k.webp`,
  og_img: BASE + `gallery/${stem}_720p.jpeg`,
  thumb: BASE + `gallery/${stem}_640w.webp`,
  title: opts.title,
  type: 'video',
  date,
  tags: [opts.tag],
  // AI piece: its image prompt. Real painting: its provenance.
  ...(provenance ?? { image_prompt: opts['image-prompt'] }),
  video_prompt: opts['video-prompt'],
  looping,
}

if (DRY) {
  process.stdout.write(`  DRY RUN — would append:\n${JSON.stringify(entry, null, 2)}\n`)
} else {
  const items = JSON.parse(readFileSync(GALLERY, 'utf8'))
  if (!Array.isArray(items)) die('gallery.json is not an array')
  if (items.some((i) => i.src === entry.src)) die(`gallery.json already has ${entry.src}`)
  items.push(entry) // append: keeps the file sorted by date
  writeFileSync(GALLERY, JSON.stringify(items, null, 2) + '\n')
  process.stdout.write(`  appended to gallery.json (${items.length} pieces)\n`)
}

// 5. Delete the local media. `${video}.json` is the video skill's sidecar.
if (!DRY && !KEEP) {
  const removed = []
  for (const f of [still, video, `${video}.json`, ...derivatives.map((d) => d.file)]) {
    if (!existsSync(f)) continue
    rmSync(f, { force: true })
    removed.push(path.basename(f))
  }
  process.stdout.write(`  cleaned up ${removed.length} local files: ${removed.join(', ')}\n`)

  // Leftovers are usually rejected stills. Flag them; don't delete files we weren't given.
  const left = readdirSync(dir).filter((f) => !f.startsWith('.'))
  if (left.length) {
    process.stdout.write(
      `  NOTE: ${left.length} file(s) left in ${path.relative(ROOT, dir) || dir} — ` +
      `delete any rerolled stills before the next piece:\n    ${left.join('\n    ')}\n`)
  }
}

process.stdout.write(`${DRY ? 'DRY RUN — nothing published' : 'done'}\n`)
