// The three museum adapters (the Commons lane is commons.mjs). They search and
// map records to the provenance keys and the fields clearance.mjs judges; they
// don't decide eligibility. Server-side licence filters just skip obvious rejects.

import { licenceLabel, MIN_LONG_EDGE, peopleFromAic, peopleFromCma, peopleFromMet } from './clearance.mjs'
import { chunk, http, log, mapPool } from './lib.mjs'
import { aicWing, cmaWing, metWing } from './wings.mjs'

const aspectOf = (w, h) => (w && h ? Math.round((w / h) * 1000) / 1000 : null)
const stripParen = (s) => String(s ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim()
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Attribution qualifiers heading a name ("Workshop of", "After workshop of",
// "Workshop or circle of") or trailing an inverted AIC agent title
// ("Bonifacio Bembo, workshop of", "Guercino, School of").
const QUAL_KIND = String.raw`(?:workshop|studio|circle|school|followers?|imitators?|(?:in the )?(?:manner|style))`
const LEAD_QUAL = new RegExp(String.raw`^(?:(?:attributed to|possibly|probably|copy after|after|${QUAL_KIND}(?: or ${QUAL_KIND})? of)\s+)+`, 'i')
const TRAIL_QUAL = new RegExp(String.raw`,\s*(${QUAL_KIND} of)$`, 'i')

/** "Workshop of  X" / "X, workshop of" -> {qual: "Workshop of", name: "X"}. */
export function splitQualifier(s) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  const lead = t.match(LEAD_QUAL)
  if (lead) return { qual: lead[0].trim(), name: t.slice(lead[0].length) }
  const trail = t.match(TRAIL_QUAL)
  if (trail) return { qual: trail[1], name: t.slice(0, trail.index) }
  return { qual: null, name: t }
}

/**
 * "1848–1894", "c. 1480–c. 1504", "1628/29–1682", "1763–after 1825",
 * "active c. 742–756", "active by 1465, died 1494"
 */
export function formatDates(f) {
  if (!f) return null
  const yr = (y, approx, label) => `${approx ? 'c. ' : ''}${label || y}`
  const b = f.birth != null ? yr(f.birth, f.birthApprox, f.birthLabel) : null
  const d = f.death != null ? yr(f.death, f.deathApprox, f.deathLabel) : f.deathAfter != null ? `after ${f.deathAfter}` : null
  if (b && d) return `${b}–${d}`
  if (f.floruit != null) {
    const fl = `active ${f.floruitBy ? 'by ' : ''}${yr(f.floruit, f.floruitApprox)}${f.floruitEnd != null ? `–${f.floruitEnd}` : ''}`
    return d ? `${fl}, died ${d}` : fl
  }
  if (d) return `died ${d}`
  if (b) return `born ${b}`
  return null
}
export const mainDates = (who) => formatDates(who.people.find((p) => p.birth != null || p.death != null || p.floruit != null || p.deathAfter != null))
/** The dates of the person the artist line names ("Follower of Jan Lievens"), else the first dated one. */
export const datesFor = (who, artist) =>
  formatDates(who.people.find((p) => p.name && String(artist ?? '').includes(p.name) && (p.birth != null || p.death != null || p.floruit != null))) || mainDates(who)

export function record({ objectId, gate, prov, image, highlight, wd, classification, wing = null }) {
  return {
    source: 'real_artwork',
    ...prov,
    license: licenceLabel(gate.source, gate.license_value),
    object_id: objectId,
    image_url: image.url || null,
    width: image.width || null,
    height: image.height || null,
    aspect: aspectOf(image.width, image.height),
    classification: classification ?? (gate.type_label || null),
    medium: gate.medium || null,
    fame: { wikipedia_langs: null, highlight: !!highlight },
    wing,
    _gate: gate,
    _wd: wd,
  }
}

// ---- Art Institute of Chicago ---------------------------------------------

const AIC_API = 'https://api.artic.edu/api/v1'
const AIC_FLAT_TYPE_IDS = [1, 18, 14, 30] // Painting, Print, Drawing and Watercolor, Miniature Painting
const AIC_FIELDS = [
  'id', 'title', 'artist_display', 'artist_title', 'artist_ids', 'date_display', 'date_end',
  'artwork_type_title', 'medium_display', 'image_id', 'is_public_domain', 'is_boosted',
  'credit_line', 'thumbnail', 'main_reference_number', 'place_of_origin', 'department_title', 'style_titles', 'date_start',
]

async function aicSearch({ query, highlights = false, n }) {
  const filter = [
    { term: { is_public_domain: true } },
    { terms: { artwork_type_id: AIC_FLAT_TYPE_IDS } },
    { exists: { field: 'image_id' } },
  ]
  if (highlights) filter.push({ term: { is_boosted: true } })
  const must = query
    ? [{ multi_match: { query, fields: ['title^3', 'artist_title^2', 'term_titles', 'subject_titles', 'style_titles', 'theme_titles', 'classification_titles', 'place_of_origin', 'description'] } }]
    : []
  const out = []
  // AIC caps from+limit at 1000.
  for (let from = 0; out.length < n && from < 1000; from += 100) {
    const body = {
      query: { bool: { must, filter } }, fields: AIC_FIELDS,
      limit: Math.min(100, n - out.length), from,
      ...(query ? {} : { sort: [{ boost_rank: { order: 'asc', missing: '_last' } }] }),
    }
    const d = await http(`${AIC_API}/artworks/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    out.push(...(d.data || []))
    if ((d.data || []).length < body.limit) break
  }
  return out
}

async function aicByIds(ids) {
  const out = []
  for (const part of chunk([...new Set(ids)], 100)) {
    const d = await http(`${AIC_API}/artworks?ids=${part.join(',')}&fields=${AIC_FIELDS.join(',')}&limit=100`)
    out.push(...(d.data || []))
  }
  return out
}

async function aicByInventory(invs) {
  const out = []
  for (const part of chunk([...new Set(invs)], 100)) {
    const d = await http(`${AIC_API}/artworks/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { bool: { filter: [{ terms: { main_reference_number: part } }] } }, fields: AIC_FIELDS, limit: 100 }),
    })
    out.push(...(d.data || []))
  }
  return out
}

/** artist_ids -> {title, agent_type_title, birth_date, death_date} — corroborates artist_display. */
async function aicAgents(raws) {
  const ids = [...new Set(raws.flatMap((a) => a.artist_ids || []))]
  const map = new Map()
  for (const part of chunk(ids, 100)) {
    try {
      const d = await http(`${AIC_API}/agents?ids=${part.join(',')}&fields=id,title,agent_type_title,birth_date,death_date&limit=100`)
      for (const ag of d.data || []) map.set(ag.id, ag)
    } catch (e) {
      log(`  aic: agents lookup failed (${e.message}) — gating on artist_display alone`)
    }
  }
  return map
}

export function aicArtistName(a, who) {
  const [first = '', second = ''] = String(a.artist_display || '').split('\n').map((l) => l.trim())
  // "Artist unknown (American, 19th century)" / "Artist Unknown\nChinese" / "Japanese"
  if (/\b(unknown|unidentified|anonymous)\b/i.test(first)) return /\(/.test(first) || !second ? first : `${first} (${second})`
  if (who.anonymous && !a.artist_title) return first ? `Unknown artist (${stripParen(first)})` : 'Unknown artist'
  // The agent title often carries a qualifier too ("Workshop of Hieronymus Bosch").
  // Say it once, preferring the label's, which is specific to this object
  // ("Circle of X" on a "Workshop of X" agent).
  const label = splitQualifier(first)
  const agent = splitQualifier(a.artist_title)
  const name = agent.name || stripParen(label.name) || null
  const qual = label.qual || agent.qual
  return qual && name ? `${cap(qual.toLowerCase())} ${name}` : name
}

export const aic = {
  key: 'aic',
  museum: 'Art Institute of Chicago',
  search: (query, n) => aicSearch({ query, n }),
  highlights: (n, query) => aicSearch({ query, n, highlights: true }),
  byIds: aicByIds,
  byInventory: aicByInventory,
  idOf: (a) => a.id,
  wdRefs: (a) => [`id:${a.id}`, `inv:${a.main_reference_number}`],
  async normalize(raws) {
    const agents = await aicAgents(raws)
    return raws.map((a) => {
      const who = peopleFromAic(a, agents)
      const w = a.thumbnail?.width
      const h = a.thumbnail?.height
      const gate = {
        source: 'aic', license_value: a.is_public_domain, type_label: a.artwork_type_title,
        medium: a.medium_display, object_end: a.date_end, who, width: w, height: h,
      }
      return record({
        objectId: `aic:${a.id}`,
        gate,
        prov: {
          artist: aicArtistName(a, who),
          artist_dates: mainDates(who),
          original_title: a.title || null,
          original_date: a.date_display || null,
          museum: 'Art Institute of Chicago',
          credit_line: a.credit_line || null,
          source_url: `https://www.artic.edu/artworks/${a.id}`,
        },
        // PD works are served at native width; anything wider than the master
        // 403s, and non-PD works redirect to an 843px cap (frame re-verifies).
        image: { url: a.image_id && w ? `https://www.artic.edu/iiif/2/${a.image_id}/full/${w},/0/default.jpg` : null, width: w, height: h },
        highlight: a.is_boosted,
        wing: aicWing(a),
        wd: { id: String(a.id), inv: a.main_reference_number || null },
      })
    })
  },
}

// ---- The Metropolitan Museum of Art ---------------------------------------

const MET_API = 'https://collectionapi.metmuseum.org/public/collection'
const MET_MEDIA = ['Paintings', 'Prints', 'Drawings'] // v1.1 takes one medium per query

async function metSearchIds(params, n) {
  const ids = []
  for (let offset = 0; ids.length < n && offset < 10_000; offset += 500) {
    const qs = new URLSearchParams({ ...params, hasImages: 'true', offset: String(offset), limit: String(Math.min(500, n - ids.length)) })
    const d = await http(`${MET_API}/v1.1/search?${qs}`)
    const got = d.objectIDs || []
    ids.push(...got)
    if (got.length < Number(qs.get('limit')) || offset + got.length >= (d.total ?? Infinity)) break
  }
  return ids
}

/**
 * Interleave the per-medium results, paintings first, so prints can't crowd
 * them out. `skip`: IDs already fetched this run (each costs ~1 s at the Met).
 */
async function metSearch(query, n, highlights, skip = new Set()) {
  const per = []
  for (const medium of MET_MEDIA) {
    per.push(await metSearchIds({
      ...(query ? { q: query } : {}), ...(highlights ? { isHighlight: 'true' } : {}), medium,
    }, n).catch((e) => { log(`  met: search ${medium} failed: ${e.message}`); return [] }))
  }
  const ids = []
  for (let i = 0; ids.length < n && per.some((l) => i < l.length); i++) {
    for (const l of per) if (i < l.length && ids.length < n && !skip.has(l[i]) && !ids.includes(l[i])) ids.push(l[i])
  }
  return metByIds(ids)
}

async function metByIds(ids) {
  // The Met has no batch endpoint and an Imperva wall: paced to ~1 req/s in http().
  const res = await mapPool(ids, 2, (id) => http(`${MET_API}/v1/objects/${id}`))
  const out = []
  res.forEach((r, i) => {
    if (r?.error) log(`  met: object ${ids[i]} failed: ${r.error.message}`)
    else if (r?.objectID) out.push(r)
  })
  return out
}

export function metArtistName(o, who) {
  if (who.anonymous && !who.people.length) return o.artistDisplayName || 'Unidentified artist'
  const prefix = String(o.artistPrefix ?? '').replace(/\s+/g, ' ').trim()
  const name = String(o.artistDisplayName ?? '').replace(/\s+/g, ' ').trim()
  // The qualifier may be in the prefix or the name ("Workshop of Fra Filippo Lippi"); say it once.
  const dup = prefix && name.toLowerCase().startsWith(prefix.toLowerCase())
  return [dup ? '' : prefix, name].filter(Boolean).join(' ') || null
}

export const met = {
  key: 'met',
  museum: 'The Metropolitan Museum of Art',
  search: (query, n, skip) => metSearch(query, n, false, skip),
  highlights: (n, query, skip) => metSearch(query, n, true, skip),
  byIds: metByIds,
  byInventory: async () => [], // P3634 covers the Met; accession numbers aren't unique there
  idOf: (o) => o.objectID,
  wdRefs: (o) => [`id:${o.objectID}`],
  async normalize(raws) {
    return raws.map((o) => {
      const who = peopleFromMet(o)
      const gate = {
        source: 'met', license_value: o.isPublicDomain,
        type_label: `${o.classification || ''} / ${o.objectName || ''}`, medium: o.medium,
        object_end: Number.isFinite(o.objectEndDate) ? o.objectEndDate : null, who,
        width: null, height: null, // no pixel sizes in the API: probed later
      }
      const qid = (o.objectWikidata_URL || '').match(/Q\d+$/)?.[0] || null
      return record({
        objectId: `met:${o.objectID}`,
        gate,
        prov: {
          artist: metArtistName(o, who),
          artist_dates: mainDates(who),
          original_title: o.title || null,
          original_date: o.objectDate || null,
          museum: 'The Metropolitan Museum of Art',
          credit_line: o.creditLine || null,
          source_url: o.objectURL || `https://www.metmuseum.org/art/collection/search/${o.objectID}`,
        },
        image: { url: o.primaryImage || null, width: null, height: null },
        classification: [o.classification, o.objectName].filter(Boolean).join(' / ') || null,
        highlight: o.isHighlight,
        wing: metWing(o),
        wd: { id: String(o.objectID), qid },
      })
    })
  },
}

// ---- Cleveland Museum of Art ----------------------------------------------

const CMA_API = 'https://openaccess-api.clevelandart.org/api/artworks'
const CMA_TYPES = ['Painting', 'Print', 'Drawing'] // one type per query

async function cmaSearch(query, n, highlights) {
  const per = await Promise.all(CMA_TYPES.map(async (type) => {
    const out = []
    for (let skip = 0; out.length < n && skip < 5000; skip += 100) {
      const qs = new URLSearchParams({
        cc0: '1', has_image: '1', type, limit: String(Math.min(100, n - out.length)), skip: String(skip),
        ...(query ? { q: query } : {}), ...(highlights ? { highlight: '1' } : {}),
      })
      try {
        const d = await http(`${CMA_API}/?${qs}`)
        out.push(...(d.data || []))
        if ((d.data || []).length < Number(qs.get('limit'))) break
      } catch (e) {
        log(`  cma: search ${type} failed: ${e.message}`)
        break
      }
    }
    return out
  }))
  const recs = []
  for (let i = 0; recs.length < n && per.some((l) => i < l.length); i++) {
    for (const l of per) if (i < l.length && recs.length < n) recs.push(l[i])
  }
  return recs
}

/** Numeric CMA id or accession number — the endpoint takes either. */
async function cmaByIds(ids) {
  const res = await mapPool([...new Set(ids)], 3, (id) => http(`${CMA_API}/${encodeURIComponent(id)}`))
  const out = []
  res.forEach((r, i) => {
    if (r?.error) log(`  cma: artwork ${ids[i]} failed: ${r.error.message}`)
    else if (r?.data?.id) out.push(r.data)
  })
  return out
}

function cmaImage(a) {
  const pick = (k) => {
    const im = a.images?.[k]
    return im?.url ? { url: im.url, width: Number(im.width) || null, height: Number(im.height) || null } : null
  }
  const print = pick('print')
  const full = pick('full') // TIFF master; only if the print JPEG is too small
  const long = (im) => Math.max(im?.width || 0, im?.height || 0)
  return print && long(print) >= MIN_LONG_EDGE ? print : full && long(full) >= MIN_LONG_EDGE ? full : print || full || { url: null }
}

export function cmaArtistName(a, who) {
  const cs = a.creators || []
  if (!cs.length) return 'Unknown artist'
  return cs.map((c, i) => {
    const q = (c.qualifier || '').trim()
    const name = stripParen(c.description)
    if (!q) return name
    // Don't repeat a qualifier the description already starts with.
    const shown = name.toLowerCase().startsWith(q.toLowerCase()) ? name : `${q} ${name}`
    return i ? shown : cap(shown)
  }).join(' ').replace(/\s+/g, ' ') || (who.anonymous ? 'Unknown artist' : null)
}

export const cma = {
  key: 'cma',
  museum: 'Cleveland Museum of Art',
  search: (query, n) => cmaSearch(query, n, false),
  highlights: (n, query) => cmaSearch(query, n, true),
  byIds: cmaByIds,
  byInventory: cmaByIds,
  idOf: (a) => a.id,
  wdRefs: (a) => [`id:${a.accession_number}`, `inv:${a.accession_number}`],
  async normalize(raws) {
    return raws.map((a) => {
      const who = peopleFromCma(a)
      const image = cmaImage(a)
      const gate = {
        source: 'cma', license_value: a.share_license_status, type_label: a.type,
        medium: a.technique, object_end: Number.isFinite(a.creation_date_latest) ? a.creation_date_latest : null,
        who, width: image.width, height: image.height,
      }
      const qid = String(a.wikidata || '').match(/Q\d+/)?.[0] || null
      return record({
        objectId: `cma:${a.id}`,
        gate,
        prov: {
          artist: cmaArtistName(a, who),
          artist_dates: mainDates(who),
          original_title: a.title || null,
          original_date: a.creation_date || null,
          museum: 'Cleveland Museum of Art',
          credit_line: a.creditline || a.credit_line || null,
          source_url: a.url || `https://clevelandart.org/art/${a.accession_number}`,
        },
        image,
        highlight: a.is_highlight,
        wing: cmaWing(a),
        wd: { id: a.accession_number || null, inv: a.accession_number || null, qid },
      })
    })
  },
}

export const SOURCES = { aic, met, cma }
