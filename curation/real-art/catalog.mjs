// The real-paintings catalog: the works that passed the legal gate at the last
// monthly refresh (build-catalog.mjs), read by the nightly curation through
// queue.mjs. This module holds what both share: reading the catalog and the
// blocklist, the upcoming queue, and the QUEUE.md view. No network.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { canonUrl, galleryIndex, inGallery, byFame, ROOT, score } from './search.mjs'
import { rankByWing } from './wings.mjs'

const HERE = path.join(ROOT, 'curation', 'real-art')
export const CATALOG = path.join(HERE, 'catalog.json')
export const BLOCKLIST = path.join(HERE, 'blocklist.txt')
export const QUEUE_MD = path.join(HERE, 'QUEUE.md')
const GATE_FILE = path.join(HERE, 'clearance.mjs')
export const MAX_AGE_DAYS = 34 // a monthly refresh, plus a few days to merge it
const DAY_MS = 24 * 60 * 60 * 1000
const rel = (f) => path.relative(ROOT, f)

/** The legal gate's code, hashed: a catalog built under other rules says so. */
export const gateFingerprint = (file = GATE_FILE) => createHash('sha256').update(readFileSync(file)).digest('hex')

// ---- the catalog -----------------------------------------------------------

export class CatalogError extends Error {}

export function readCatalog(file = CATALOG) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (e) {
    throw new CatalogError(e.code === 'ENOENT' ? `there is no catalog at ${rel(file)}` : `can't read ${rel(file)}: ${e.message}`)
  }
  let cat
  try {
    cat = JSON.parse(text)
  } catch (e) {
    throw new CatalogError(`${rel(file)} isn't valid JSON (${e.message})`)
  }
  if (!Array.isArray(cat?.works) || !Number.isFinite(Date.parse(cat.built_at))) {
    throw new CatalogError(`${rel(file)} has no "works" list or no "built_at" date`)
  }
  return cat
}

export const ageDays = (cat, now = Date.now()) => (now - Date.parse(cat.built_at)) / DAY_MS

/** Reasons to refresh the catalog soon. None of them stops the night. */
export function catalogWarnings(cat, { now = Date.now(), gate = gateFingerprint() } = {}) {
  const out = []
  const age = ageDays(cat, now)
  if (age > MAX_AGE_DAYS) {
    out.push(`the catalog is ${Math.floor(age)} days old (built ${cat.built_at.slice(0, 10)}), over the ${MAX_AGE_DAYS}-day limit. Refresh it: see curation/REAL_PAINTINGS_CATALOG.md.`)
  }
  if (cat.gate?.clearance_sha256 && cat.gate.clearance_sha256 !== gate) {
    out.push('clearance.mjs has changed since the catalog was built, so its works were cleared under the old rules. Refresh it: see curation/REAL_PAINTINGS_CATALOG.md.')
  }
  return out
}

// ---- the blocklist ---------------------------------------------------------

const OBJECT_ID = /^(aic|met|cma|nga|rijks|getty|smk|wd):\S+$/

/**
 * One work per line: an object_id (`rijks:SK-C-5`, `wd:Q12418`), a bare Wikidata
 * QID, or the work's source_url, then `# why`. Returns {entries: Map(key ->
 * why), bad: [line descriptions]}.
 */
export function parseBlocklist(text) {
  const entries = new Map()
  const bad = []
  String(text).split('\n').forEach((line, i) => {
    const hash = line.search(/\s#|^#/)
    const id = (hash < 0 ? line : line.slice(0, hash)).trim()
    if (!id) return
    const why = hash < 0 ? '' : line.slice(hash).replace(/^\s*#\s*/, '').trim()
    let key = null
    if (/^Q\d+$/i.test(id)) key = `wd:${id.toUpperCase()}`
    else if (/^wd:Q\d+$/i.test(id)) key = `wd:${id.slice(3).toUpperCase()}`
    else if (OBJECT_ID.test(id)) key = id
    else if (/^https?:\/\//i.test(id)) key = `url:${canonUrl(id)}`
    if (key) entries.set(key, why || 'no reason given')
    else bad.push(`line ${i + 1}: "${line.trim()}"`)
  })
  return { entries, bad }
}

export function readBlocklist(file = BLOCKLIST) {
  try {
    return parseBlocklist(readFileSync(file, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return { entries: new Map(), bad: [] }
    throw e
  }
}

/** Why the blocklist vetoes this work, or null. A wd: entry also matches museum copies of the work. */
export function blockedBy(w, entries) {
  return entries.get(w.object_id) ??
    (w.qid ? entries.get(`wd:${w.qid}`) : undefined) ??
    entries.get(`url:${canonUrl(w.source_url)}`) ??
    null
}

// ---- the queue -------------------------------------------------------------

/**
 * The works still to come, in the nightly's order: not in gallery.json, not
 * blocked, ranked by fame taking turns by wing (each wing's most famous remaining
 * work first). Returns {queue, used, blocked}; used/blocked = [{work, why}].
 */
export function upcoming(cat, { gallery, blocklist = new Map() }) {
  const gi = galleryIndex(gallery)
  const used = []
  const blocked = []
  const left = []
  for (const w of cat.works) {
    const why = inGallery(w, gi)
    if (why) { used.push({ work: w, why }); continue }
    const veto = blockedBy(w, blocklist)
    if (veto) { blocked.push({ work: w, why: veto }); continue }
    left.push(structuredClone(w)) // rankByWing sets fame.wing_rank
  }
  left.sort(byFame)
  return { queue: rankByWing(left, score), used, blocked }
}

/** One line per work, as find-paintings.mjs prints its top 15. */
export const queueLine = (c, i) =>
  `${String(i + 1).padStart(3)}. ${c.original_title?.slice(0, 48)} — ${c.artist} — ${c.object_id} (${c.museum}) — ${c.wing ?? 'wing ?'} — wp ${c.fame.wikipedia_langs ?? '?'}${c.fame.highlight ? ' ★' : ''} — ${c.width}×${c.height}`

// ---- QUEUE.md --------------------------------------------------------------

const THUMB = 330 // a standard Commons thumbnail width

/** A small image of the work for QUEUE.md, from the URL the catalog already has. */
export function thumbUrl(w) {
  const u = String(w.image_url || '')
  if (!u) return null
  if (w.object_id.startsWith('wd:')) {
    const file = String(w.source_url || '').match(/\/wiki\/File:(.+)$/)?.[1]
    return file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=${THUMB}` : null
  }
  if (/\/full\/[^/]+\/0\/default\.jpg$/.test(u)) return u.replace(/\/full\/[^/]+\/0\/default\.jpg$/, `/full/${THUMB},/0/default.jpg`)
  if (w.object_id.startsWith('met:')) return u.replace('/original/', '/web-large/')
  if (w.object_id.startsWith('cma:')) return u.replace(/_(print|full)\.\w+$/, '_web.jpg')
  return u
}

/** Text from museums and Wikidata, safe inside a Markdown table cell. */
const md = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/([\\|[\]*_`])/g, '\\$1')

/** A Markdown table of works, with thumbnails, numbered from `from`. */
export function queueTable(works, from = 1) {
  const rows = works.map((w, i) => {
    const thumb = thumbUrl(w)
    const img = thumb ? `<img src="${thumb.replace(/"/g, '%22')}" width="96" alt="">` : ''
    const href = String(w.source_url).replace(/[()\s<>]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)
    const work = `**[${md(w.original_title)}](${href})**<br>${md(w.artist)}${w.original_date ? `, ${md(w.original_date)}` : ''}<br>${md(w.museum)}`
    const fame = `${w.fame?.wikipedia_langs ?? 0}${w.fame?.highlight ? ' ★' : ''}`
    return `| ${from + i} | ${img} | ${work} | ${md(w.wing ?? '?')} | ${fame} | \`${w.object_id}\` |`
  })
  return ['| # | | Work | Wing | Fame | ID |', '|---:|---|---|---|---:|---|', ...rows].join('\n')
}

export function queueMarkdown(cat, { queue, used, blocked }, top = 60) {
  return `# Real paintings: the upcoming queue

The nightly curation picks four works a night from the top of this list. It skips works it can't animate well or that break the runbook's rules, so it doesn't take them strictly in order.

To veto a work, add its ID to [\`blocklist.txt\`](blocklist.txt). The nightly honours it from its next run. This page catches up the next time the nightly publishes.

${queue.length} works to come. The catalog was built on ${cat.built_at.slice(0, 10)} and holds ${cat.works.length} works: ${used.length} are in the gallery and ${blocked.length} are blocked. The full records are in [\`catalog.json\`](catalog.json). "Fame" is the number of Wikipedia language editions with an article on the work; ★ is a museum highlight.

Generated by \`node curation/real-art/queue.mjs --markdown\`. Don't edit it by hand.

${queueTable(queue.slice(0, top))}
${queue.length > top ? `\n${queue.length - top} more works follow. \`node curation/real-art/queue.mjs --limit ${queue.length}\` lists them all.\n` : ''}`
}
