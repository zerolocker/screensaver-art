// The search pipeline behind find-paintings.mjs and build-catalog.mjs: harvest
// each source, run every candidate through the legal gate (clearance.mjs), add
// fame, drop works already in gallery.json and duplicates across sources, and
// rank the rest. Both scripts call findPaintings(), so they can't disagree on
// what passes.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clear, cutoffYear } from './clearance.mjs'
import { commons } from './commons.mjs'
import { fold, log, PROVENANCE_KEYS, probeImageSize, trippedHosts } from './lib.mjs'
import { MUSEUMS } from './museums.mjs'
import { famousKeys, wikipediaLangs } from './wikidata.mjs'
import { rankByWing } from './wings.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const GALLERY = path.join(ROOT, 'gallery.json')
const HIGHLIGHT_BONUS = 5 // a museum's own "highlight" ~ five Wikipedia editions
export const SOURCES = { ...MUSEUMS, commons }
// Commons has far more famous candidates than the gate passes (closed museums,
// modern artists, Italy, small files), so it fetches more of them.
const COMMONS_POOL_FACTOR = 3

// ---- fame ------------------------------------------------------------------

export const score = (c) => (c.fame.wikipedia_langs ?? 0) + (c.fame.highlight ? HIGHLIGHT_BONUS : 0)
const longEdge = (c) => Math.max(c.width || 0, c.height || 0)
export const byFame = (a, b) => score(b) - score(a) || Number(b.fame.highlight) - Number(a.fame.highlight) || longEdge(b) - longEdge(a)

// ---- gallery dedup ---------------------------------------------------------

/** Canonical form of a museum object URL (protocol/www/slug/trailing-slash agnostic). */
export function canonUrl(u) {
  let s = String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '')
  s = s.replace(/[?#].*$/, '').replace(/\/+$/, '')
  return s.replace(/^(artic\.edu\/artworks\/\d+)\/.*$/, '$1')
}

/** Same artwork in two museums (prints especially): surname + title, folded. */
export function workKey(c) {
  const artist = fold(c.artist).replace(/\(.*?\)/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/)
  const title = fold(c.original_title)
    .replace(/\(.*?\)/g, ' ')
    .replace(/,?\s+from the (series|album)\b.*$/, '')
    .replace(/^(the|a|an|le|la|les|il|lo|der|die|das|de|het)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ').trim()
  return `${artist[artist.length - 1] || '?'}|${title}`
}

const isCommonsUrl = (u) => /^https?:\/\/commons\.wikimedia\.org\//i.test(u || '')
const SOURCE_HOSTS = [
  ['aic', /(^|\.)artic\.edu$/], ['met', /(^|\.)metmuseum\.org$/], ['cma', /(^|\.)clevelandart\.org$/], ['nga', /(^|\.)nga\.gov$/],
  ['rijks', /(^|\.)rijksmuseum\.nl$/], ['getty', /(^|\.)getty\.edu$/], ['smk', /(^|\.)smk\.dk$/], ['commons', /^commons\.wikimedia\.org$/],
]
/** The source a gallery piece came from, by its source_url, or null. */
const sourceOfUrl = (u) => {
  try {
    const host = new URL(u).hostname.toLowerCase()
    return SOURCE_HOSTS.find(([, re]) => re.test(host))?.[0] ?? null
  } catch {
    return null
  }
}
const fromCommons = (c) => String(c.object_id).startsWith('wd:')

export function readGallery(file = GALLERY) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

/** What dedup needs from gallery.json. */
export function galleryIndex(items) {
  return {
    urls: new Set(items.map((i) => i.source_url).filter(Boolean).map(canonUrl)),
    // The same work can reach the gallery through Commons, then a museum or another
    // Commons file: those are also matched by artist + title.
    works: new Set(items.filter((i) => i.source === 'real_artwork').map(workKey)),
    commonsWorks: new Set(items.filter((i) => isCommonsUrl(i.source_url)).map(workKey)),
    // Works already taken from each source, so a search can reach past them.
    taken: items.filter((i) => i.source === 'real_artwork').reduce((m, i) => {
      const k = sourceOfUrl(i.source_url)
      if (k) m[k] = (m[k] || 0) + 1
      return m
    }, {}),
  }
}

/**
 * Why a candidate is already in the gallery, or null. A Commons work is matched
 * by artist and title against every real artwork, since its file can change; a
 * museum work against the Commons-sourced ones, since a museum may start
 * releasing a work we took from Commons.
 */
export function inGallery(c, gi) {
  if (gi.urls.has(canonUrl(c.source_url))) return 'already in gallery.json'
  if ((fromCommons(c) ? gi.works : gi.commonsWorks).has(workKey(c))) return 'same work as a gallery.json piece'
  return null
}

// ---- output ----------------------------------------------------------------

/** The record the scripts write: the provenance keys, then the working keys. */
export function finalize(c) {
  const out = {}
  for (const k of PROVENANCE_KEYS) out[k] = c[k] ?? null
  for (const k of ['object_id', 'image_url', 'width', 'height', 'aspect', 'classification', 'medium', 'wing', 'fame', 'clearance']) out[k] = c[k] ?? null
  out.qid = c._wd?.qid || null
  return out
}

// ---- the pipeline ----------------------------------------------------------

/**
 * opts: {sources: [key…], famous, query, ids: {source: [id…]} | null, pool, gallery: [items]}
 * Returns {ranked, rejects, dupes, perSource}. `ranked` holds every eligible work
 * (famous runs take turns by wing); perSource[i] = {key, cands, failed, error,
 * fameOk, notes}. Records still carry their working fields (_gate, _wd): pass
 * them through finalize() to write them.
 */
export async function findPaintings({ sources, famous, query = null, ids = null, pool, gallery }) {
  const ID_MODE = !!ids
  const cutoff = cutoffYear()
  const gi = galleryIndex(gallery)

  async function harvest(key, notes) {
    const src = SOURCES[key]
    if (src.collect) {
      // Used Commons works stay in Wikidata's fame order, so look further down it.
      return src.collect({ ids: ID_MODE ? ids[key] || [] : null, famous, query, n: COMMONS_POOL_FACTOR * pool + (gi.taken.commons || 0) })
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
      add(await src.byIds(ids[key] || []))
    } else {
      if (famous && !query) {
        try {
          // Works already in the gallery stay in Wikidata's fame order, so look
          // further down it. Ask for 2x: AIC/CMA objects can surface under both
          // their ID property and their inventory number. Hydrate in fame order.
          const n = pool + (gi.taken[key] || 0)
          const keys = await famousKeys(key, 2 * n)
          const idKeys = [...new Set(keys.filter((k) => k.kind === 'id').map((k) => k.value))]
          const invs = [...new Set(keys.filter((k) => k.kind === 'inv').map((k) => k.value))]
          if (src.byFameKeys) add(await src.byFameKeys(keys, n))
          else if (key === 'met') add(await src.byIds(idKeys.slice(0, n)))
          else if (key === 'cma') add(await src.byIds([...new Set(keys.map((k) => k.value))].slice(0, n)))
          else { add(await src.byIds(idKeys)); add(await src.byInventory(invs)) }
          const rank = new Map(keys.map((k, i) => [`${k.kind}:${k.value}`, i]))
          const rankOf = (r) => Math.min(...src.wdRefs(r).map((ref) => rank.get(ref) ?? Infinity))
          raws.sort((a, b) => rankOf(a) - rankOf(b))
          raws.splice(n)
          seen.clear()
          for (const r of raws) seen.add(src.idOf(r))
          log(`  ${key}: ${keys.length} Wikidata-famous keys -> ${raws.length} records`)
        } catch (e) {
          notes.push(`Wikidata unavailable (${e.message.slice(0, 120)}); used museum highlights only`)
          log(`  ${key}: Wikidata unavailable (${e.message.slice(0, 120)}) — falling back to museum highlights`)
        }
        add(await src.highlights(Math.ceil(pool / 2), null, seen))
      }
      if (query) {
        if (famous) add(await src.highlights(Math.ceil(pool / 2), query, seen))
        add(await src.search(query, pool, seen))
      }
    }
    return src.normalize(raws)
  }

  async function gate(cands) {
    // The Met reports no pixel sizes: probe the JPEG header, but only for records
    // that already clear licence/life+70/medium (saves requests to a touchy host).
    const needProbe = cands.filter((c) => c._gate.source === 'met' && c.image_url && clear(c._gate, { cutoff, skipSize: true }).pass)
    for (const c of needProbe) {
      try {
        const dims = await probeImageSize(c.image_url)
        if (dims) Object.assign(c, dims, { aspect: Math.round((dims.width / dims.height) * 1000) / 1000 })
        if (dims) Object.assign(c._gate, dims)
      } catch (e) {
        log(`  met: size probe failed for ${c.object_id}: ${e.message}`)
      }
    }
    for (const c of cands) c.clearance = clear(c._gate, { cutoff })
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

  const perSource = await Promise.all(sources.map(async (key) => {
    const notes = []
    if (ID_MODE && !ids[key]) return { key, cands: [], notes }
    try {
      const cands = await harvest(key, notes)
      await gate(cands)
      const fameOk = await addFame(key, cands)
      return { key, cands, fameOk, notes }
    } catch (e) {
      log(`  ${key}: FAILED — ${e.message}`)
      return { key, cands: [], failed: true, error: e.message, notes }
    }
  }))

  const passing = []
  const rejects = []
  const dupes = []
  for (const c of perSource.flatMap((s) => s.cands)) {
    const why = inGallery(c, gi)
    if (why) { dupes.push({ object_id: c.object_id, why }); continue }
    const m = c._gate.open_museum
    if (m?.releases === true) { dupes.push({ object_id: c.object_id, why: `${m.museum} releases its own image: ${m.object_id}` }); continue }
    ;(c.clearance.pass ? passing : rejects).push(c)
  }
  if (famous && query && !ID_MODE) {
    // "famous works on this theme": drop the passing ones with no fame signal at all.
    for (let i = passing.length - 1; i >= 0; i--) if (!score(passing[i])) passing.splice(i, 1)
  }
  passing.sort(byFame)
  rejects.sort(byFame)
  // A museum's own copy beats a Commons one of the same work, however famous. The
  // same work: the same Wikidata item where both records have one, else the same
  // artist and title.
  const seenWork = new Map() // workKey -> [{id, qid}]
  const seenQid = new Map()
  const eligible = []
  for (const c of [...passing.filter((c) => !fromCommons(c)), ...passing.filter(fromCommons)]) {
    const k = workKey(c)
    const q = c._wd?.qid || null
    const dup = (q && seenQid.get(q)) || (seenWork.get(k) || []).find((s) => !(q && s.qid))?.id
    if (dup) { dupes.push({ object_id: c.object_id, why: `same work as ${dup}` }); continue }
    seenWork.set(k, [...(seenWork.get(k) || []), { id: c.object_id, qid: q }])
    if (q) seenQid.set(q, c.object_id)
    eligible.push(c)
  }
  eligible.sort(byFame)
  // Famous runs take turns by wing, so the top isn't all European (wings.mjs).
  const ranked = famous && !ID_MODE ? rankByWing(eligible, score) : eligible
  return { ranked, rejects, dupes, perSource, tripped: trippedHosts() }
}
