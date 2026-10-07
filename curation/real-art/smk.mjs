// SMK, the National Gallery of Denmark, through its open API (api.smk.dk), in
// English (lang=en). No key. Like sources.mjs it only maps records;
// clearance.mjs decides.

import { APPROX_MARGIN, peopleFromCredits } from './clearance.mjs'
import { chunk, http, log } from './lib.mjs'
import { datesFor, record } from './sources.mjs'
import { smkWing } from './wings.mjs'

const API = 'https://api.smk.dk/api/v1/art'
const MUSEUM = 'SMK – National Gallery of Denmark'
const TYPES = ['painting', 'drawing', 'print']
// Roles that name the maker plainly, or a printer or publisher. Any other role
// ("attributed to", "copy after", "workshop of", "after", or one SMK leaves in
// Danish) is an attribution qualifier.
const PLAIN_ROLE = /^(artist|author|designer|producer|publisher|printer|kunstner|forfatter|producent|udgiver|forlægger|trykker)$/i
const yearOf = (t) => (t ? Number(String(t).match(/^-?\d+/)?.[0]) : null)
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** Object numbers ("KMS3716") -> records, 40 a request. */
async function smkByNumbers(nums) {
  const out = []
  for (const part of chunk([...new Set(nums.map(String))], 40)) {
    const qs = new URLSearchParams({ lang: 'en' })
    for (const n of part) qs.append('object_number', n)
    try {
      out.push(...((await http(`${API}/?${qs}`)).items || []))
    } catch (e) {
      log(`  smk: lookup failed: ${e.message.slice(0, 120)}`)
    }
  }
  return out
}

/** Public-domain works with an image matching the query, paintings first. */
async function smkSearch(query, n) {
  const per = []
  for (const type of TYPES) {
    const qs = new URLSearchParams({
      keys: query || '*', filters: `[public_domain:true],[has_image:true],[object_names:${type}]`,
      offset: '0', rows: String(Math.min(n, 500)), lang: 'en',
    })
    per.push(await http(`${API}/search/?${qs}`).then((d) => d.items || []).catch((e) => { log(`  smk: search ${type} failed: ${e.message.slice(0, 120)}`); return [] }))
  }
  const out = []
  for (let i = 0; out.length < n && per.some((l) => i < l.length); i++) {
    for (const l of per) if (i < l.length && out.length < n && !out.some((o) => o.object_number === l[i].object_number)) out.push(l[i])
  }
  return out
}

// ---- records ---------------------------------------------------------------

/** "Haarlem, Cornelis Cornelisz. van" -> "Cornelis Cornelisz. van Haarlem". */
export const smkName = (s) => {
  const t = String(s ?? '').trim()
  const i = t.indexOf(', ')
  return i > 0 ? `${t.slice(i + 2)} ${t.slice(0, i)}` : t || null
}

export function smkCredits(production = []) {
  return production.map((p) => {
    const role = String(p.creator_role || '').trim()
    return {
      name: smkName(p.creator), role, qualifier: role && !PLAIN_ROLE.test(role) ? role : null,
      anonymous: /\b(unknown|ukendt|anonym)/i.test(p.creator || ''),
      birth: yearOf(p.creator_date_of_birth), death: yearOf(p.creator_date_of_death), from: 'production[].creator_date_of_birth/death',
    }
  })
}

/** "Vilhelm Hammershøi", "Copy after Peter Paul Rubens", "Andreas Flint after Johannes Wiedewelt". */
export function smkArtistName(credits) {
  // Printers, publishers, a text's author and rejected attributions aren't named.
  const shown = credits.filter((c) => !/^(publisher|printer|author|udgiver|forlægger|trykker|forfatter|earlier ascribed to|tidligere tilskrevet)$/i.test(c.role))
  const named = shown.filter((c) => !c.anonymous)
  if (!named.length) return 'Unknown artist'
  return cap(named.map((c, i) => {
    const text = c.qualifier ? `${c.qualifier} ${c.name}` : c.name
    return i === 0 ? text : `${/^(copy )?after$/i.test(c.qualifier || '') ? '' : 'and '}${text}`
  }).join(' '))
}

export function smkRecord(o) {
  const credits = smkCredits(o.production)
  const who = peopleFromCredits(credits)
  const dates = o.production_date || []
  const period = dates[0]?.period || null
  const ends = dates.map((d) => yearOf(d.end)).filter((y) => y != null)
  const circa = /\b(c\.|ca\.|circa|omkring|efter)|\?/i.test(period || '')
  const end = ends.length ? Math.max(...ends) + (circa ? APPROX_MARGIN : 0) : null
  const names = (o.object_names || []).map((x) => x.name).filter(Boolean)
  const titles = o.titles || []
  const artist = smkArtistName(credits)
  // A few images have no IIIF service, only a small native file.
  const image = o.has_image && (o.image_iiif_id || o.image_native)
    ? { url: o.image_iiif_id ? `${o.image_iiif_id}/full/full/0/default.jpg` : o.image_native, width: o.image_width ?? null, height: o.image_height ?? null }
    : { url: null }
  const gate = {
    source: 'smk', license_value: { public_domain: o.public_domain ?? null, rights: o.rights ?? null },
    type_label: names.join(' / ') || null, medium: (o.techniques || []).join('; ') || null, object_end: end, who,
    width: image.width ?? null, height: image.height ?? null,
  }
  return record({
    objectId: `smk:${o.object_number}`,
    gate,
    prov: {
      artist,
      artist_dates: datesFor(who, artist),
      original_title: (titles.find((t) => /engelsk|english/i.test(t.language || '')) || titles[0])?.title || null,
      original_date: period,
      museum: MUSEUM,
      credit_line: null,
      source_url: o.frontend_url || `https://open.smk.dk/artwork/image/${encodeURIComponent(o.object_number)}`,
    },
    image,
    highlight: false,
    wing: smkWing(o),
    wd: { inv: o.object_number },
  })
}

export const smk = {
  key: 'smk',
  museum: MUSEUM,
  search: smkSearch,
  highlights: async () => [], // the API flags no highlights
  byIds: smkByNumbers,
  byInventory: smkByNumbers,
  byFameKeys: (keys, n) => smkByNumbers([...new Set(keys.map((k) => k.value))].slice(0, n)),
  idOf: (o) => o.object_number,
  wdRefs: (o) => [`inv:${o.object_number}`],
  normalize: async (items) => items.map(smkRecord),
}
