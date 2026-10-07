// A likely gallery wing for each candidate, from the closed tag list in
// PROMPT_GUIDANCE.md ("Gallery tags"): culture or region for non-Western art,
// era for European and American art. It's a hint for ranking and for the
// curator, who still assigns the gallery tag.

import { sparql } from './wikidata.mjs'

export const WESTERN_WINGS = new Set(['Medieval & Byzantine', 'Renaissance & Baroque', '19th Century', 'Modern', 'Contemporary'])

// Checked in this order within each field. Indigenous Americas comes before
// India ("American Indian"); Egypt, the Near East and Greece and Rome are
// split by date below.
const REGIONS = [
  ['americas', /pre-?columbian|\baztec|\bmaya\b|\bmayan\b|\binca\b|olmec|nazca|nasca|\bmoche\b|mississippian|native american|first nations|\bindigenous\b|mexica\b|zapotec|mixtec|teotihuacan|huastec|ta[ií]no|andean|navajo|\bhopi\b|lakota|cheyenne|kiowa/i],
  ['Japanese', /\bjapan(ese)?\b|ukiyo-?e|\bedo period|meiji|tokugawa|\bkan[oō] school|rinpa|yamato-e|nanga|\bedo\b|kyoto|osaka|tokyo|nagasaki/i],
  ['Chinese & Korean', /\bchin(a|ese)\b|\bkorea(n)?\b|joseon|goryeo|\b(qing|ming|song|tang|yuan|han|jin|liao) dynasty|taiwan|beijing|peking|canton|guangzhou|nanjing|nanking|suzhou|hangzhou|jingdezhen|seoul/i],
  ['South & Southeast Asian', /\bindia(n)?\b|mughal|rajput|rajasthan|pahari|deccan|\bnepal(ese)?\b|tibet(an)?|sri lanka|\bthai(land)?\b|cambodia|khmer|burm(a|ese)|myanmar|indonesia|\bjava(nese)?\b|\bbali(nese)?\b|vietnam|\blaos\b|bengal|pakistan|bangladesh|british raj|maratha|sikh empire|delhi|agra|lucknow|calcutta|kolkata|bombay|mumbai|madras|jaipur|golconda/i],
  ['Islamic', /islamic|persia(n)?\b|\biran(ian)?\b|ottoman|safavid|timurid|qajar|mamluk|fatimid|abbasid|umayyad|\barab(ic|ian)?\b|turk(ish|ey)\b|syria|iraq|afghan|uzbek|bukhara|herat|isfahan|tabriz|moorish|nasrid|istanbul|constantinople|cairo/i],
  ['egypt', /\begypt(ian)?\b|fayum|coptic/i],
  ['near-east', /mesopotamia|assyria|babylon|sumer|achaemenid|sasanian|scythian|elamite/i],
  ['Arts of Africa & Oceania', /\bafrica(n)?\b(?! american)|nigeria|\bbenin\b|yoruba|congo|ghana|asante|\bmali\b|ethiopia|kenya|cameroon|gabon|angola|zimbabwe|oceania|polynesia|melanesia|micronesia|m[aā]ori|aborigin|papua|new guinea|hawai|samoa|fiji|tonga|vanuatu|solomon islands/i],
  ['classical', /\bgreece\b|\bgreek\b|\broman\b|etruscan|hellenistic|pompeii|herculaneum|minoan|mycenaean/i],
]
// A field that names one of these is Western art: stop looking at later fields.
const WESTERN = /\b(france|french|ital(y|ian)|spain|spanish|german(y)?|netherlands|dutch|flemish|belgi(um|an)|england|english|britain|british|united kingdom|scotland|scottish|ireland|irish|united states|american|canad(a|ian)|austria(n)?|swiss|switzerland|swed(en|ish)|norw(ay|egian)|denmark|danish|finland|finnish|russia(n)?|poland|polish|czech|hungar(y|ian)|portug(al|uese)|europe(an)?|bohemia|venetian|venice|florentine|florence|holy roman empire|habsburg|prussia|bavaria|saxony|australia(n)?|new zealand|mexic(o|an)|brazil(ian)?|argentin|chile|peru(vian)?|cuba(n)?|colombia|venezuela)\b/i

// Movements, Modern first ("Harlem Renaissance", "Abstract Expressionism").
const ERAS = [
  ['Modern', /cubis|surreal|bauhaus|expressionis|futuris|art deco|fauv|dada|de stijl|neo-plasticism|constructiv|suprematis|abstract|blaue reiter|die brücke|neue sachlichkeit|new objectivity|magic realism|socialist realism|precisionis|vorticis|orphism|rayonism|metaphysical|harlem renaissance|regionalism|ashcan|na[iï]ve art/i],
  ['19th Century', /impressionis|pointillis|divisionis|symbolis|art nouveau|jugendstil|secession|realism|romanticism|neoclassic|barbizon|hudson river|pre-raphaelite|academic|nabis|luminism|biedermeier|orientalis|tonalism|aestheticism|nazarene|peredvizhniki/i],
  ['Renaissance & Baroque', /renaissance|mannerism|baroque|rococo|caravaggis|golden age|netherlandish|flemish|venetian school|utrecht/i],
  ['Medieval & Byzantine', /gothic|byzantine|romanesque|medieval|carolingian|ottonian|insular|\bicons?\b|icon painting/i],
]

function eraOf(movements, year) {
  for (const [wing, re] of ERAS) if (movements.some((m) => re.test(m))) return wing
  if (year == null) return null
  return year < 1400 ? 'Medieval & Byzantine' : year < 1780 ? 'Renaissance & Baroque' : year < 1905 ? '19th Century' : year < 1970 ? 'Modern' : 'Contemporary'
}

/**
 * facts = {fields: [text, …] in priority order (place or culture of origin
 * first, the artist's nationality last), movements: [text, …], year}.
 * Returns a wing from the gallery tag list, or null.
 */
export function wingOf({ fields = [], movements = [], year = null } = {}) {
  for (const f of fields.flat().filter(Boolean).map(String)) {
    const region = REGIONS.find(([, re]) => re.test(f))?.[0]
    if (region === 'egypt') return year != null && year >= 640 ? 'Islamic' : 'Egyptian'
    if (region === 'near-east') return year != null && year >= 650 ? 'Islamic' : 'Ancient Near East'
    if (region === 'classical') { if (year != null && year < 500) return 'Greek & Roman'; continue }
    if (region === 'americas') return 'Arts of the Americas'
    if (region) return region
    if (WESTERN.test(f)) break
  }
  return eraOf(movements, year)
}

export const isWestern = (wing) => WESTERN_WINGS.has(wing)

// ---- ranking ---------------------------------------------------------------

export const ROTATION_MIN_FAME = 10 // the Commons lane's bar for "famous"

/**
 * Famous-first, balanced across wings: the works with a fame score of at least
 * ROTATION_MIN_FAME take turns by wing, each wing's most famous first (round 1
 * is every wing's top work, round 2 every wing's second…), each round in fame
 * order. The rest follow in fame order. Sets `fame.wing_rank` (1 = the wing's
 * most famous) and returns a new array.
 */
export function rankByWing(cands, score) {
  const byFame = (a, b) => score(b) - score(a)
  const wings = new Map()
  for (const c of [...cands].sort(byFame)) {
    const w = c.wing ?? 'unknown'
    if (!wings.has(w)) wings.set(w, [])
    wings.get(w).push(c)
    c.fame.wing_rank = wings.get(w).length
  }
  const famous = cands.filter((c) => score(c) >= ROTATION_MIN_FAME)
  const rest = cands.filter((c) => score(c) < ROTATION_MIN_FAME)
  return [
    ...famous.sort((a, b) => a.fame.wing_rank - b.fame.wing_rank || byFame(a, b)),
    ...rest.sort(byFame),
  ]
}

// ---- per-source facts ------------------------------------------------------

const year = (...ys) => ys.map(Number).find((y) => Number.isFinite(y) && y !== 0) ?? null

export const aicWing = (a) => wingOf({
  fields: [a.place_of_origin, a.department_title, ...(a.style_titles || []), a.artist_display],
  movements: a.style_titles || [], year: year(a.date_start, a.date_end),
})

export const metWing = (o) => wingOf({
  fields: [o.culture, o.country, o.period, o.dynasty, o.department, o.artistNationality],
  year: year(o.objectBeginDate, o.objectEndDate),
})

export const cmaWing = (a) => wingOf({
  fields: [...[].concat(a.culture || []), a.department, ...(a.creators || []).map((c) => c.description)],
  year: year(a.creation_date_earliest, a.creation_date_latest),
})

const isoYear = (s) => { const m = String(s ?? '').match(/^(-?\d{1,4})-/); return m ? Number(m[1]) : null }
const firstYear = (s) => { const m = String(s ?? '').match(/\b\d{3,4}\b/); return m ? Number(m[0]) : null }

/** NGA: the artists' display dates ("Florentine, 1452 - 1519") carry their nationality. */
export const ngaWing = (o, artists = []) => wingOf({
  fields: [...artists.map((a) => a.life), o.attribution],
  year: year(o.beginyear, o.endyear),
})

/** Rijksmuseum: the production places ("Amsterdam", "Japan"), in English. */
export function rijksWing(obj) {
  const pb = obj.produced_by || {}
  const places = [pb, ...[].concat(pb.part || [])].flatMap((p) => [].concat(p.took_place_at || []))
    .flatMap((pl) => [].concat(pl.notation || []).filter((n) => n['@language'] === 'en').map((n) => n['@value']))
  return wingOf({ fields: places, year: isoYear(pb.timespan?.begin_of_the_begin) })
}

/** Getty: each producer's description ("Vincent van Gogh (Dutch, 1853 - 1890)"). */
export const gettyWing = (o) => wingOf({
  fields: [...(o.producers?.values() || [])].map((p) => p.producer),
  year: firstYear(o.date) ?? isoYear(o.end),
})

/** SMK: the creators' nationalities. */
export const smkWing = (o) => wingOf({
  fields: (o.production || []).map((c) => c.creator_nationality),
  year: isoYear(o.production_date?.[0]?.start) ?? isoYear(o.production_date?.[0]?.end),
})

/** Commons: country of origin (P495), culture (P2596), the creators' citizenship (P27), movement (P135). */
export async function wikidataWingFacts(qids) {
  const out = new Map(qids.map((q) => [q, { origin: [], culture: [], citizenship: [], movement: [] }]))
  for (let i = 0; i < qids.length; i += 100) {
    const part = qids.slice(i, i + 100)
    // Without the hint the optimizer starts from the labels and times out.
    for (const r of await sparql(`SELECT ?item ?kind (GROUP_CONCAT(DISTINCT ?l; separator="|") AS ?labels) WHERE {
  hint:Query hint:optimizer "None" .
  VALUES ?item { ${part.map((q) => `wd:${q}`).join(' ')} }
  { ?item wdt:P495 ?x BIND("origin" AS ?kind) } UNION { ?item wdt:P2596 ?x BIND("culture" AS ?kind) }
  UNION { ?item wdt:P135 ?x BIND("movement" AS ?kind) } UNION { ?item wdt:P170 ?c . ?c wdt:P27 ?x BIND("citizenship" AS ?kind) }
  ?x rdfs:label ?l FILTER(LANG(?l) = "en")
} GROUP BY ?item ?kind`, { retries: 4 })) {
      out.get(r.item.replace(/^.*\//, ''))?.[r.kind].push(...String(r.labels).split('|').filter(Boolean))
    }
  }
  return out
}

export const commonsWing = (f, workYear) => wingOf({
  fields: [...(f?.origin || []), ...(f?.culture || []), ...(f?.citizenship || [])],
  movements: f?.movement || [], year: workYear,
})
