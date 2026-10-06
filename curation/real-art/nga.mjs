// The National Gallery of Art, Washington. It has no search API, so each run
// reads its open-data CSV export (github.com/NationalGalleryOfArt/opendata,
// updated daily) from a local cache, indexes it, and searches that. Like
// sources.mjs it only maps records; clearance.mjs decides.

import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { isQualified, peopleFromCredits } from './clearance.mjs'
import { fold, http, HttpError, log } from './lib.mjs'
import { datesFor, record } from './sources.mjs'

const DATA = 'https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data'
export const NGA_CACHE = path.join(os.tmpdir(), 'lart-real-art-cache', 'nga')
const FRESH_MS = 24 * 60 * 60 * 1000
const MUSEUM = 'National Gallery of Art'

// ---- the CSV export ----------------------------------------------------------

/**
 * One export file, downloaded at most once a day: a copy checked in the last
 * 24 h is reused as is; an older one is revalidated with its ETag. If GitHub is
 * unreachable, a stale copy still serves.
 */
async function cachedCsv(name) {
  mkdirSync(NGA_CACHE, { recursive: true })
  const file = path.join(NGA_CACHE, `${name}.csv`)
  const metaFile = `${file}.meta.json`
  let meta = null
  try { if (existsSync(file)) meta = JSON.parse(readFileSync(metaFile, 'utf8')) } catch { meta = null }
  if (meta && Date.now() - meta.checked_at < FRESH_MS) return file
  const headers = {}
  if (meta?.etag) headers['If-None-Match'] = meta.etag
  if (meta?.last_modified) headers['If-Modified-Since'] = meta.last_modified
  const tmp = `${file}.part`
  try {
    const res = await http(`${DATA}/${name}.csv`, { as: 'response', headers, timeoutMs: 600_000 })
    if (res.status === 304) {
      await res.body?.cancel().catch(() => {})
      writeFileSync(metaFile, JSON.stringify({ ...meta, checked_at: Date.now() }))
      return file
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {})
      throw new HttpError(`GET ${name}.csv: HTTP ${res.status}`, res.status)
    }
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp))
    // Content-Length counts the compressed bytes when the body arrives gzipped.
    const expected = res.headers.get('content-encoding') ? 0 : Number(res.headers.get('content-length'))
    if (expected > 0 && statSync(tmp).size !== expected) throw new HttpError(`GET ${name}.csv: truncated`, 0)
    renameSync(tmp, file)
    writeFileSync(metaFile, JSON.stringify({ etag: res.headers.get('etag'), last_modified: res.headers.get('last-modified'), checked_at: Date.now() }))
    log(`  nga: downloaded ${name}.csv (${(statSync(file).size / 1e6).toFixed(0)} MB)`)
    return file
  } catch (e) {
    rmSync(tmp, { force: true })
    if (meta) {
      log(`  nga: couldn't refresh ${name}.csv (${e.message.slice(0, 100)}); using the copy from ${new Date(meta.checked_at).toISOString()}`)
      return file
    }
    throw e
  }
}

/** Rows of RFC 4180 CSV text: quoted fields may hold commas, doubled quotes and newlines. */
export function* csvRows(text) {
  const n = text.length
  let i = 0
  while (i < n) {
    const row = []
    for (;;) {
      if (text.charCodeAt(i) === 34) {
        let field = ''
        let j = i + 1
        for (;;) {
          const q = text.indexOf('"', j)
          if (q < 0) { field += text.slice(j); i = n; break }
          if (text.charCodeAt(q + 1) === 34) { field += text.slice(j, q + 1); j = q + 2; continue }
          field += text.slice(j, q)
          i = q + 1
          break
        }
        row.push(field)
      } else {
        let j = i
        while (j < n) {
          const ch = text.charCodeAt(j)
          if (ch === 44 || ch === 10 || ch === 13) break
          j++
        }
        row.push(text.slice(i, j))
        i = j
      }
      if (text.charCodeAt(i) === 44) { i++; continue }
      if (text.charCodeAt(i) === 13) i++
      if (text.charCodeAt(i) === 10) i++
      break
    }
    yield row
  }
}

/** Call `fn` with each row of a CSV text as {column: value}, for the named columns only. */
export function eachCsvRow(text, columns, fn) {
  const rows = csvRows(text)
  const header = rows.next().value || []
  const at = columns.map((c) => header.indexOf(c))
  const missing = columns.filter((_, k) => at[k] < 0)
  if (missing.length) throw new Error(`NGA export has no column(s) ${missing.join(', ')}`)
  for (const r of rows) {
    const o = {}
    for (let k = 0; k < columns.length; k++) o[columns[k]] = r[at[k]] ?? ''
    fn(o)
  }
}

const readCsv = async (name) => readFileSync(await cachedCsv(name), 'utf8')

let indexPromise = null
let termsPromise = null

/** Objects, their artists and primary images, indexed once per run. */
function loadIndex() {
  indexPromise ||= (async () => {
    // One file at a time: they're large.
    const texts = {}
    for (const f of ['objects', 'objects_constituents', 'constituents', 'published_images']) texts[f] = await readCsv(f)
    const t = Date.now()
    const objects = new Map()
    const byAccession = new Map()
    eachCsvRow(texts.objects, ['objectid', 'accessionnum', 'title', 'displaydate', 'endyear', 'medium', 'attribution', 'creditline', 'classification', 'wikidataid'], (o) => {
      objects.set(o.objectid, o)
      if (o.accessionnum) byAccession.set(o.accessionnum, o.objectid)
    })
    const constituents = new Map()
    eachCsvRow(texts.constituents, ['constituentid', 'forwarddisplayname', 'displaydate', 'constituenttype'], (c) => constituents.set(c.constituentid, c))
    const artists = new Map()
    eachCsvRow(texts.objects_constituents, ['objectid', 'constituentid', 'displayorder', 'roletype', 'role', 'prefix'], (a) => {
      if (a.roletype !== 'artist') return
      const c = constituents.get(a.constituentid) || {}
      const list = artists.get(a.objectid) || []
      list.push({ order: Number(a.displayorder) || 0, role: a.role, prefix: a.prefix, name: c.forwarddisplayname || null, life: c.displaydate || '', type: c.constituenttype || '' })
      artists.set(a.objectid, list)
    })
    for (const list of artists.values()) list.sort((a, b) => a.order - b.order)
    const images = new Map()
    eachCsvRow(texts.published_images, ['depictstmsobjectid', 'iiifurl', 'viewtype', 'sequence', 'width', 'height', 'openaccess'], (im) => {
      if (im.viewtype !== 'primary') return
      const prev = images.get(im.depictstmsobjectid)
      if (!prev || Number(im.sequence) < Number(prev.sequence)) images.set(im.depictstmsobjectid, im)
    })
    log(`  nga: indexed ${objects.size} objects from the open-data export in ${Date.now() - t} ms`)
    return { objects, byAccession, artists, images }
  })()
  return indexPromise
}

/** Keywords, themes, styles and schools per object, for --query only. */
function loadTerms() {
  termsPromise ||= (async () => {
    const terms = new Map()
    eachCsvRow(await readCsv('objects_terms'), ['objectid', 'termtype', 'term'], (r) => {
      if (!['Keyword', 'Theme', 'Style', 'School'].includes(r.termtype)) return
      terms.set(r.objectid, `${terms.get(r.objectid) || ''} ${r.term}`)
    })
    return terms
  })()
  return termsPromise
}

const bundle = (ix, id) => {
  const o = ix.objects.get(String(id))
  return o ? { o, artists: ix.artists.get(o.objectid) || [], image: ix.images.get(o.objectid) || null } : null
}

// ---- search ----------------------------------------------------------------

const FLAT = new Set(['Painting', 'Print', 'Drawing', 'Index of American Design'])
const RANK = { Painting: 0, Drawing: 1, Print: 2, 'Index of American Design': 3 }
const words = (s) => fold(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1)

/** Open-access flat works matching most of the query's words, paintings first. */
async function ngaSearch(query, n) {
  const ix = await loadIndex()
  const terms = await loadTerms()
  const want = [...new Set(words(query))]
  if (!want.length) return []
  const hits = []
  for (const o of ix.objects.values()) {
    if (!FLAT.has(o.classification) || ix.images.get(o.objectid)?.openaccess !== '1') continue
    const have = new Set(words(`${o.title} ${o.attribution} ${o.medium} ${terms.get(o.objectid) || ''}`))
    const score = want.filter((w) => have.has(w)).length
    if (score) hits.push({ id: o.objectid, score, rank: RANK[o.classification] })
  }
  hits.sort((a, b) => b.score - a.score || a.rank - b.rank)
  return hits.slice(0, n).map((h) => bundle(ix, h.id))
}

/** objectid, or an accession number ("1967.6.1.a"). */
async function ngaByIds(ids) {
  const ix = await loadIndex()
  return [...new Set(ids.map(String))].map((id) => bundle(ix, /^\d+$/.test(id) ? id : ix.byAccession.get(id))).filter(Boolean)
}

async function ngaByInventory(invs) {
  const ix = await loadIndex()
  return [...new Set(invs)].map((inv) => bundle(ix, ix.byAccession.get(inv))).filter(Boolean)
}

// ---- records ---------------------------------------------------------------

// A prefix that only joins two artists ("and", "with") is no qualifier; "or"
// ("X or Y") is: the hand is uncertain.
const CONNECTOR = /^(and|with|,)\s*/i
const PLAIN_PREFIX = /^(painted|published|printed|translated) by$/i

/** NGA's artist credits -> the gate's credits. */
export function ngaCredits(artists) {
  return artists.map((a) => {
    const pre = String(a.prefix || '').replace(CONNECTOR, '').trim()
    return {
      name: a.name, role: a.role, qualifier: pre && !PLAIN_PREFIX.test(pre) ? pre : null,
      // The constituent's display date ("Italian, 1452 - 1519"). Its begin/end
      // years aren't used: for some artists they're active years, not a lifetime.
      life: a.life, anonymous: a.type === 'anonymous', from: 'constituents.displaydate',
    }
  })
}

// "Ginevra de' Benci [obverse]": the reverse is its own object.
const cleanTitle = (t) => String(t || '').replace(/\s*\[(obverse|recto)\]\s*$/i, '').trim() || null

export function ngaRecord({ o, artists, image }) {
  const who = peopleFromCredits(ngaCredits(artists))
  // The object's attribution line can carry a qualifier its credits don't.
  if (!who.qualified && isQualified(o.attribution)) who.qualified = o.attribution
  const w = Number(image?.width) || null
  const h = Number(image?.height) || null
  const end = String(o.endyear).trim() === '' ? null : Number(o.endyear)
  const gate = {
    source: 'nga', license_value: image ? image.openaccess : null, type_label: o.classification || null,
    medium: o.medium || null, object_end: Number.isFinite(end) ? end : null, who, width: w, height: h,
  }
  const artist = o.attribution || artists.find((a) => a.name)?.name || (who.anonymous ? 'Unknown artist' : null)
  return record({
    objectId: `nga:${o.objectid}`,
    gate,
    prov: {
      artist,
      artist_dates: datesFor(who, artist),
      original_title: cleanTitle(o.title),
      original_date: o.displaydate || null,
      museum: MUSEUM,
      credit_line: o.creditline || null,
      source_url: `https://www.nga.gov/collection/art-object-page.${o.objectid}.html`,
    },
    image: { url: image?.iiifurl ? `${image.iiifurl}/full/full/0/default.jpg` : null, width: w, height: h },
    highlight: false,
    wd: { id: o.objectid, inv: o.accessionnum || null, qid: /^Q\d+$/.test(o.wikidataid) ? o.wikidataid : null },
  })
}

export const nga = {
  key: 'nga',
  museum: MUSEUM,
  search: ngaSearch,
  highlights: async () => [], // the export flags no highlights
  byIds: ngaByIds,
  byInventory: ngaByInventory,
  async byFameKeys(keys, n) {
    const ix = await loadIndex()
    const ids = [...new Set(keys.map((k) => (k.kind === 'id' ? k.value : ix.byAccession.get(k.value))).filter(Boolean))]
    return ids.slice(0, n).map((id) => bundle(ix, id)).filter(Boolean)
  },
  idOf: (b) => b.o.objectid,
  wdRefs: (b) => [`id:${b.o.objectid}`, `inv:${b.o.accessionnum}`],
  normalize: async (bundles) => bundles.map(ngaRecord),
}
