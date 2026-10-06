// The J. Paul Getty Museum, through its public SPARQL endpoint (data.getty.edu,
// Linked Art in CIDOC-CRM) and each work's IIIF manifest (the image's rights and
// size). No key. Like sources.mjs it only maps records; clearance.mjs decides.

import { GETTY_TYPES, LICENSE_RULES, peopleFromCredits } from './clearance.mjs'
import { chunk, fold, http, log, mapPool } from './lib.mjs'
import { datesFor, record } from './sources.mjs'

const SPARQL = 'https://data.getty.edu/museum/collection/sparql'
const OBJECT = 'https://data.getty.edu/museum/collection/object/'
const PAGE = 'https://www.getty.edu/art/collection/object/'
const LOCAL = 'https://data.getty.edu/local/thesaurus/'
const AAT = 'http://vocab.getty.edu/aat/'
const MUSEUM = 'J. Paul Getty Museum'
const ARTWORK = `${AAT}300133025` // every object carries it; it says nothing
const FLAT_SEARCH = ['300033618', '300033656', '300041273', '300033973', '300076922', '300033936']
const CC0 = 'http://creativecommons.org/publicdomain/zero/1.0/'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const lit = (s) => JSON.stringify(String(s))
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const yearOf = (t) => (t ? Number(String(t).match(/^-?\d+/)?.[0]) : null)

async function sparql(query) {
  const d = await http(SPARQL, {
    method: 'POST', timeoutMs: 120_000,
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ query: `PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>\n${query}` }).toString(),
  })
  return d.results.bindings.map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])))
}

// ---- finding objects -------------------------------------------------------

/** UUIDs, page slugs ("103JNH", as Wikidata's P2582 has them) or accession numbers ("90.PA.20") -> object IRIs, in order. */
async function resolve(tokens) {
  const uniq = [...new Set(tokens.map((t) => String(t).trim()).filter(Boolean))]
  const out = new Map(uniq.filter((t) => UUID.test(t)).map((t) => [t, `${OBJECT}${t.toLowerCase()}`]))
  const rest = uniq.filter((t) => !UUID.test(t))
  for (const part of chunk(rest, 100)) {
    const slugs = part.filter((t) => !t.includes('.'))
    const accs = part.filter((t) => t.includes('.'))
    const unions = []
    if (slugs.length) unions.push(`{ VALUES (?page ?key) { ${slugs.map((s) => `(<${PAGE}${encodeURIComponent(s)}> ${lit(s)})`).join(' ')} } ?o crm:P129i_is_subject_of ?page }`)
    if (accs.length) unions.push(`{ VALUES ?key { ${accs.map(lit).join(' ')} } ?o crm:P1_is_identified_by ?i . ?i crm:P2_has_type <${AAT}300312355> ; crm:P190_has_symbolic_content ?key }`)
    for (const r of await sparql(`SELECT ?o ?key WHERE { ${unions.join(' UNION ')} }`)) if (!out.has(r.key)) out.set(r.key, r.o)
  }
  return uniq.map((t) => out.get(t)).filter(Boolean)
}

/** CC0 flat works whose title has most of the query's words. */
async function searchIris(query, n) {
  const words = [...new Set(fold(query).split(/[^a-z0-9]+/).filter((w) => w.length > 2))]
  if (!words.length) return []
  const rows = await sparql(`SELECT DISTINCT ?o ?title WHERE {
  VALUES ?t { ${FLAT_SEARCH.map((t) => `<${AAT}${t}>`).join(' ')} }
  ?o crm:P2_has_type ?t ; crm:P104_is_subject_to/crm:P2_has_type <${CC0}> .
  ?o crm:P1_is_identified_by ?n . ?n crm:P2_has_type <${LOCAL}object-title-primary> ; crm:P190_has_symbolic_content ?title .
  FILTER(${words.map((w) => `CONTAINS(LCASE(STR(?title)), ${lit(w)})`).join(' || ')})
} LIMIT 2000`)
  const score = (t) => words.filter((w) => fold(t).includes(w)).length
  return rows.sort((a, b) => score(b.title) - score(a.title)).map((r) => r.o).filter((o, i, all) => all.indexOf(o) === i).slice(0, n)
}

// ---- hydrate ---------------------------------------------------------------

const KINDS = `VALUES (?dt ?kind) { (<${AAT}300435418> "credit") (<${AAT}300435429> "medium") }`
const PRODUCER_KINDS = `VALUES (?dt ?kind) { (<${LOCAL}producer-description> "producer") (<${LOCAL}producer-name-prefix> "prefix") (<${LOCAL}producer-name> "pname") (<${LOCAL}nationality-and-dates> "pdates") }`

/** Everything the gate and the record need, one SPARQL query per 50 objects. */
async function hydrate(iris) {
  const objs = new Map(iris.map((o) => [o, { iri: o, types: [], rights: [], producers: new Map() }]))
  for (const part of chunk(iris, 50)) {
    const rows = await sparql(`SELECT ?o ?kind ?k ?v WHERE {
  VALUES ?o { ${part.map((o) => `<${o}>`).join(' ')} }
  { ?o crm:P1_is_identified_by ?n . ?n crm:P2_has_type <${LOCAL}object-title-primary> ; crm:P190_has_symbolic_content ?v . BIND("title" AS ?kind) }
  UNION { ?o crm:P1_is_identified_by ?n . ?n crm:P2_has_type <${AAT}300312355> ; crm:P190_has_symbolic_content ?v . BIND("acc" AS ?kind) }
  UNION { ?o crm:P2_has_type ?v . FILTER(STRSTARTS(STR(?v), "${AAT}")) BIND("type" AS ?kind) }
  UNION { ?o crm:P104_is_subject_to/crm:P2_has_type ?v . FILTER(CONTAINS(STR(?v), "creativecommons.org/") || CONTAINS(STR(?v), "rightsstatements.org/")) BIND("rights" AS ?kind) }
  UNION { ?o crm:P129i_is_subject_of ?v . FILTER(STRSTARTS(STR(?v), "${PAGE}") || CONTAINS(STR(?v), "/iiif/manifest/3/")) BIND("page" AS ?kind) }
  UNION { ?o crm:P67i_is_referred_to_by ?d . ?d crm:P2_has_type ?dt ; crm:P190_has_symbolic_content ?v . ${KINDS} }
  UNION { ?o crm:P108i_was_produced_by ?p . ?p crm:P67i_is_referred_to_by ?d . ?d crm:P2_has_type ?dt ; crm:P190_has_symbolic_content ?v . BIND(STR(?d) AS ?k) ${PRODUCER_KINDS} }
  UNION { ?o crm:P108i_was_produced_by/crm:P4_has_time-span ?ts .
    { ?ts crm:P82a_begin_of_the_begin ?v . BIND("begin" AS ?kind) } UNION { ?ts crm:P82b_end_of_the_end ?v . BIND("end" AS ?kind) }
    UNION { ?ts crm:P1_is_identified_by/crm:P190_has_symbolic_content ?v . BIND("date" AS ?kind) } }
}`)
    for (const r of rows) {
      const o = objs.get(r.o)
      if (r.kind === 'type') o.types.push(r.v)
      else if (r.kind === 'rights') o.rights.push(r.v)
      else if (r.kind === 'page') o[r.v.includes('/iiif/manifest/') ? 'manifest' : 'page'] = r.v
      else if (['producer', 'prefix', 'pname', 'pdates'].includes(r.kind)) {
        // One producer's statements share their production part's IRI.
        const key = r.k.replace(/\/[^/]+$/, '')
        const p = o.producers.get(key) || {}
        p[r.kind] = r.v
        o.producers.set(key, p)
      } else o[r.kind] ??= r.v
    }
  }
  return [...objs.values()].filter((o) => o.title || o.acc)
}

/** The IIIF manifest: the image's own rights, its size and its image service. */
async function manifestOf(url) {
  const m = await http(url)
  const canvas = (m.items || [])[0] || {}
  const body = canvas.items?.[0]?.items?.[0]?.body || {}
  const service = [body.service].flat().filter(Boolean)[0]
  const base = service?.id || service?.['@id'] || null
  return { rights: m.rights || null, width: canvas.width || body.width || null, height: canvas.height || body.height || null, base }
}

// ---- records ---------------------------------------------------------------

/**
 * Producers -> the gate's credits. "Vincent van Gogh (Dutch, 1853 - 1890)".
 * Any name prefix ("Attributed to", "Workshop of the", "Close to", "Forged by")
 * counts as a qualifier: none of them says plainly that this person made it.
 */
export function gettyCredits(producers) {
  return producers.map((p) => {
    const name = (p.pname || String(p.producer || '').replace(/\s*\(.*$/s, '')).trim() || null
    return {
      name, qualifier: p.prefix?.trim() || null, anonymous: /\b(unknown|anonymous)\b/i.test(name || ''),
      life: p.pdates || String(p.producer || '').match(/\(([^)]*)\)\s*$/)?.[1] || '', from: 'producer description',
    }
  })
}

export function gettyRecord(o, manifest = null) {
  const producers = [...o.producers.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, p]) => p)
  const who = peopleFromCredits(gettyCredits(producers))
  const own = o.rights.find((r) => /creativecommons|rightsstatements/.test(r)) || null
  // The object and its image must both be CC0; a disagreement fails the licence check.
  const rights = manifest?.rights && own && manifest.rights !== own ? `object ${own}; image ${manifest.rights}` : manifest?.rights || own
  const types = [...new Set(o.types)].filter((t) => t !== ARTWORK).map((t) => GETTY_TYPES[t.replace(AAT, 'aat:')] || t.replace(AAT, 'aat:'))
  const artist = producers.map((p) => [p.prefix, p.pname || String(p.producer || '').replace(/\s*\(.*$/s, '')].filter(Boolean).join(' ').trim()).filter(Boolean).join(' and ') ||
    (who.anonymous ? 'Unknown artist' : null)
  const gate = {
    source: 'getty', license_value: rights, type_label: types.join(' / ') || null, medium: o.medium || null,
    object_end: yearOf(o.end), who, width: manifest?.width ?? null, height: manifest?.height ?? null,
  }
  const slug = o.page?.startsWith(PAGE) ? o.page.slice(PAGE.length) : null
  return record({
    objectId: `getty:${o.iri.replace(OBJECT, '')}`,
    gate,
    prov: {
      artist: cap(artist),
      artist_dates: datesFor(who, artist),
      original_title: o.title || null,
      original_date: o.date || null,
      museum: MUSEUM,
      credit_line: o.credit || null,
      source_url: o.page || o.iri,
    },
    image: { url: manifest?.base ? `${manifest.base}/full/max/0/default.jpg` : null, width: manifest?.width, height: manifest?.height },
    highlight: false,
    wd: { id: slug, inv: o.acc || null, qid: null },
  })
}

async function normalize(objs) {
  // Only an open work's manifest is worth fetching: the record is rejected on its licence otherwise.
  const res = await mapPool(objs, 3, async (o) => {
    const open = o.manifest && LICENSE_RULES.getty.ok(o.rights.find((r) => /creativecommons|rightsstatements/.test(r)))
    const manifest = open ? await manifestOf(o.manifest).catch((e) => { log(`  getty: manifest for ${o.iri} failed: ${e.message.slice(0, 100)}`); return null }) : null
    return gettyRecord(o, manifest)
  })
  return res.filter((r) => r && !r.error)
}

export const getty = {
  key: 'getty',
  museum: MUSEUM,
  search: async (query, n) => hydrate(await searchIris(query, n)),
  highlights: async () => [], // the open data flags no highlights
  byIds: async (ids) => hydrate(await resolve(ids)),
  byInventory: async (invs) => hydrate(await resolve(invs)),
  async byFameKeys(keys, n) {
    const iris = [...new Set(await resolve(keys.map((k) => k.value)))]
    return hydrate(iris.slice(0, n))
  },
  idOf: (o) => o.iri,
  wdRefs: (o) => [`id:${o.page?.startsWith(PAGE) ? o.page.slice(PAGE.length) : ''}`, `inv:${o.acc}`],
  normalize,
}
