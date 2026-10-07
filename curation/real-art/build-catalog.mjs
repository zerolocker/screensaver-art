#!/usr/bin/env node
// Build the real-paintings catalog: search all eight sources for their most
// famous works, clear every one from scratch through the legal gate, and write
// the ones that pass to curation/real-art/catalog.json. Metadata only, no images.
// The monthly refresh runs it (curation/REAL_PAINTINGS_CATALOG.md); the nightly
// reads the result through queue.mjs.
//
//   node curation/real-art/build-catalog.mjs --summary /tmp/catalog-summary.md
//
// It refuses to replace the catalog after a partial outage (a source failed or
// shrank by half), so a bad month keeps the last good catalog. --force writes it anyway.

import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { BLOCKLIST, CATALOG, gateFingerprint, queueTable, readBlocklist, readCatalog, upcoming } from './catalog.mjs'
import { cutoffYear, usCutoffYear } from './clearance.mjs'
import { log, parseArgs } from './lib.mjs'
import { finalize, findPaintings, inGallery, galleryIndex, readGallery, ROOT, SOURCES } from './search.mjs'

const DEFAULT_POOL = 200
const MIN_WORKS = 150 // over a month of nights at four a night
const SHRINK = 0.5 // a source passing under half last month's works is an outage, not a trend

const USAGE = `usage: node curation/real-art/build-catalog.mjs [--pool N] [--out <file>] [--summary <file.md>] [--force]

  --pool      famous candidates fetched per source (default ${DEFAULT_POOL}; Commons takes 3x).
  --out       default curation/real-art/catalog.json.
  --summary   also write a Markdown report (sources, what was added and removed,
              the top of the queue): the refresh PR's description.
  --force     write the catalog even if a source failed or shrank by half.`

function die(msg) {
  process.stderr.write(`build-catalog: ${msg}\n`)
  process.exit(1)
}

const opts = parseArgs(process.argv.slice(2), new Set(['force']), USAGE, die)
const pool = Number(opts.pool ?? DEFAULT_POOL)
if (!Number.isInteger(pool) || pool < 1) die('--pool must be a positive integer')
const out = path.resolve(opts.out || CATALOG)
const rel = (f) => path.relative(ROOT, f)

const previous = (() => { try { return readCatalog(out) } catch { return null } })()
const gallery = readGallery()
const started = new Date()
log(`build-catalog: famous · all sources · pool ${pool}/source · cutoff: died <= ${cutoffYear()}${previous ? ` · replacing the catalog of ${previous.built_at.slice(0, 10)}` : ''}`)

const res = await findPaintings({ sources: Object.keys(SOURCES), famous: true, pool, gallery })
const seconds = Math.round((Date.now() - started) / 1000)

// ---- health ----------------------------------------------------------------

const sourceOf = (id) => (id.startsWith('wd:') ? 'commons' : id.split(':')[0])
// Stored by object_id, so a refresh diffs cleanly. The order (and fame.wing_rank)
// is worked out when the queue is read, over the works still to come.
const works = res.ranked.map(finalize)
  .map((w) => ({ ...w, fame: { wikipedia_langs: w.fame.wikipedia_langs, highlight: w.fame.highlight } }))
  .sort((a, b) => a.object_id.localeCompare(b.object_id))
const sources = {}
for (const s of res.perSource) {
  sources[s.key] = {
    checked: s.cands.length,
    passed: s.cands.filter((c) => c.clearance?.pass).length,
    in_catalog: works.filter((w) => sourceOf(w.object_id) === s.key).length,
  }
}
const problems = []
for (const s of res.perSource) {
  if (s.failed) problems.push(`${s.key} failed: ${s.error.slice(0, 200)}`)
  else if (!s.cands.length) problems.push(`${s.key} returned no candidates`)
  if (s.fameOk === false) problems.push(`${s.key}: the Wikidata fame lookup failed, so its works can't be ranked`)
  for (const n of s.notes) problems.push(`${s.key}: ${n}`)
  const before = previous?.build?.sources?.[s.key]?.passed
  if (before >= 20 && sources[s.key].passed < SHRINK * before) {
    problems.push(`${s.key}: ${sources[s.key].passed} works passed the gate, against ${before} last time`)
  }
}
if (res.tripped.length) problems.push(`walled off by ${res.tripped.join(', ')}; their records are missing`)
if (works.length < MIN_WORKS) problems.push(`only ${works.length} works passed, under the ${MIN_WORKS} a month needs`)

for (const [k, s] of Object.entries(sources)) log(`  ${k}: ${s.checked} checked, ${s.passed} passed the gate, ${s.in_catalog} in the catalog`)
log(`  ${works.length} works · ${Math.round(seconds / 60)} min`)
if (problems.length) {
  for (const p of problems) log(`  !! ${p}`)
  if (!opts.force) die(`not writing ${rel(out)}: the build looks partial (above). Wait and run it again; --force writes it anyway.`)
  log('  --force: writing it anyway')
}

// ---- write -----------------------------------------------------------------

const catalog = {
  built_at: started.toISOString(),
  gate: { cutoff_year: cutoffYear(), us_cutoff_year: usCutoffYear(), clearance_sha256: gateFingerprint() },
  build: { pool, seconds, sources, ...(problems.length ? { problems } : {}) },
  works,
}
const json = `${JSON.stringify(catalog, null, 2)}\n`
writeFileSync(out, json)
log(`  wrote ${rel(out)} (${works.length} works, ${(Buffer.byteLength(json) / 1e6).toFixed(1)} MB)`)

// ---- summary ---------------------------------------------------------------

if (opts.summary) {
  const gi = galleryIndex(gallery)
  const before = new Map((previous?.works || []).map((w) => [w.object_id, w]))
  const now = new Set(works.map((w) => w.object_id))
  const rejected = new Map(res.rejects.map((c) => [c.object_id, c]))
  const dupes = new Map(res.dupes.map((d) => [d.object_id, d.why]))
  const label = (w) => `\`${w.object_id}\` ${w.original_title} — ${w.artist}`
  const added = works.filter((w) => !before.has(w.object_id))
  const removed = [...before.values()].filter((w) => !now.has(w.object_id)).map((w) => {
    const why = inGallery(w, gi) ? 'published'
      : rejected.has(w.object_id) ? `fails the gate now: ${rejected.get(w.object_id).clearance.reasons[0]}`
        : dupes.has(w.object_id) ? dupes.get(w.object_id)
          : "not among this month's famous candidates"
    return `${label(w)}: ${why}`
  })
  const list = (items, n = 60) => [...items.slice(0, n).map((s) => `- ${s}`), ...(items.length > n ? [`- …and ${items.length - n} more`] : [])].join('\n')
  const { queue, blocked } = upcoming(catalog, { gallery, blocklist: readBlocklist(BLOCKLIST).entries })
  const md = `## Real-paintings catalog, built ${catalog.built_at.slice(0, 10)}

${works.length} cleared works${previous ? ` (${previous.works.length} before): ${added.length} added, ${removed.length} removed` : ''}. The build took ${Math.round(seconds / 60)} minutes. Every work was cleared again from scratch.
${problems.length ? `\n**Built with --force despite these problems:**\n${list(problems)}\n` : ''}
| Source | Checked | Passed the gate | In the catalog |
|---|---:|---:|---:|
${Object.entries(sources).map(([k, s]) => `| ${k} | ${s.checked} | ${s.passed} | ${s.in_catalog} |`).join('\n')}

${removed.length ? `### Removed\n\n${list(removed)}\n\n` : ''}${added.length && previous ? `### Added\n\n${list(added.map(label))}\n\n` : ''}### The queue after this refresh

${queue.length} works to come${blocked.length ? `; ${blocked.length} blocked by \`blocklist.txt\`` : ''}. To veto one, add its ID to \`curation/real-art/blocklist.txt\`.

${queueTable(queue.slice(0, 30))}
`
  writeFileSync(path.resolve(opts.summary), md)
  log(`  wrote the summary to ${opts.summary}`)
}
