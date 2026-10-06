// The Wikimedia Commons lane: famous paintings found on Wikidata, imaged from
// their Commons file (P18). It reaches works whose museums publish no open
// images (the Louvre, the Prado, MoMA…). Like sources.mjs it only maps records;
// clearance.mjs decides, with two extra checks for this lane.

import {
  ANONYMOUS_QID, APPROX_MARGIN, COMMONS_PAINTING_TYPES, COMMONS_PANEL_TYPES, commonsLicence, natureWord, peopleFromWikidata,
} from './clearance.mjs'
import { chunk, http, log } from './lib.mjs'
import { formatDates, record } from './sources.mjs'
import { sparql, WD } from './wikidata.mjs'

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'
const TYPE_LABELS = { ...COMMONS_PAINTING_TYPES, ...COMMONS_PANEL_TYPES }
const TYPES = Object.keys(TYPE_LABELS)
export const FAMOUS_MIN_WP = 10 // Wikipedia editions
export const QUERY_MIN_WP = 3
const BATCH = 150
const CIRCA = 'Q5727902'

// The open museums we source directly. Their works always come from the museum.
const OPEN_MUSEUM = Object.fromEntries(Object.entries(WD).map(([k, v]) => [v.museum, k]))
const OPEN_MUSEUM_ID = Object.fromEntries(Object.entries(WD).map(([k, v]) => [v.idProp, k]))

const ENTITY = 'http://www.wikidata.org/entity/'
/** An item IRI -> "Q45585"; an unknown value (a .well-known/genid IRI) -> null. */
const qidOf = (iri) => (String(iri ?? '').startsWith(ENTITY) ? iri.slice(ENTITY.length) : null)
const VALUES = (qids) => `VALUES ?item { ${qids.map((q) => `wd:${q}`).join(' ')} }`
const NOT_DEPRECATED = (st) => `${st} wikibase:rank ${st}Rank . FILTER(${st}Rank != wikibase:DeprecatedRank)`
const split = (s, sep = ' ') => String(s ?? '').split(sep).filter(Boolean)
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
// An English label, else the language-neutral "mul" one (many names only have that).
const LABEL = (x, out) => `OPTIONAL { ${x} rdfs:label ${out}En FILTER(LANG(${out}En) = "en") } OPTIONAL { ${x} rdfs:label ${out}Mul FILTER(LANG(${out}Mul) = "mul") } BIND(COALESCE(${out}En, ${out}Mul) AS ${out})`

// ---- dates -----------------------------------------------------------------

/** "1889-01-01T00:00:00Z" -> 1889; "-0480-…" -> -480. */
const yearOf = (t) => {
  const m = String(t ?? '').match(/^([+-]?)(\d+)-/)
  return m ? (m[1] === '-' ? -1 : 1) * Number(m[2]) : null
}
const ordinal = (n) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`

/**
 * A Wikidata time at its precision (9 = year or finer, 8 = decade, 7 = century,
 * 6 = millennium). `latest` is the last year it allows: the gate judges that.
 */
function timeOf(t, precision, circa) {
  const year = yearOf(t)
  const p = Number(precision)
  if (year == null || !(p >= 6)) return null
  const decade = Math.floor(year / 10) * 10
  const latest = p >= 9 ? year : p === 8 ? decade + 9 : year + (p === 7 ? 99 : 999)
  const label = p >= 9 ? null : p === 8 ? `${decade}s` : p === 7 ? `${ordinal(Math.floor((year - 1) / 100) + 1)} century` : `${ordinal(Math.floor((year - 1) / 1000) + 1)} millennium`
  return { year, latest, label, circa: !!circa, approx: p < 9 || !!circa }
}
const shownYear = (d) => d.label || `${d.circa ? 'c. ' : ''}${d.year < 0 ? `${-d.year} BC` : d.year}`

/** The work's date as people write it: "1889", "c. 1665", "1503–1506", "15th century". */
function dateText(all) {
  if (!all.length) return null
  const dates = all.some((d) => d.preferred) ? all.filter((d) => d.preferred) : all
  const lo = Math.min(...dates.map((d) => d.year))
  const hi = Math.max(...dates.map((d) => d.until ?? d.year))
  const first = dates.find((d) => d.year === lo)
  return hi === lo || first.label ? shownYear(first) : `${first.circa ? 'c. ' : ''}${lo}–${hi}`
}

// ---- Wikimedia APIs --------------------------------------------------------

/**
 * A MediaWiki API call. `maxlag` (Commons) asks it to refuse while its databases
 * lag, as Wikimedia asks of bots; then wait and retry. Wikidata's maxlag also
 * counts query-service lag, which often sits above 5 s for minutes and has
 * nothing to do with a search, so Wikidata reads go without it.
 */
async function mwApi(url, params, { maxlag = true } = {}) {
  const body = new URLSearchParams({ format: 'json', formatversion: '2', ...(maxlag ? { maxlag: '5' } : {}), ...params }).toString()
  for (let i = 0; ; i++) {
    const d = await http(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
    if (d.error?.code === 'maxlag' && i < 6) {
      await new Promise((r) => setTimeout(r, 1000 * Math.min(30, Math.max(5, Number(d.error.lag) || 0) * (i + 1))))
      continue
    }
    if (d.error) throw new Error(`${new URL(url).host}: ${d.error.code}: ${d.error.info}`)
    return d
  }
}

const dropQuery = (u) => (u ? u.split('?')[0] : null) // Commons appends utm_* tracking parameters

/**
 * imageinfo for Commons files (names as in P18), 50 a request: size, licence
 * metadata, the original's URL, and with `width` a rendition that wide
 * (Commons rounds it up to its next standard thumbnail width).
 */
export async function commonsImageInfo(files, { width } = {}) {
  const out = new Map()
  for (const part of chunk([...new Set(files)], 50)) {
    const d = await mwApi(COMMONS_API, {
      action: 'query', prop: 'imageinfo', redirects: '1', titles: part.map((f) => `File:${f}`).join('|'),
      iiprop: 'size|url|mime|extmetadata', iiextmetadatafilter: 'License|LicenseShortName|Copyrighted|Categories',
      ...(width ? { iiurlwidth: String(width) } : {}),
    })
    // Key each answer by the name we asked for, through any redirect and normalization.
    const norm = new Map((d.query?.normalized || []).map((n) => [n.to, n.from]))
    const redir = new Map((d.query?.redirects || []).map((n) => [n.to, n.from]))
    for (const p of d.query?.pages || []) {
      const viaRedirect = redir.get(p.title) ?? p.title
      const asked = (norm.get(viaRedirect) ?? viaRedirect).replace(/^File:/, '')
      const ii = p.imageinfo?.[0]
      const em = ii?.extmetadata || {}
      out.set(asked, ii ? {
        file: p.title.replace(/^File:/, ''), width: ii.width, height: ii.height, mime: ii.mime,
        url: dropQuery(ii.url), page: ii.descriptionurl,
        thumb: ii.thumburl ? { url: dropQuery(ii.thumburl), width: ii.thumbwidth, height: ii.thumbheight } : null,
        License: em.License?.value ?? null, LicenseShortName: em.LicenseShortName?.value ?? null,
        Copyrighted: em.Copyrighted?.value ?? null, categories: split(em.Categories?.value, '|'),
      } : null)
    }
  }
  return out
}

// ---- Wikidata --------------------------------------------------------------

/** Every painting with 10+ sitelinks (a cheap superset of 10+ Wikipedia editions), most-linked first. */
async function famousQids(n) {
  const rows = await sparql(`SELECT DISTINCT ?item ?links WHERE {
  VALUES ?type { ${TYPES.map((t) => `wd:${t}`).join(' ')} }
  ?item wdt:P31 ?type ; wikibase:sitelinks ?links . FILTER(?links >= ${FAMOUS_MIN_WP})
}`)
  // ORDER BY ... LIMIT times out on the server; ~1,700 rows sort fine here.
  const links = new Map(rows.map((r) => [qidOf(r.item), Number(r.links)]))
  return [...links].sort((a, b) => b[1] - a[1]).slice(0, n).map(([q]) => q)
}

/**
 * Paintings matching a theme, through Wikidata's own search (labels, descriptions,
 * aliases): the 500 best-linked matches, a fame proxy. Only those above the fame
 * floor are hydrated.
 */
async function searchQids(query) {
  const d = await mwApi(WIKIDATA_API, {
    action: 'query', list: 'search', srnamespace: '0', srlimit: '500', srsort: 'incoming_links_desc', srprop: '',
    srsearch: `${query} haswbstatement:${TYPES.map((t) => `P31=${t}`).join('|')}`,
  }, { maxlag: false })
  return (d.query?.search || []).map((s) => s.title).filter((t) => /^Q\d+$/.test(t))
}

const blank = (qid) => ({ qid, wp: 0, label: null, images: [], types: [], materials: [], materialLabels: [], locations: [], museumIds: [], dates: [], persons: [], holders: [] })

/** Everything the gate and the record need, for items with at least `minWp` Wikipedia editions. */
async function hydrate(qids, minWp) {
  const items = new Map(qids.map((q) => [q, blank(q)]))
  for (const part of chunk(qids, BATCH)) {
    // Without the hint the optimizer starts from every Wikipedia article and times out.
    for (const r of await sparql(`SELECT ?item (COUNT(DISTINCT ?wiki) AS ?wp) WHERE {
  hint:Query hint:optimizer "None" . ${VALUES(part)}
  ?article schema:about ?item ; schema:isPartOf ?wiki . ?wiki wikibase:wikiGroup "wikipedia" .
} GROUP BY ?item`)) items.get(qidOf(r.item)).wp = Number(r.wp)
  }
  const keep = qids.filter((q) => items.get(q).wp >= minWp)
  for (const part of chunk(keep, BATCH)) {
    const V = VALUES(part)
    for (const r of await sparql(`SELECT ?item (SAMPLE(?l) AS ?label)
  (GROUP_CONCAT(DISTINCT STR(?img); separator="\\t") AS ?images) (GROUP_CONCAT(DISTINCT ?ty) AS ?types)
  (GROUP_CONCAT(DISTINCT ?ma) AS ?materials) (GROUP_CONCAT(DISTINCT ?mal; separator=", ") AS ?materialLabels)
  (GROUP_CONCAT(DISTINCT ?lo) AS ?locations) (GROUP_CONCAT(DISTINCT ?mid) AS ?museumIds)
WHERE { ${V}
  ${LABEL('?item', '?l')}
  OPTIONAL { ?item wdt:P18 ?img }
  OPTIONAL { ?item wdt:P31 ?t BIND(STRAFTER(STR(?t), STR(wd:)) AS ?ty) }
  OPTIONAL { ?item wdt:P186 ?m BIND(STRAFTER(STR(?m), STR(wd:)) AS ?ma) OPTIONAL { ?m rdfs:label ?mal FILTER(LANG(?mal) = "en") } }
  OPTIONAL { ?item wdt:P276 ?l BIND(STRAFTER(STR(?l), STR(wd:)) AS ?lo) }
  OPTIONAL { VALUES ?mp { ${Object.keys(OPEN_MUSEUM_ID).map((p) => `wdt:${p}`).join(' ')} } ?item ?mp [] BIND(STRAFTER(STR(?mp), STR(wdt:)) AS ?mid) }
} GROUP BY ?item`)) {
      const it = items.get(qidOf(r.item))
      it.label = r.label || null
      it.images = split(r.images, '\t').map((u) => decodeURIComponent(u.replace(/^.*\/Special:FilePath\//, '')).replace(/_/g, ' '))
      it.types = split(r.types)
      it.materials = split(r.materials)
      it.materialLabels = split(r.materialLabels, ', ')
      it.locations = split(r.locations)
      it.museumIds = split(r.museumIds)
    }
    // Inception (P571). An explicit range (earliest P1319, latest P1326) beats the precision.
    for (const r of await sparql(`SELECT ?item ?t ?p ?circa ?early ?late ?stRank WHERE { ${V}
  ?item p:P571 ?st . ${NOT_DEPRECATED('?st')}
  ?st psv:P571 [ wikibase:timeValue ?t ; wikibase:timePrecision ?p ] .
  OPTIONAL { ?st pq:P1480 wd:${CIRCA} BIND(true AS ?circa) }
  OPTIONAL { ?st pq:P1319 ?early }
  OPTIONAL { ?st pq:P1326 ?late }
}`)) {
      const d = timeOf(r.t, r.p, r.circa)
      if (!d) continue
      const early = yearOf(r.early)
      const late = yearOf(r.late)
      if (late != null) Object.assign(d, { year: early ?? Math.min(d.year, late), until: late, latest: late, label: null })
      else if (d.circa) d.latest += APPROX_MARGIN // as for a circa death year; "c. 1925" may be 1935
      d.preferred = r.stRank === 'http://wikiba.se/ontology#PreferredRank'
      items.get(qidOf(r.item)).dates.push(d)
    }
    // Creators (P170) and attributions, on the item or as qualifiers of its P170.
    const people = new Map()
    for (const r of await sparql(`SELECT ?item ?st ?kind ?p ?pl ?nature ?b ?bp ?bc ?d ?dp ?dc WHERE { ${V}
  {
    ?item p:P170 ?st . ${NOT_DEPRECATED('?st')} ?st ps:P170 ?p . BIND("creator" AS ?kind)
    OPTIONAL { ?st pq:P5102|pq:P1480 ?n . OPTIONAL { ?n rdfs:label ?nature FILTER(LANG(?nature) = "en") } }
  } UNION {
    VALUES (?qp ?kind) { (pq:P1773 "attributed to") (pq:P1774 "workshop of") (pq:P1779 "possibly") (pq:P1780 "school of") (pq:P1877 "after") }
    ?item p:P170 ?st . ?st ?qp ?p .
  } UNION {
    VALUES (?ip ?kind) { (wdt:P1773 "attributed to") (wdt:P1774 "workshop of") (wdt:P1779 "possibly") (wdt:P1780 "school of") (wdt:P1877 "after") }
    ?item ?ip ?p . BIND(?ip AS ?st)
  }
  ${LABEL('?p', '?pl')}
  OPTIONAL { ?p p:P569 ?bs . ${NOT_DEPRECATED('?bs')} ?bs psv:P569 [ wikibase:timeValue ?b ; wikibase:timePrecision ?bp ] .
    OPTIONAL { ?bs pq:P1480 wd:${CIRCA} BIND(true AS ?bc) } }
  OPTIONAL { ?p p:P570 ?ds . ${NOT_DEPRECATED('?ds')} ?ds psv:P570 [ wikibase:timeValue ?d ; wikibase:timePrecision ?dp ] .
    OPTIONAL { ?ds pq:P1480 wd:${CIRCA} BIND(true AS ?dc) } }
}`)) {
      // One person per statement, however many dates; an unknown value is its own person.
      const key = `${r.item}|${r.st}|${r.kind}|${r.p}`
      let p = people.get(key)
      if (!p) {
        p = { kind: r.kind, qid: qidOf(r.p), label: r.pl || null, nature: null, births: [], deaths: [] }
        people.set(key, p)
        items.get(qidOf(r.item)).persons.push(p)
      }
      if (r.nature) p.nature = r.nature
      const b = timeOf(r.b, r.bp, r.bc)
      const d = timeOf(r.d, r.dp, r.dc)
      if (b && !p.births.some((x) => x.year === b.year)) p.births.push(b)
      if (d && !p.deaths.some((x) => x.year === d.year)) p.deaths.push(d)
    }
    // SPARQL rows come in no fixed order; the artist's name must not change between runs.
    const rank = (p) => (p.kind === 'creator' && !p.nature ? 0 : 1)
    for (const q of part) items.get(q).persons.sort((a, b) => rank(a) - rank(b) || String(a.label ?? '~').localeCompare(String(b.label ?? '~')))
    for (const p of people.values()) {
      // Several dates: the gate takes the latest (the conservative bound).
      const latest = (ds) => ds.reduce((a, x) => (!a || x.latest > a.latest ? x : a), null)
      const b = latest(p.births)
      const d = latest(p.deaths)
      Object.assign(p, {
        birth: b?.latest ?? null, birthApprox: !!b?.approx, death: d?.latest ?? null, deathApprox: !!d?.approx,
        shown: { birth: b?.year ?? null, birthApprox: !!b?.circa, birthLabel: b?.label ?? null, death: d?.year ?? null, deathApprox: !!d?.circa, deathLabel: d?.label ?? null },
      })
    }
    // Current holders (P195 with no end time), who runs them, and what they're part of.
    for (const r of await sparql(`SELECT ?item ?h (SAMPLE(?hl) AS ?label) (SAMPLE(?hsl) AS ?links)
  (GROUP_CONCAT(DISTINCT ?cty) AS ?countries) (GROUP_CONCAT(DISTINCT ?ht) AS ?types) (GROUP_CONCAT(DISTINCT ?htl; separator="|") AS ?typeLabels)
  (GROUP_CONCAT(DISTINCT ?who; separator="\\t") AS ?runBy) (GROUP_CONCAT(DISTINCT ?par; separator="\\t") AS ?parents)
WHERE { ${V}
  ?item p:P195 ?st . ${NOT_DEPRECATED('?st')} ?st ps:P195 ?h . FILTER NOT EXISTS { ?st pq:P582 [] }
  ${LABEL('?h', '?hl')}
  OPTIONAL { ?h wikibase:sitelinks ?hsl }
  OPTIONAL { ?h wdt:P17 ?c BIND(STRAFTER(STR(?c), STR(wd:)) AS ?cty) }
  OPTIONAL { ?h wdt:P31 ?t BIND(STRAFTER(STR(?t), STR(wd:)) AS ?ht) OPTIONAL { ?t rdfs:label ?htl FILTER(LANG(?htl) = "en") } }
  OPTIONAL { ?h wdt:P127|wdt:P137 ?w . ${LABEL('?w', '?wl')} OPTIONAL { ?w wdt:P31 ?wt }
    BIND(CONCAT(STRAFTER(STR(?w), STR(wd:)), "~", COALESCE(STRAFTER(STR(?wt), STR(wd:)), ""), "~", COALESCE(?wl, "")) AS ?who) }
  OPTIONAL { ?h wdt:P361 ?pa . ${LABEL('?pa', '?pal')}
    BIND(CONCAT(STRAFTER(STR(?pa), STR(wd:)), "~", COALESCE(?pal, "")) AS ?par) }
} GROUP BY ?item ?h`)) {
      const qid = qidOf(r.h)
      if (!qid) continue // "unknown value": no holder we can check
      const runBy = new Map()
      for (const s of split(r.runBy, '\t')) {
        const [q, type, label] = s.split('~')
        const w = runBy.get(q) ?? { qid: q, types: [], label: label || null }
        if (type) w.types.push(type)
        runBy.set(q, w)
      }
      items.get(qidOf(r.item)).holders.push({
        qid, label: r.label || null, links: Number(r.links) || 0, countries: split(r.countries), types: split(r.types),
        typeLabels: split(r.typeLabels, '|'), runBy: [...runBy.values()],
        parents: split(r.parents, '\t').map((s) => { const [q, label] = s.split('~'); return { qid: q, label: label || null } }),
      })
    }
  }
  return keep.map((q) => items.get(q))
}

// ---- records ---------------------------------------------------------------

/** "Rembrandt", "Workshop of Rembrandt", "Peter Paul Rubens and Jan Brueghel the Elder", "Unknown artist". */
export function wikidataArtistName(persons) {
  const byQid = new Map()
  for (const p of persons) {
    if (!p.qid || p.qid === ANONYMOUS_QID) continue
    const prev = byQid.get(p.qid)
    // Say an attribution when one is made; a bare creator statement says less.
    if (!prev || (prev.kind === 'creator' && !prev.nature && (p.kind !== 'creator' || p.nature))) byQid.set(p.qid, p)
  }
  if (!byQid.size) return 'Unknown artist'
  return [...byQid.values()].map((p, i) => {
    const qual = p.kind !== 'creator' ? p.kind : p.nature ? natureWord(p.nature) : ''
    const shown = qual ? `${qual} ${p.label || p.qid}` : p.label || p.qid
    return i ? shown : cap(shown)
  }).join(' and ')
}

/**
 * The holder to name: a department or sub-collection names its parent
 * ("Department of Paintings of the Louvre" -> Louvre); one also held by its own
 * parent drops out; then where it hangs (P276), then the best-known.
 */
export function shownHolder(it) {
  const qids = new Set(it.holders.map((h) => h.qid))
  const named = it.holders
    .filter((h) => !h.parents.some((p) => qids.has(p.qid)))
    .map((h) => {
      const parent = /department|collection/i.test(h.typeLabels.join(' ')) && h.parents.find((p) => p.label)
      return parent ? { ...h, label: parent.label, rolledFrom: h.label } : h
    })
  named.sort((a, b) => Number(it.locations.includes(b.qid)) - Number(it.locations.includes(a.qid)) || b.links - a.links)
  return named.find((h) => h.label) || null
}

/** The open museum (aic/met/cma) that holds this work, by collection or object ID, or null. */
const heldByOpenMuseum = (it) =>
  it.holders.flatMap((h) => [h.qid, ...h.parents.map((p) => p.qid)]).map((q) => OPEN_MUSEUM[q]).find(Boolean) ||
  it.museumIds.map((p) => OPEN_MUSEUM_ID[p]).find(Boolean) || null

function toRecord(it, info) {
  const who = peopleFromWikidata(it.persons)
  const licence = info ? { file: info.file, License: info.License, LicenseShortName: info.LicenseShortName, Copyrighted: info.Copyrighted, categories: info.categories } : null
  const typeLabel = it.types.map((t) => TYPE_LABELS[t]).filter(Boolean).join(' | ') || it.types.join(' ') || null
  const latest = it.dates.length ? Math.max(...it.dates.map((d) => d.latest)) : null
  const main = it.persons.find((p) => p.kind === 'creator' && p.qid && p.qid !== ANONYMOUS_QID) || it.persons.find((p) => p.qid && p.qid !== ANONYMOUS_QID)
  const holder = shownHolder(it)
  const gate = {
    source: 'commons', license_value: licence, type_label: typeLabel, medium: it.materialLabels.join(', ') || null,
    object_end: latest, who, width: info?.width ?? null, height: info?.height ?? null,
    p31: it.types, p186: it.materials,
    holders: it.holders.map(({ qid, label, countries, types, runBy }) => ({ qid, label, countries, types, runBy })),
  }
  const rec = record({
    objectId: `wd:${it.qid}`,
    gate,
    prov: {
      artist: wikidataArtistName(it.persons),
      artist_dates: main ? formatDates(main.shown) : null,
      original_title: it.label,
      original_date: dateText(it.dates),
      museum: holder?.label ? cap(holder.label) : 'Unknown collection',
      credit_line: info ? `Image: Wikimedia Commons, ${info.file}` : null,
      source_url: info?.page || `https://www.wikidata.org/wiki/${it.qid}`,
    },
    image: { url: info?.url ?? null, width: info?.width, height: info?.height },
    classification: typeLabel,
    wd: { qid: it.qid },
  })
  rec.fame.wikipedia_langs = it.wp
  rec._heldBy = heldByOpenMuseum(it)
  return rec
}

/** Of an item's P18 files, a public-domain one first, then the largest. */
function pickImage(it, infos) {
  const long = (i) => Math.max(i.width || 0, i.height || 0)
  return it.images.map((f) => infos.get(f)).filter(Boolean)
    .sort((a, b) => Number(commonsLicence(b).ok) - Number(commonsLicence(a).ok) || long(b) - long(a))[0] || null
}

export const commons = {
  key: 'commons',
  museum: 'Wikimedia Commons',
  fameBuiltIn: true,
  /** ids: QIDs to check; else a Wikidata search for `query`; else the `n` most famous. */
  async collect({ ids, famous, query, n }) {
    let qids
    let minWp = 0
    if (ids) qids = [...new Set(ids.map((s) => s.toUpperCase()))]
    else if (query) { qids = await searchQids(query); minWp = famous ? FAMOUS_MIN_WP : QUERY_MIN_WP }
    else { qids = await famousQids(n); minWp = FAMOUS_MIN_WP }
    const items = await hydrate(qids, minWp)
    const infos = await commonsImageInfo(items.flatMap((it) => it.images))
    log(`  commons: ${qids.length} Wikidata items -> ${items.length}${minWp ? ` with ${minWp}+ Wikipedia editions` : ''}`)
    return items.map((it) => toRecord(it, pickImage(it, infos)))
  },
}
