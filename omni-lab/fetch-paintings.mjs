#!/usr/bin/env node
// Fetch the Omni Lab's test paintings: metadata + clearance through the repo's own
// curation/real-art/find-paintings.mjs, then the largest image each museum serves,
// stored UNFRAMED at <= 3840 px on the long edge (never upscaled).
//
//   node omni-lab/fetch-paintings.mjs            # skips paintings already on disk
//   node omni-lab/fetch-paintings.mjs --refresh  # re-run find-paintings + re-download
//
// Writes omni-lab/paintings/{<key>.jpg, <key>_thumb.jpg, paintings.json}.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { download, http, HttpError, log } from '../curation/real-art/lib.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const DIR = path.join(HERE, 'paintings')
const CANDS = path.join(DIR, 'candidates.json')
const INDEX = path.join(DIR, 'paintings.json')
const PY = process.env.OMNI_PYTHON || 'python3'
const MAX_EDGE = 3840

// The fixed test set: wide, near-square, tall and very tall shapes.
const IDS = [
  'aic:27992', // Seurat, A Sunday on La Grande Jatte
  'met:436575', // El Greco, View of Toledo
  'met:437881', // Vermeer, Young Woman with a Water Pitcher
  'aic:20684', // Caillebotte, Paris Street; Rainy Day
  'aic:24645', // Hokusai, The Great Wave
  'met:435809', // Bruegel, The Harvesters
  'met:10481', // Church, Heart of the Andes
  'aic:16146', // Toulouse-Lautrec, Equestrienne
  'met:39901', // Han Gan, Night-Shining White
  'met:12127', // Sargent, Madame X
]

// Short display titles (the museums' full titles can run to a paragraph).
const SHORT = {
  'aic:27992': 'A Sunday on La Grande Jatte', 'met:436575': 'View of Toledo',
  'met:437881': 'Young Woman with a Water Pitcher', 'aic:20684': 'Paris Street; Rainy Day',
  'aic:24645': 'The Great Wave', 'met:435809': 'The Harvesters', 'met:10481': 'Heart of the Andes',
  'aic:16146': 'Equestrienne', 'met:39901': 'Night-Shining White', 'met:12127': 'Madame X',
}

const refresh = process.argv.includes('--refresh')
mkdirSync(DIR, { recursive: true })

if (refresh || !existsSync(CANDS)) {
  log(`find-paintings --ids ${IDS.join(',')}`)
  const r = spawnSync(process.execPath, [path.join(ROOT, 'curation/real-art/find-paintings.mjs'),
    '--ids', IDS.join(','), '--show-rejects', '--out', CANDS], { stdio: ['ignore', 'inherit', 'inherit'] })
  if (r.status !== 0) { log('find-paintings failed'); process.exit(1) }
}
const cands = JSON.parse(readFileSync(CANDS, 'utf8'))

/** AIC IIIF blocks full/full: ask for the largest explicit width within maxArea (as frame-painting.mjs does). */
async function aicAttempts(url) {
  const m = url.match(/^(https:\/\/www\.artic\.edu\/iiif\/2\/[^/]+)\//)
  if (!m) return [{ url }]
  const info = await http(`${m[1]}/info.json`)
  const maxArea = (info.profile || []).find((p) => p && typeof p === 'object' && p.maxArea)?.maxArea
  const top = maxArea ? Math.min(info.width, Math.floor(Math.sqrt((maxArea * info.width) / info.height))) : info.width
  const widths = [top, ...(info.sizes || []).map((s) => s.width).filter((w) => w < top).sort((a, b) => b - a)]
  return [...new Set(widths)].map((w) => ({ url: `${m[1]}/full/${w},/0/default.jpg`, redirect: 'manual' }))
}

const shapeOf = (a) => a >= 1.7 ? 'very wide' : a >= 1.15 ? 'wide' : a > 0.95 ? 'near-square' : a >= 0.7 ? 'tall' : 'very tall'
const yearOf = (d) => (String(d ?? '').match(/\d{3,4}/) || [String(d ?? '')])[0]

// Resize to <= MAX_EDGE (never up) as JPEG q95 4:4:4, plus a 480px thumb. Prints {w,h,sw,sh}.
const RESIZE_PY = `
import sys, json
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
src, out, thumb, edge = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
im = Image.open(src).convert("RGB")
sw, sh = im.size
if max(im.size) > edge:
    im.thumbnail((edge, edge), Image.LANCZOS)
im.save(out, "JPEG", quality=95, subsampling=0)
t = im.copy(); t.thumbnail((480, 480), Image.LANCZOS); t.save(thumb, "JPEG", quality=85)
print(json.dumps({"w": im.size[0], "h": im.size[1], "sw": sw, "sh": sh}))
`

const index = existsSync(INDEX) && !refresh ? JSON.parse(readFileSync(INDEX, 'utf8')) : []
const byId = new Map(index.map((p) => [p.id, p]))
let failed = 0

for (const id of IDS) {
  const rec = cands.find((c) => c.object_id === id)
  if (!rec) { log(`!! ${id}: not in find-paintings output (rejected or duplicate?)`); failed++; continue }
  if (rec.clearance?.pass !== true) log(`!! ${id}: did not pass clearance (${(rec.clearance?.reasons || []).join('; ')}) — fetched anyway for testing`)
  const key = id.replace(':', '_')
  const file = `${key}.jpg`
  const thumb = `${key}_thumb.jpg`
  if (byId.has(id) && existsSync(path.join(DIR, file)) && existsSync(path.join(DIR, thumb))) {
    byId.get(id).short_title = SHORT[id] || rec.original_title
    log(`= ${id} ${rec.original_title} (already on disk)`)
    continue
  }
  log(`> ${id} ${rec.original_title} — ${rec.artist}`)
  const attempts = id.startsWith('aic:') ? await aicAttempts(rec.image_url) : [{ url: rec.image_url }]
  const tmp = path.join(DIR, `${key}.download`)
  let got = null
  for (const a of attempts) {
    try {
      await download(a.url, tmp, { redirect: a.redirect || 'follow' })
      got = a.url
      break
    } catch (e) {
      rmSync(tmp, { force: true })
      if (!(e instanceof HttpError)) throw e
      log(`  ${a.url} -> ${e.message.replace(/^GET \S+: /, '')}; trying the next size down`)
    }
  }
  if (!got) { log(`!! ${id}: no size downloaded`); failed++; continue }
  const r = spawnSync(PY, ['-c', RESIZE_PY, tmp, path.join(DIR, `${key}.tmp.jpg`), path.join(DIR, thumb), String(MAX_EDGE)], { encoding: 'utf8' })
  rmSync(tmp, { force: true })
  if (r.status !== 0) { log(`!! ${id}: resize failed: ${r.stderr}`); failed++; continue }
  renameSync(path.join(DIR, `${key}.tmp.jpg`), path.join(DIR, file))
  const d = JSON.parse(r.stdout.trim().split('\n').pop())
  const aspect = Math.round((d.w / d.h) * 1000) / 1000
  byId.set(id, {
    id, key, file, thumb,
    title: rec.original_title, short_title: SHORT[id] || rec.original_title, artist: rec.artist, artist_dates: rec.artist_dates,
    date: rec.original_date, year: yearOf(rec.original_date),
    museum: rec.museum, source_url: rec.source_url, license: rec.license,
    width: d.w, height: d.h, source_width: d.sw, source_height: d.sh,
    aspect, shape: shapeOf(aspect), image_url: got,
  })
  log(`  ${d.sw}×${d.sh} -> ${d.w}×${d.h} (${shapeOf(aspect)}, ${aspect})`)
  // Save after each painting so an interrupted fetch keeps what it got.
  writeFileSync(INDEX, `${JSON.stringify(IDS.map((i) => byId.get(i)).filter(Boolean), null, 2)}\n`)
}
writeFileSync(INDEX, `${JSON.stringify(IDS.map((i) => byId.get(i)).filter(Boolean), null, 2)}\n`)
log(`${byId.size}/${IDS.length} paintings in ${path.relative(ROOT, DIR)}/${failed ? ` (${failed} failed)` : ''}`)
process.exit(failed ? 1 : 0)
