// The Rijksmuseum, through its Linked Art records (id.rijksmuseum.nl) and its
// search API (data.rijksmuseum.nl/search/collection). No key. Like sources.mjs
// it only maps records; clearance.mjs decides.
//
// One work takes several requests: the object, the VisualItem it shows (the
// image's rights), that item's DigitalObject (the IIIF image), each maker's
// Person record (life dates; cached for the run) and the image's info.json (size).

import { APPROX_MARGIN, isQualified, LICENSE_RULES, peopleFromCredits } from './clearance.mjs'
import { fold, http, log, mapPool } from './lib.mjs'
import { datesFor, record } from './sources.mjs'

const ID = 'https://id.rijksmuseum.nl/'
const SEARCH = 'https://data.rijksmuseum.nl/search/collection'
const LD = { Accept: 'application/ld+json' }
const MUSEUM = 'Rijksmuseum'
const EN = 'http://vocab.getty.edu/aat/300388277'
const AAT = (n) => `http://vocab.getty.edu/aat/${n}`
const PREFERRED = AAT(300404670)
const FORMER_TITLE = `${ID}22015528`
const OBJECT_NUMBER = AAT(300312355)
const TYPE_OF_WORK = AAT(300435443)
const ATTRIBUTION = AAT(300435416) // the production's attribution statement: "attributed to Jan de Baen"
const CREDIT = AAT(300026687)
const MATERIALS = AAT(300435429)
// The museum's own "Top 100" set: its highlights.
const TOP_100 = `${ID}260213`
const TOP_1000 = `${ID}260214`
const TYPES = ['painting', 'drawing', 'print']

const ld = (id) => http(id.startsWith('http') ? id : `${ID}${id}`, { headers: LD })
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v])
const ids = (xs) => arr(xs).map((x) => x?.id).filter(Boolean)
const inLang = (x, lang) => arr(x.language).some((l) => l.id === lang)
const notation = (x) => {
  const ns = arr(x?.notation)
  return (ns.find((n) => n['@language'] === 'en') || ns[0])?.['@value'] || null
}
const yearOf = (t) => (t ? Number(String(t).match(/^-?\d+/)?.[0]) : null)
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const enText = (refs, cls) => arr(refs).find((r) => inLang(r, EN) && ids(r.classified_as).includes(cls))?.content || null

// ---- search ----------------------------------------------------------------

async function searchIds(params, n) {
  const out = []
  let url = `${SEARCH}?${new URLSearchParams({ imageAvailable: 'true', ...params })}`
  while (url && out.length < n) {
    const d = await http(url, { headers: LD })
    out.push(...ids(d.orderedItems))
    url = d.next?.id || null
  }
  return out.slice(0, n)
}

/** Linked Art IDs matching most query words in the title or description, paintings first. */
async function rijksSearch(query, n, sets = [null]) {
  const words = [...new Set(fold(query || '').split(/[^a-z0-9]+/).filter((w) => w.length > 1))]
  const score = new Map()
  const rank = new Map()
  for (const [t, type] of TYPES.entries()) {
    for (const set of sets) {
      for (const w of words.length ? words : [null]) {
        for (const field of w ? ['title', 'description'] : [null]) {
          const params = { type, ...(set ? { memberOfSetId: set } : {}), ...(field ? { [field]: w } : {}) }
          const got = await searchIds(params, n).catch((e) => { log(`  rijks: search failed: ${e.message.slice(0, 120)}`); return [] })
          for (const id of got) {
            score.set(id, (score.get(id) || 0) + 1)
            if (!rank.has(id)) rank.set(id, t)
          }
        }
      }
    }
  }
  return [...score.keys()].sort((a, b) => score.get(b) - score.get(a) || rank.get(a) - rank.get(b)).slice(0, n)
}

/** An object number ("SK-C-5") -> its Linked Art ID, or null. */
async function idOfNumber(num) {
  const got = await searchIds({ objectNumber: num }, 5).catch(() => [])
  return got[0] || null
}

/** Linked Art IDs ("200107928", or full URIs) or object numbers -> Linked Art objects. */
async function rijksByIds(list) {
  const uris = []
  for (const x of [...new Set(list.map(String))]) {
    const uri = /^\d+$/.test(x) ? `${ID}${x}` : x.startsWith(ID) ? x : await idOfNumber(x)
    if (uri) uris.push(uri)
    else log(`  rijks: no object numbered ${x}`)
  }
  const res = await mapPool([...new Set(uris)], 4, (u) => ld(u))
  const out = []
  res.forEach((r, i) => {
    if (r?.error) log(`  rijks: ${uris[i]} failed: ${r.error.message.slice(0, 120)}`)
    else if (r?.type === 'HumanMadeObject') out.push(r)
  })
  return out
}

// ---- hydrate: rights, image, people, size -----------------------------------

const people = new Map() // Person URI -> promise of its record, for the run

/** A Person's life from its born/died timespans: the latest year each allows. */
export function rijksLife(p) {
  const at = (e) => {
    if (!e?.timespan) return {}
    const shown = arr(e.timespan.identified_by).map((x) => x.content).join(' ')
    const year = yearOf(e.timespan.end_of_the_end) ?? yearOf(e.timespan.begin_of_the_begin)
    return { year, approx: /\b(c\.|ca\.|circa)|\?/i.test(shown), after: /\b(after|na)\b/i.test(shown), shown }
  }
  const b = at(p?.born)
  const d = at(p?.died)
  return {
    birth: b.year ?? null, birthApprox: !!b.approx,
    death: d.after ? null : d.year ?? null, deathApprox: !!d.approx, deathAfter: d.after ? yearOf(p.died.timespan.begin_of_the_begin) : null,
  }
}

const partsOf = (obj) => (arr(obj.produced_by?.part).length ? arr(obj.produced_by.part) : [obj.produced_by].filter(Boolean))
const assignedOf = (part, which = () => true) => arr(part.assigned_by).filter(which).flatMap((a) => arr(a.assigned))
// An assignment typed "attributed to", "follower of", "possibly"… qualifies the
// attribution. One that only cites evidence (motivated_by a signature or an
// inscription: "signed by artist") credits the person plainly.
const qualifies = (a) => arr(a.classified_as).length > 0 || !arr(a.motivated_by).length
// A school or circle is a Group formed under the influence of its master.
const peopleIn = (xs) => xs.flatMap((x) => (x.type === 'Person' ? [x] : arr(x.formed_by?.influenced_by)))

/** A Person record's display name: English and preferred if it has one. */
export function rijksPersonName(rec) {
  const names = arr(rec?.identified_by).filter((x) => x.type === 'Name' && x.content)
  const pref = (x) => ids(x.classified_as).includes(PREFERRED)
  return (names.find((x) => pref(x) && inLang(x, EN)) || names.find(pref) || names.find((x) => !x.content.includes(',')) || names[0])?.content || null
}

/** The makers of each production part, with the qualifier the attribution carries. */
export function rijksCredits(obj, persons = new Map()) {
  const out = []
  for (const part of partsOf(obj)) {
    const statement = arr(part.referred_to_by).filter((r) => inLang(r, EN)).map((r) => r.content).find((c) => /:/.test(c)) ||
      arr(part.referred_to_by).find((r) => inLang(r, EN))?.content || ''
    const role = (notation(arr(part.technique)[0]) || statement.split(':')[0] || '').trim()
    const rejected = /\[rejected attribution\]/i.test(statement)
    const direct = peopleIn([...arr(part.carried_out_by), ...assignedOf(part, (a) => !qualifies(a))])
    const assigned = peopleIn(assignedOf(part, qualifies))
    const groups = [...arr(part.carried_out_by), ...assignedOf(part)].filter((x) => x.type === 'Group').length
    const body = statement.replace(/^[^:]*:\s*/, '').replace(/\s*\[[^\]]*\]\s*$/, '')
    for (const [who, qualified] of [...direct.map((p) => [p, false]), ...assigned.map((p) => [p, true])]) {
      const name = persons.get(who.id)?.name || notation(who) || null
      const at = name ? body.indexOf(name) : -1
      // "attributed to Jan de Baen", "Adam van Vianen (I) (possibly)"; else say the least.
      const said = at > 0 ? body.slice(0, at).trim() : at === 0 ? body.slice(name.length).match(/\((possibly|probably)\)/i)?.[1] : null
      const qualifier = qualified ? said || 'attributed to' : null
      out.push({
        name, role: rejected ? 'rejected attribution' : role, qualifier, anonymous: /^(anonymous|anoniem|unknown)$/i.test(name || ''),
        ...rijksLife(persons.get(who.id)?.record), from: `Rijksmuseum ${who.id.replace(ID, '')} born/died`,
      })
    }
    // A part credited to no one we can name (an anonymous school or workshop).
    if (!direct.length && !assigned.length) out.push({ name: null, role, qualifier: groups ? body || 'workshop' : null, anonymous: true, from: 'production part' })
  }
  return out
}

/** The English preferred title, else any English one that isn't a former title, else Dutch. */
export function rijksTitle(obj) {
  const names = arr(obj.identified_by).filter((x) => x.type === 'Name' && !ids(x.classified_as).includes(FORMER_TITLE))
  const pref = (x) => ids(x.classified_as).includes(PREFERRED)
  return (names.find((x) => inLang(x, EN) && pref(x)) || names.find((x) => inLang(x, EN)) || names.find(pref) || names[0])?.content || null
}

const isCircaText = (s) => /(^|[^a-z])(c|ca)\.|\b(circa|after|na)\b|\?/i.test(s || '')

/**
 * The attribution statement as an artist line: "Frans Hals (signed by artist)" ->
 * "Frans Hals", "Adam van Vianen (I) (possibly)" -> "Possibly Adam van Vianen (I)".
 * A generation marker, "(I)" or "(II)", is part of the name.
 */
export function rijksArtistName(statement) {
  const s = String(statement || '').replace(/\s*\((signed by artist|mentioned on object|dated by artist)\)/gi, '').trim()
  const m = s.match(/^(.*?)\s*\((possibly|probably)\)$/i)
  return cap(m ? `${m[2]} ${m[1]}` : s) || null
}

export function rijksRecord({ obj, rights, image, persons = new Map() }) {
  const objectNumber = arr(obj.identified_by).find((x) => x.type === 'Identifier' && ids(x.classified_as).includes(OBJECT_NUMBER))?.content || null
  const types = arr(obj.classified_as).filter((t) => arr(t.classified_as).some((c) => c.id === TYPE_OF_WORK)).map(notation).filter(Boolean)
  const ts = obj.produced_by?.timespan
  const shownDate = arr(ts?.identified_by).find((x) => inLang(x, EN))?.content || arr(ts?.identified_by)[0]?.content || null
  const begin = yearOf(ts?.begin_of_the_begin)
  const end = yearOf(ts?.end_of_the_end)
  // "c. 1925" is stored as 1925: the date checks take it as up to ten years later, as for Commons.
  const objectEnd = end == null ? null : end + (isCircaText(shownDate) && begin === end ? APPROX_MARGIN : 0)
  const who = peopleFromCredits(rijksCredits(obj, persons))
  const statement = enText(obj.produced_by?.referred_to_by, ATTRIBUTION)
  // "(possibly)" can sit on the statement alone.
  if (!who.qualified && isQualified(statement)) who.qualified = statement
  const gate = {
    source: 'rijks', license_value: rights ?? null, type_label: types.join(' / ') || null,
    medium: enText(obj.referred_to_by, MATERIALS), object_end: objectEnd, who, width: image?.width ?? null, height: image?.height ?? null,
  }
  const numericId = String(obj.id).replace(ID, '')
  const artist = rijksArtistName(statement) || who.people.map((p) => p.name).join(' and ') || (who.anonymous ? 'Unknown artist' : null)
  return record({
    objectId: `rijks:${objectNumber || numericId}`,
    gate,
    prov: {
      artist,
      artist_dates: datesFor(who, artist),
      original_title: rijksTitle(obj),
      original_date: shownDate,
      museum: MUSEUM,
      credit_line: enText(obj.referred_to_by, CREDIT),
      source_url: objectNumber ? `https://www.rijksmuseum.nl/en/collection/${objectNumber}` : obj.id,
    },
    image: { url: image?.url ?? null, width: image?.width, height: image?.height },
    highlight: ids(obj.member_of).includes(TOP_100),
    wd: { id: numericId, inv: objectNumber, qid: null },
  })
}

/** The image's rights, its IIIF URL and, when it's open, its size. */
async function imageOf(obj) {
  const visualId = ids(obj.shows)[0]
  if (!visualId) return { rights: null, image: null }
  const visual = await ld(visualId)
  const rights = arr(visual.subject_to).flatMap((r) => ids(r.classified_as)).find((u) => /creativecommons\.org|rightsstatements\.org/.test(u)) || null
  const digitalId = ids(visual.digitally_shown_by)[0]
  const url = digitalId ? ids((await ld(digitalId)).access_point)[0] || null : null
  if (!url || !LICENSE_RULES.rijks.ok(rights)) return { rights, image: url ? { url } : null }
  const base = url.replace(/\/full\/.*$/, '')
  const info = await http(`${base}/info.json`).catch((e) => { log(`  rijks: ${base}/info.json failed: ${e.message.slice(0, 100)}`); return null })
  return { rights, image: { url, width: info?.width ?? null, height: info?.height ?? null } }
}

function personRecord(p) {
  if (!people.has(p.id)) {
    people.set(p.id, ld(p.id).then((record) => ({ record, name: notation(p) || rijksPersonName(record) }))
      .catch((e) => { log(`  rijks: person ${p.id} failed: ${e.message.slice(0, 100)}`); return { record: null, name: notation(p) } }))
  }
  return people.get(p.id)
}

async function hydrate(obj) {
  const { rights, image } = await imageOf(obj)
  const persons = new Map()
  for (const p of partsOf(obj).flatMap((part) => peopleIn([...arr(part.carried_out_by), ...assignedOf(part)]))) persons.set(p.id, await personRecord(p))
  return rijksRecord({ obj, rights, image, persons })
}

export const rijks = {
  key: 'rijks',
  museum: MUSEUM,
  search: async (query, n) => rijksByIds(await rijksSearch(query, n)),
  highlights: async (n, query) => rijksByIds(await rijksSearch(query, n, [TOP_100, TOP_1000])),
  byIds: rijksByIds,
  byInventory: rijksByIds,
  /** In Wikidata's fame order: Linked Art IDs directly, object numbers through the search. */
  async byFameKeys(keys, n) {
    const uris = []
    for (const k of keys) {
      if (uris.length >= n) break
      const uri = k.kind === 'id' ? `${ID}${k.value}` : await idOfNumber(k.value)
      if (uri && !uris.includes(uri)) uris.push(uri)
    }
    return rijksByIds(uris)
  },
  idOf: (o) => o.id,
  wdRefs: (o) => [`id:${String(o.id).replace(ID, '')}`, `inv:${arr(o.identified_by).find((x) => x.type === 'Identifier' && ids(x.classified_as).includes(OBJECT_NUMBER))?.content}`],
  async normalize(objs) {
    const res = await mapPool(objs, 4, hydrate)
    return res.filter((r, i) => {
      if (r?.error) log(`  rijks: ${objs[i].id} failed: ${r.error.message.slice(0, 120)}`)
      return r && !r.error
    })
  },
}
