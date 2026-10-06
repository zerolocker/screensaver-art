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
// records are written unless --show-rejects (audit mode).

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clear, cutoffYear } from './clearance.mjs'
import { commons } from './commons.mjs'
import { fold, log, parseArgs, PROVENANCE_KEYS, probeImageSize, trippedHosts } from './lib.mjs'
import { MUSEUMS } from './museums.mjs'
import { famousKeys, wikipediaLangs } from './wikidata.mjs'
import { rankByWing } from './wings.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const GALLERY = path.join(ROOT, 'gallery.json')
const HIGHLIGHT_BONUS = 5 // a museum's own "highlight" ~ five Wikipedia editions
const SOURCES = { ...MUSEUMS, commons }
// Commons has far more famous candidates than the gate passes (closed museums,
// modern artists, Italy, small files), so it fetches more of them.
const COMMONS_POOL_FACTOR = 3

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

// ---- gallery dedup ---------------------------------------------------------

/** Canonical form of a museum object URL (protocol/www/slug/trailing-slash agnostic). */
function canonUrl(u) {
  let s = String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '')
  s = s.replace(/[?#].*$/, '').replace(/\/+$/, '')
  return s.replace(/^(artic\.edu\/artworks\/\d+)\/.*$/, '$1')
}
const galleryItems = (() => {
  try {
    return JSON.parse(readFileSync(GALLERY, 'utf8'))
  } catch (e) {
    die(`can't read ${GALLERY} for dedup: ${e.message}`)
  }
})()
const galleryUrls = new Set(galleryItems.map((i) => i.source_url).filter(Boolean).map(canonUrl))
const isCommonsUrl = (u) => /^https?:\/\/commons\.wikimedia\.org\//i.test(u || '')
const commonsInGallery = galleryItems.filter((i) => isCommonsUrl(i.source_url)).length

// ---- harvest ---------------------------------------------------------------

async function harvest(key) {
  const src = SOURCES[key]
  if (src.collect) {
    // Used Commons works stay in Wikidata's fame order, so look further down it.
    return src.collect({ ids: ID_MODE ? idsBySource[key] || [] : null, famous: FAMOUS, query, n: COMMONS_POOL_FACTOR * pool + commonsInGallery })
  }
  const raws = []
  const seen = new Set()
  const add = (list) => {
    for (const r of list) {
      const id = src.idOf(r)
      if (!seen.has(id)) { seen.add(id); raws.push(r) }
    }
  }
  if (ID_MODE) {
    add(await src.byIds(idsBySource[key] || []))
  } else {
    if (FAMOUS && !query) {
      try {
        // Ask for 2x: AIC/CMA objects can surface under both their ID property and
        // their inventory number. Hydrate in fame order, at most `pool` records.
        const keys = await famousKeys(key, 2 * pool)
        const ids = [...new Set(keys.filter((k) => k.kind === 'id').map((k) => k.value))]
        const invs = [...new Set(keys.filter((k) => k.kind === 'inv').map((k) => k.value))]
        if (src.byFameKeys) add(await src.byFameKeys(keys, pool))
        else if (key === 'met') add(await src.byIds(ids.slice(0, pool)))
        else if (key === 'cma') add(await src.byIds([...new Set(keys.map((k) => k.value))].slice(0, pool)))
        else { add(await src.byIds(ids)); add(await src.byInventory(invs)) }
        const rank = new Map(keys.map((k, i) => [`${k.kind}:${k.value}`, i]))
        const rankOf = (r) => Math.min(...src.wdRefs(r).map((ref) => rank.get(ref) ?? Infinity))
        raws.sort((a, b) => rankOf(a) - rankOf(b))
        raws.splice(pool)
        seen.clear()
        for (const r of raws) seen.add(src.idOf(r))
        log(`  ${key}: ${keys.length} Wikidata-famous keys -> ${raws.length} records`)
      } catch (e) {
        log(`  ${key}: Wikidata unavailable (${e.message.slice(0, 120)}) — falling back to museum highlights`)
      }
      add(await src.highlights(Math.ceil(pool / 2), null, seen))
    }
    if (query) {
      if (FAMOUS) add(await src.highlights(Math.ceil(pool / 2), query, seen))
      add(await src.search(query, pool, seen))
    }
  }
  return src.normalize(raws)
}

// ---- gate ------------------------------------------------------------------

async function gate(cands) {
  // The Met reports no pixel sizes: probe the JPEG header, but only for records
  // that already clear licence/life+70/medium (saves requests to a touchy host).
  const needProbe = cands.filter((c) => c._gate.source === 'met' && c.image_url && clear(c._gate, { cutoff: CUTOFF, skipSize: true }).pass)
  for (const c of needProbe) {
    try {
      const dims = await probeImageSize(c.image_url)
      if (dims) Object.assign(c, dims, { aspect: Math.round((dims.width / dims.height) * 1000) / 1000 })
      if (dims) Object.assign(c._gate, dims)
    } catch (e) {
      log(`  met: size probe failed for ${c.object_id}: ${e.message}`)
    }
  }
  for (const c of cands) c.clearance = clear(c._gate, { cutoff: CUTOFF })
}

async function addFame(key, cands) {
  if (!cands.length || SOURCES[key].fameBuiltIn) return true
  try {
    const counts = await wikipediaLangs(key, cands)
    for (const c of cands) c.fame.wikipedia_langs = counts.get(c.object_id) ?? 0
    return true
  } catch (e) {
    log(`  ${key}: Wikidata join failed (${e.message.slice(0, 120)}) — ranking on highlight flags only`)
    return false
  }
}

const score = (c) => (c.fame.wikipedia_langs ?? 0) + (c.fame.highlight ? HIGHLIGHT_BONUS : 0)
const longEdge = (c) => Math.max(c.width || 0, c.height || 0)
const byFame = (a, b) => score(b) - score(a) || Number(b.fame.highlight) - Number(a.fame.highlight) || longEdge(b) - longEdge(a)

/** Same artwork in two museums (prints especially): surname + title, folded. */
function workKey(c) {
  const artist = fold(c.artist).replace(/\(.*?\)/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/)
  const title = fold(c.original_title)
    .replace(/\(.*?\)/g, ' ')
    .replace(/,?\s+from the (series|album)\b.*$/, '')
    .replace(/^(the|a|an|le|la|les|il|lo|der|die|das|de|het)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ').trim()
  return `${artist[artist.length - 1] || '?'}|${title}`
}

// ---- output ----------------------------------------------------------------

function finalize(c) {
  const out = {}
  for (const k of PROVENANCE_KEYS) out[k] = c[k] ?? null
  for (const k of ['object_id', 'image_url', 'width', 'height', 'aspect', 'classification', 'medium', 'wing', 'fame', 'clearance']) out[k] = c[k] ?? null
  return out
}

// ---- run -------------------------------------------------------------------

const mode = ID_MODE ? `ids ${opts.ids}` : `${FAMOUS ? 'famous' : 'query'}${query ? ` "${query}"` : ''}`
log(`find-paintings: ${mode} · sources ${sources.join(',')} · limit ${limit} · pool ${pool}/source · cutoff: died <= ${CUTOFF}`)

const perSource = await Promise.all(sources.map(async (key) => {
  if (ID_MODE && !idsBySource[key]) return { key, cands: [] }
  try {
    const cands = await harvest(key)
    await gate(cands)
    const fameOk = await addFame(key, cands)
    return { key, cands, fameOk }
  } catch (e) {
    log(`  ${key}: FAILED — ${e.message}`)
    return { key, cands: [], failed: true }
  }
}))
if (ID_MODE) {
  for (const s of Object.keys(idsBySource)) if (!sources.includes(s)) log(`  note: --ids has ${s}: entries but --sources excludes ${s}`)
}

const all = perSource.flatMap((s) => s.cands)
const passing = []
const rejects = []
const dupes = []
// The same work can reach the gallery through Commons, then a museum or another
// Commons file: those are also matched by artist + title.
const galleryWorks = new Set(galleryItems.filter((i) => i.source === 'real_artwork').map(workKey))
const galleryCommonsWorks = new Set(galleryItems.filter((i) => isCommonsUrl(i.source_url)).map(workKey))
for (const c of all) {
  if (galleryUrls.has(canonUrl(c.source_url))) { dupes.push(`${c.object_id} (already in gallery.json)`); continue }
  const fromCommonsLane = c._gate.source === 'commons'
  if ((fromCommonsLane ? galleryWorks : galleryCommonsWorks).has(workKey(c))) { dupes.push(`${c.object_id} (same work as a gallery.json piece)`); continue }
  const m = c._gate.open_museum
  if (m?.releases === true) { dupes.push(`${c.object_id} (${m.museum} releases its own image: ${m.object_id})`); continue }
  ;(c.clearance.pass ? passing : rejects).push(c)
}
if (FAMOUS && query && !ID_MODE) {
  // "famous works on this theme": drop the passing ones with no fame signal at all.
  for (let i = passing.length - 1; i >= 0; i--) if (!score(passing[i])) passing.splice(i, 1)
}
passing.sort(byFame)
rejects.sort(byFame)
// A museum's own copy beats a Commons one of the same work, however famous. The
// same work: the same Wikidata item where both records have one, else the same
// artist and title.
const fromCommons = (c) => c._gate.source === 'commons'
const seenWork = new Map() // workKey -> [{id, qid}]
const seenQid = new Map()
const eligible = []
for (const c of [...passing.filter((c) => !fromCommons(c)), ...passing.filter(fromCommons)]) {
  const k = workKey(c)
  const q = c._wd?.qid || null
  const dup = (q && seenQid.get(q)) || (seenWork.get(k) || []).find((s) => !(q && s.qid))?.id
  if (dup) { dupes.push(`${c.object_id} (same work as ${dup})`); continue }
  seenWork.set(k, [...(seenWork.get(k) || []), { id: c.object_id, qid: q }])
  if (q) seenQid.set(q, c.object_id)
  eligible.push(c)
}
eligible.sort(byFame)
// Famous runs take turns by wing, so the top isn't all European (wings.mjs).
const ranked = FAMOUS && !ID_MODE ? rankByWing(eligible, score) : eligible

const output = [...ranked.slice(0, limit), ...(SHOW_REJECTS ? rejects : [])].map(finalize)
const json = `${JSON.stringify(output, null, 2)}\n`
if (opts.out) writeFileSync(path.resolve(opts.out), json)
else process.stdout.write(json)

// ---- summary (stderr) ------------------------------------------------------

for (const s of perSource) {
  const p = s.cands.filter((c) => c.clearance?.pass).length
  log(`  ${s.key}: ${s.cands.length} checked, ${p} eligible, ${s.cands.length - p} rejected${s.failed ? ' — SOURCE FAILED' : ''}${s.fameOk === false ? ' (no Wikidata fame)' : ''}`)
}
if (dupes.length) log(`  skipped ${dupes.length} duplicate(s): ${dupes.slice(0, 8).join('; ')}${dupes.length > 8 ? '; …' : ''}`)
if (trippedHosts().length) log(`  !! hosts that walled us off this run: ${trippedHosts().join(', ')}`)
if (ID_MODE || SHOW_REJECTS) {
  for (const c of rejects.slice(0, ID_MODE ? Infinity : 15)) log(`  REJECT ${c.object_id} ${c.original_title?.slice(0, 50)} — ${c.clearance.reasons.join(' | ')}`)
}
log(`  ${eligible.length} eligible (${Math.min(limit, eligible.length)} written)${SHOW_REJECTS ? ` + ${rejects.length} rejects` : ''}${opts.out ? ` -> ${opts.out}` : ''}`)
for (const [i, c] of ranked.slice(0, 15).entries()) {
  log(`  ${String(i + 1).padStart(2)}. ${c.original_title?.slice(0, 48)} — ${c.artist} — ${c.object_id} (${c.museum}) — ${c.wing ?? 'wing ?'} — wp ${c.fame.wikipedia_langs ?? '?'}${c.fame.highlight ? ' ★' : ''} — ${c.width}×${c.height}`)
}
if (perSource.every((s) => s.failed || !s.cands.length) && !all.length) {
  die('no candidates from any source — all sources failed or returned nothing')
}
