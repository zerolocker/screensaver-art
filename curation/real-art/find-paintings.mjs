#!/usr/bin/env node
// Find public-domain artworks in seven museum collections and on Wikimedia
// Commons, run each through the copyright gate (clearance.mjs), rank the eligible
// ones by fame (taking turns by wing in famous runs), and write a JSON array for
// the curator. See curation/real-art/README.md.
//
//   node curation/real-art/find-paintings.mjs --famous --out /tmp/cands.json
//   node curation/real-art/find-paintings.mjs --query "harbor boats" --limit 30
//   node curation/real-art/find-paintings.mjs --ids aic:20684,met:435702,rijks:SK-C-5,wd:Q45585 --show-rejects
//
// Every record carries `clearance: {pass, reasons[], evidence{}}`. Only passing
// records are written unless --show-rejects (audit mode). The search itself is
// search.mjs, which the monthly catalog build (build-catalog.mjs) shares.

import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { cutoffYear } from './clearance.mjs'
import { log, parseArgs } from './lib.mjs'
import { MUSEUMS } from './museums.mjs'
import { finalize, findPaintings, GALLERY, readGallery, SOURCES } from './search.mjs'

const USAGE = `usage: node curation/real-art/find-paintings.mjs \\
  [--famous] [--query <theme keywords>] [--ids <src:id,...>] \\
  [--sources aic,cma,met,nga,rijks,getty,smk,commons] [--limit N] [--pool N] [--out <file.json>] [--show-rejects]

  --famous        surface each collection's most famous eligible works (Wikidata
                  Wikipedia-edition counts + museum highlight flags). Implied when
                  neither --query nor --ids is given. With --query: famous works
                  matching the theme only.
  --query         theme keywords, searched in every source.
  --ids           fetch + clear specific works: aic:<id>, met:<objectID>,
                  cma:<id or accession no.>, nga:<objectid or accession no.>,
                  rijks:<object no. or Linked Art ID>, getty:<page slug, UUID or
                  accession no.>, smk:<object no.>, wd:<Wikidata QID> (Commons)
                  (comma-separated). Rejections are always reported on stderr.
  --sources       subset of aic,cma,met,nga,rijks,getty,smk,commons (default all).
  --limit         max eligible records in the output (default 40).
  --pool          raw candidates to hydrate per source (default max(40, 2*limit);
                  Commons takes 3x).
  --out           write the JSON array here (default stdout).
  --show-rejects  audit mode: also output rejected records, with reasons.`

function die(msg) {
  process.stderr.write(`find-paintings: ${msg}\n`)
  process.exit(1)
}

const opts = parseArgs(process.argv.slice(2), new Set(['famous', 'show-rejects']), USAGE, die)
const sources = String(opts.sources || Object.keys(SOURCES).join(',')).split(',').map((s) => s.trim()).filter(Boolean)
for (const s of sources) if (!SOURCES[s]) die(`unknown source "${s}" (valid: ${Object.keys(SOURCES).join(', ')})`)
const limit = Number(opts.limit ?? 40)
if (!Number.isInteger(limit) || limit < 1) die('--limit must be a positive integer')
const pool = Number(opts.pool ?? Math.max(40, 2 * limit))
if (!Number.isInteger(pool) || pool < 1) die('--pool must be a positive integer')
const query = opts.query?.trim() || null
const SHOW_REJECTS = !!opts['show-rejects']

const idsBySource = {}
if (opts.ids) {
  for (const tok of String(opts.ids).split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = tok.match(new RegExp(`^(${[...Object.keys(SOURCES), 'wd'].join('|')}):(.+)$`))
    if (!m) die(`bad --ids entry "${tok}" — expected <source>:<id> (${Object.keys(MUSEUMS).join(', ')}) or wd:<QID>`)
    const key = m[1] === 'wd' ? 'commons' : m[1]
    if (key === 'commons' && !/^Q\d+$/i.test(m[2])) die(`bad --ids entry "${tok}" — expected wd:Q<number>`)
    ;(idsBySource[key] ||= []).push(m[2])
  }
}
const ID_MODE = !!opts.ids
const FAMOUS = !!opts.famous || (!query && !ID_MODE)
const CUTOFF = cutoffYear()

let gallery
try {
  gallery = readGallery()
} catch (e) {
  die(`can't read ${GALLERY} for dedup: ${e.message}`)
}

// ---- run -------------------------------------------------------------------

const mode = ID_MODE ? `ids ${opts.ids}` : `${FAMOUS ? 'famous' : 'query'}${query ? ` "${query}"` : ''}`
log(`find-paintings: ${mode} · sources ${sources.join(',')} · limit ${limit} · pool ${pool}/source · cutoff: died <= ${CUTOFF}`)

const { ranked, rejects, dupes, perSource, tripped } = await findPaintings({
  sources, famous: FAMOUS, query, ids: ID_MODE ? idsBySource : null, pool, gallery,
})
if (ID_MODE) {
  for (const s of Object.keys(idsBySource)) if (!sources.includes(s)) log(`  note: --ids has ${s}: entries but --sources excludes ${s}`)
}
const all = perSource.flatMap((s) => s.cands)

const output = [...ranked.slice(0, limit), ...(SHOW_REJECTS ? rejects : [])].map(finalize)
const json = `${JSON.stringify(output, null, 2)}\n`
if (opts.out) writeFileSync(path.resolve(opts.out), json)
else process.stdout.write(json)

// ---- summary (stderr) ------------------------------------------------------

for (const s of perSource) {
  const p = s.cands.filter((c) => c.clearance?.pass).length
  log(`  ${s.key}: ${s.cands.length} checked, ${p} eligible, ${s.cands.length - p} rejected${s.failed ? ' — SOURCE FAILED' : ''}${s.fameOk === false ? ' (no Wikidata fame)' : ''}`)
}
if (dupes.length) log(`  skipped ${dupes.length} duplicate(s): ${dupes.slice(0, 8).map((d) => `${d.object_id} (${d.why})`).join('; ')}${dupes.length > 8 ? '; …' : ''}`)
if (tripped.length) log(`  !! hosts that walled us off this run: ${tripped.join(', ')}`)
if (ID_MODE || SHOW_REJECTS) {
  for (const c of rejects.slice(0, ID_MODE ? Infinity : 15)) log(`  REJECT ${c.object_id} ${c.original_title?.slice(0, 50)} — ${c.clearance.reasons.join(' | ')}`)
}
log(`  ${ranked.length} eligible (${Math.min(limit, ranked.length)} written)${SHOW_REJECTS ? ` + ${rejects.length} rejects` : ''}${opts.out ? ` -> ${opts.out}` : ''}`)
for (const [i, c] of ranked.slice(0, 15).entries()) {
  log(`  ${String(i + 1).padStart(2)}. ${c.original_title?.slice(0, 48)} — ${c.artist} — ${c.object_id} (${c.museum}) — ${c.wing ?? 'wing ?'} — wp ${c.fame.wikipedia_langs ?? '?'}${c.fame.highlight ? ' ★' : ''} — ${c.width}×${c.height}`)
}
if (perSource.every((s) => s.failed || !s.cands.length) && !all.length) {
  die('no candidates from any source — all sources failed or returned nothing')
}
