// Fame signal: how many Wikipedia language editions have an article on the
// artwork, joined through each museum's Wikidata object-ID property.
//
// Properties (verified through the Wikidata API):
//   P4610  "ARTIC artwork ID"                  -> https://www.artic.edu/artworks/$1
//   P3634  "The Met object ID"                 -> https://www.metmuseum.org/art/collection/search/$1
//   P11110 "Cleveland Museum of Art ID"        -> https://www.clevelandart.org/art/$1 (accession no.)
//   P4683  "National Gallery of Art artwork ID" -> https://www.nga.gov/collection/art-object-page.$1.html
//   P13234 "Rijksmuseum ID"                    -> https://id.rijksmuseum.nl/$1 (the Linked Art ID)
//   P2582  "J. Paul Getty Museum object ID"    -> https://www.getty.edu/art/collection/object/$1 (the page slug)
//   SMK has no ID property; it joins on inventory numbers only.
//   P217 inventory number, qualified by P195 collection = the museum's item (WD below).
//   Must be the *qualified* statement: a print held by ten museums carries ten
//   P195s and ten P217s on one item.
//   Q5 = human (a few museum-ID statements sit on artist items; excluded).
// Sparse ID properties also join on qualified inventory numbers: Cleveland (P11110
// ~200 items, inventory ~68k), the Rijksmuseum (~5.5k, ~6.6k), the Getty (~2.6k,
// ~800) and AIC as a backstop (~3k). The Met's P3634 (~72k) and NGA's P4683
// (~128k) are dense, and both museums hand us the item QID directly as well.
//
// Use UNIONed subqueries: a plain UNION with a sitelinks filter times out (504).

import { chunk, http } from './lib.mjs'

const ENDPOINT = 'https://query.wikidata.org/sparql'

export const WD = {
  aic: { idProp: 'P4610', museum: 'Q239303', inventory: true },
  met: { idProp: 'P3634', museum: 'Q160236', inventory: false },
  cma: { idProp: 'P11110', museum: 'Q657415', inventory: true },
  nga: { idProp: 'P4683', museum: 'Q214867', inventory: false },
  rijks: { idProp: 'P13234', museum: 'Q190804', inventory: true },
  getty: { idProp: 'P2582', museum: 'Q731126', inventory: true },
  smk: { idProp: null, museum: 'Q671384', inventory: true },
}

// Flat-art P31 classes (labels confirmed via wbgetentities), so --famous doesn't
// spend museum requests hydrating chariots and period rooms. Items with no P31 are
// kept; the museum record + clearance gate still decide.
const FLAT_TYPES = [
  'Q3305213', // painting
  'Q1400853', // portrait painting
  'Q18761202', // watercolor painting
  'Q16593391', // tableau
  'Q741226', // byōbu
  'Q93184', // drawing
  'Q11060274', // print
  'Q18887969', // copper engraving print
  'Q11835431', // engraving
  'Q18219090', // woodcut print
  'Q28913685', // woodblock print
  'Q15123870', // lithograph print
  'Q18218093', // etching print
  'Q838948', // work of art (generic)
]

// One query at a time. Every source runs its own, and the heavy ones (the
// Commons discovery takes ~20 s alone) pass the server's 60 s limit and get a
// 504 when they share it.
const MAX_IN_FLIGHT = 1
let inFlight = 0
const queue = []

export async function sparql(query, { retries = 2 } = {}) {
  while (inFlight >= MAX_IN_FLIGHT) await new Promise((r) => queue.push(r))
  inFlight++
  try {
    const d = await http(ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ query }).toString(),
      retries,
      timeoutMs: 70_000,
    })
    return d.results.bindings.map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])))
  } finally {
    inFlight--
    queue.shift()?.()
  }
}

const lit = (s) => JSON.stringify(String(s)) // SPARQL string literal (JSON escaping is compatible)
const invPattern = (museum) => `?st pq:P195 wd:${museum} . ?item p:P217 ?st . ?st ps:P217 ?v .`

/**
 * Batched: one query per BATCH candidates of a source. `cands` carry
 * `_wd: {id, inv, qid}`. Returns Map(object_id -> wikipedia_langs). Throws if
 * Wikidata is unreachable (the caller falls back to highlight flags). Also sets
 * a candidate's missing `_wd.qid` when exactly one item matches it, so the same
 * work can be matched across sources.
 */
const BATCH = 200
export async function wikipediaLangs(source, cands) {
  const out = new Map()
  for (const part of chunk(cands, BATCH)) {
    for (const [k, v] of await wikipediaLangsBatch(source, part)) out.set(k, v)
  }
  return out
}

async function wikipediaLangsBatch(source, cands) {
  const cfg = WD[source]
  const ids = cfg.idProp ? [...new Set(cands.map((c) => c._wd?.id).filter(Boolean))] : []
  const invs = cfg.inventory ? [...new Set(cands.map((c) => c._wd?.inv).filter(Boolean))] : []
  const qids = [...new Set(cands.map((c) => c._wd?.qid).filter((q) => /^Q\d+$/.test(q || '')))]
  if (!ids.length && !invs.length && !qids.length) return new Map()
  const parts = []
  if (ids.length && cfg.idProp) parts.push(`{ VALUES ?v { ${ids.map(lit).join(' ')} } ?item wdt:${cfg.idProp} ?v . BIND(CONCAT("id:", ?v) AS ?key) }`)
  if (invs.length) parts.push(`{ VALUES ?v { ${invs.map(lit).join(' ')} } ${invPattern(cfg.museum)} BIND(CONCAT("inv:", ?v) AS ?key) }`)
  if (qids.length) parts.push(`{ VALUES ?item { ${qids.map((q) => `wd:${q}`).join(' ')} } BIND(CONCAT("q:", STRAFTER(STR(?item), STR(wd:))) AS ?key) }`)
  // COUNT(DISTINCT ?wiki): language editions, not articles — an object linked from
  // two items (e.g. a print's design + this impression) isn't double counted.
  const q = `SELECT ?key (COUNT(DISTINCT ?wiki) AS ?wp) (GROUP_CONCAT(DISTINCT STRAFTER(STR(?item), STR(wd:))) AS ?items) WHERE {
  ${parts.join('\n  UNION ')}
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q5 }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf ?wiki . ?wiki wikibase:wikiGroup "wikipedia" . }
} GROUP BY ?key`
  const rows = await sparql(q)
  const byKey = new Map(rows.map((r) => [r.key, Number(r.wp)]))
  const itemsOf = new Map(rows.map((r) => [r.key, String(r.items || '').split(' ').filter(Boolean)]))
  const out = new Map()
  for (const c of cands) {
    const w = c._wd || {}
    const keys = [`id:${w.id}`, `inv:${w.inv}`, `q:${w.qid}`]
    out.set(c.object_id, Math.max(0, ...keys.map((k) => byKey.get(k) ?? 0)))
    const items = [...new Set(keys.flatMap((k) => itemsOf.get(k) || []))]
    if (c._wd && !w.qid && items.length === 1) c._wd.qid = items[0]
  }
  return out
}

/**
 * The museum's most-linked flat artworks on Wikidata (by total sitelinks — cheap
 * to sort; the exact Wikipedia-edition count comes from wikipediaLangs after).
 * Returns [{kind: 'id'|'inv', value, sitelinks}], most famous first.
 */
export async function famousKeys(source, limit) {
  const cfg = WD[source]
  const keep = `FILTER NOT EXISTS { ?item wdt:P31 wd:Q5 }
      FILTER (EXISTS { VALUES ?t { ${FLAT_TYPES.map((t) => `wd:${t}`).join(' ')} } ?item wdt:P31 ?t } || NOT EXISTS { ?item wdt:P31 [] })`
  const sub = (pattern, kind) => `{ SELECT ?key ?links WHERE {
      ${pattern} ?item wikibase:sitelinks ?links . FILTER(?links >= 3)
      ${keep}
      BIND(CONCAT("${kind}:", ?v) AS ?key) } }`
  const parts = []
  if (cfg.idProp) parts.push(sub(`?item wdt:${cfg.idProp} ?v .`, 'id'))
  if (cfg.inventory) parts.push(sub(invPattern(cfg.museum), 'inv'))
  const q = `SELECT ?key (MAX(?links) AS ?n) WHERE {
  ${parts.join('\n  UNION ')}
} GROUP BY ?key ORDER BY DESC(?n) ?key LIMIT ${Math.max(1, Math.floor(limit))}`
  return (await sparql(q)).map((r) => {
    const [kind, ...rest] = r.key.split(':')
    return { kind, value: rest.join(':'), sitelinks: Number(r.n) }
  })
}
